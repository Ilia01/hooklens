import { afterEach, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import Stripe from 'stripe'
import {
  createServer,
  headersForForwarding,
  type Server,
  type ServerOptions,
} from '../../src/server/index.js'
import { createStorage } from '../../src/storage/index.js'
import { createStripeVerifier } from '../../src/verify/stripe.js'
import type { VerificationResult, WebhookEvent } from '../../src/types.js'

type Storage = ReturnType<typeof createStorage>

const STRIPE_SECRET = 'whsec_test_secret_thatislongenoughtolooklikearealone'

function tmpDb(): string {
  return path.join(os.tmpdir(), `hooklens-server-${crypto.randomUUID()}.db`)
}

function stripeHeaderFor(payload: string, secret: string = STRIPE_SECRET): string {
  return Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: Math.floor(Date.now() / 1000),
  } as Parameters<typeof Stripe.webhooks.generateTestHeaderString>[0])
}

interface TargetRecord {
  method: string
  path: string
  headers: http.IncomingHttpHeaders
  body: string
}

interface TargetServer {
  url: string
  received: TargetRecord[]
  stop: () => Promise<void>
}

interface TargetResponse {
  status?: number
  body?: string
  headers?: Record<string, string>
}

async function startTarget(
  responder?: (rec: TargetRecord) => TargetResponse,
): Promise<TargetServer> {
  const received: TargetRecord[] = []
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const rec: TargetRecord = {
        method: req.method ?? '',
        path: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }
      received.push(rec)
      const resp = responder?.(rec) ?? {}
      res.statusCode = resp.status ?? 200
      for (const [k, v] of Object.entries(resp.headers ?? {})) res.setHeader(k, v)
      res.end(resp.body ?? 'ok')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('target bound to unexpected address')
  return {
    url: `http://127.0.0.1:${addr.port}`,
    received,
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

async function postRaw(
  url: string,
  body: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string; headers: Headers }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
  return { status: res.status, body: await res.text(), headers: res.headers }
}

interface Fixture {
  server: Server
  storage: Storage
  url: string
  dbPath: string
}

const fixtures: Fixture[] = []
const targets: TargetServer[] = []

afterEach(async () => {
  for (const f of fixtures) {
    try {
      await f.server.stop()
    } catch {
      // already stopped
    }
    f.storage.close()
    fs.rmSync(f.dbPath, { force: true })
  }
  fixtures.length = 0
  for (const t of targets) {
    await t.stop()
  }
  targets.length = 0
})

async function hookLens(opts: Partial<ServerOptions> = {}): Promise<Fixture> {
  const dbPath = tmpDb()
  const storage = opts.storage ?? createStorage(dbPath)
  const server = createServer({
    port: 0,
    storage,
    ...opts,
  })
  await server.start()
  const fx: Fixture = {
    server,
    storage,
    url: `http://127.0.0.1:${server.port}`,
    dbPath,
  }
  fixtures.push(fx)
  return fx
}

async function target(responder?: (rec: TargetRecord) => TargetResponse): Promise<TargetServer> {
  const t = await startTarget(responder)
  targets.push(t)
  return t
}

describe('createServer - lifecycle', () => {
  it('binds to a port and exposes it after start()', async () => {
    const fx = await hookLens()
    expect(fx.server.port).toBeGreaterThan(0)
  })

  it('stop() closes the listener so further requests fail', async () => {
    const fx = await hookLens()
    await fx.server.stop()

    fixtures.pop()
    fx.storage.close()
    fs.rmSync(fx.dbPath, { force: true })
    await expect(postRaw(fx.url, '{}')).rejects.toThrow()
  })
})

describe('createServer - request capture', () => {
  it('captures method, path, headers, and raw body', async () => {
    const fx = await hookLens()
    const body = '{"id":"evt_test","type":"ping"}'

    await postRaw(`${fx.url}/webhook`, body, { 'x-custom-header': 'hello' })

    const events = fx.storage.list()
    expect(events).toHaveLength(1)
    expect(events[0].method).toBe('POST')
    expect(events[0].path).toBe('/webhook')
    expect(events[0].body).toBe(body)
    expect(events[0].headers['x-custom-header']).toBe('hello')
  })

  it('preserves query strings in the captured path', async () => {
    const fx = await hookLens()

    await postRaw(`${fx.url}/hook?source=stripe&version=1`, '{}')

    const events = fx.storage.list()
    expect(events[0].path).toBe('/hook?source=stripe&version=1')
  })

  it('generates an evt_ prefixed id for each event', async () => {
    const fx = await hookLens()

    await postRaw(`${fx.url}/`, '{"a":1}')
    await postRaw(`${fx.url}/`, '{"a":2}')

    const events = fx.storage.list()
    expect(events).toHaveLength(2)
    for (const e of events) {
      expect(e.id).toMatch(/^evt_/)
    }
    expect(new Set(events.map((e) => e.id)).size).toBe(2)
  })

  it('writes an ISO 8601 timestamp', async () => {
    const fx = await hookLens()

    await postRaw(`${fx.url}/`, '{}')

    const [event] = fx.storage.list()
    // loose ISO check: parseable and round-trips
    expect(() => new Date(event.timestamp).toISOString()).not.toThrow()
    expect(new Date(event.timestamp).toString()).not.toBe('Invalid Date')
  })

  it('preserves raw bytes of a unicode body without re-encoding', async () => {
    const fx = await hookLens()
    const body = '{"name":"日本語","emoji":"🚀"}'

    await postRaw(`${fx.url}/`, body)

    const [event] = fx.storage.list()
    expect(event.body).toBe(body)
  })

  it('handles GET requests with empty bodies', async () => {
    const fx = await hookLens()

    await fetch(`${fx.url}/health`)

    const events = fx.storage.list()
    expect(events).toHaveLength(1)
    expect(events[0].method).toBe('GET')
    expect(events[0].body).toBe('')
  })

  it('calls onEvent for every captured request', async () => {
    const onEvent = vi.fn<(e: WebhookEvent, r: VerificationResult | null) => void>()
    const fx = await hookLens({ onEvent })

    await postRaw(`${fx.url}/`, '{"a":1}')
    await postRaw(`${fx.url}/`, '{"a":2}')

    expect(onEvent).toHaveBeenCalledTimes(2)
    // second arg is null because no verify configured
    expect(onEvent.mock.calls[0][1]).toBeNull()
    expect(onEvent.mock.calls[0][0].body).toBe('{"a":1}')
  })
})

describe('createServer - verification', () => {
  it('runs the configured verifier and reports valid', async () => {
    const onEvent = vi.fn<(e: WebhookEvent, r: VerificationResult | null) => void>()
    const verifier = createStripeVerifier({ secret: STRIPE_SECRET })
    const fx = await hookLens({ verifier, onEvent })
    const body = '{"id":"evt_1","type":"ping"}'
    const header = stripeHeaderFor(body)

    await postRaw(`${fx.url}/`, body, { 'stripe-signature': header })

    expect(onEvent).toHaveBeenCalledTimes(1)
    const result = onEvent.mock.calls[0][1]
    expect(result).not.toBeNull()
    expect(result?.valid).toBe(true)
    expect(result?.code).toBe('valid')
  })

  it('reports signature_mismatch when secret is wrong', async () => {
    const onEvent = vi.fn<(e: WebhookEvent, r: VerificationResult | null) => void>()
    const verifier = createStripeVerifier({ secret: STRIPE_SECRET })
    const fx = await hookLens({ verifier, onEvent })
    const body = '{"id":"evt_1"}'
    const header = stripeHeaderFor(body, 'whsec_wrong_secret')

    await postRaw(`${fx.url}/`, body, { 'stripe-signature': header })

    const result = onEvent.mock.calls[0][1]
    expect(result?.valid).toBe(false)
    expect(result?.code).toBe('signature_mismatch')
  })

  it('reports missing_header when stripe-signature is absent', async () => {
    const onEvent = vi.fn<(e: WebhookEvent, r: VerificationResult | null) => void>()
    const verifier = createStripeVerifier({ secret: STRIPE_SECRET })
    const fx = await hookLens({ verifier, onEvent })

    await postRaw(`${fx.url}/`, '{}')

    const result = onEvent.mock.calls[0][1]
    expect(result?.code).toBe('missing_header')
  })

  it('still stores the event even when verification fails', async () => {
    const verifier = createStripeVerifier({ secret: STRIPE_SECRET })
    const fx = await hookLens({ verifier })

    await postRaw(`${fx.url}/`, '{"tampered":true}', { 'stripe-signature': 'garbage' })

    const events = fx.storage.list()
    expect(events).toHaveLength(1)
  })

  it('passes null result to onEvent when no verifier is configured', async () => {
    const onEvent = vi.fn<(e: WebhookEvent, r: VerificationResult | null) => void>()
    const fx = await hookLens({ onEvent })

    await postRaw(`${fx.url}/`, '{}')

    expect(onEvent.mock.calls[0][1]).toBeNull()
  })

  it('works with any Verifier-shaped object, not just stripe', async () => {
    // Prove the server is provider-agnostic: a hand-rolled verifier that
    // knows nothing about stripe still plugs in and runs.
    const onEvent = vi.fn<(e: WebhookEvent, r: VerificationResult | null) => void>()
    const verify = vi.fn<
      (event: { headers: Record<string, string>; body: string }) => VerificationResult
    >(() => ({
      valid: true,
      provider: 'fake',
      code: 'valid',
      message: 'ok',
    }))
    const fakeVerifier = { provider: 'fake', verify }
    const fx = await hookLens({ verifier: fakeVerifier, onEvent })

    await postRaw(`${fx.url}/`, '{"x":1}', { 'x-fake-sig': 'anything' })

    expect(verify).toHaveBeenCalledTimes(1)
    expect(verify.mock.calls[0]?.[0].body).toBe('{"x":1}')
    expect(verify.mock.calls[0]?.[0].headers['x-fake-sig']).toBe('anything')
    expect(onEvent.mock.calls[0]?.[1]?.provider).toBe('fake')
  })
})

describe('createServer - forwarding', () => {
  it('forwards the request body byte-for-byte', async () => {
    const downstream = await target()
    const fx = await hookLens({ forwardTo: downstream.url })
    const body = '{"id":"evt_abc","type":"checkout.session.completed"}'

    await postRaw(`${fx.url}/webhook`, body)

    expect(downstream.received).toHaveLength(1)
    expect(downstream.received[0].body).toBe(body)
  })

  it('forwards method and path', async () => {
    const downstream = await target()
    const fx = await hookLens({ forwardTo: downstream.url })

    await postRaw(`${fx.url}/custom/path`, '{}')

    expect(downstream.received[0].method).toBe('POST')
    expect(downstream.received[0].path).toBe('/custom/path')
  })

  it('forwards stripe-signature so the downstream app can verify too', async () => {
    const downstream = await target()
    const fx = await hookLens({ forwardTo: downstream.url })
    const body = '{"x":1}'
    const header = stripeHeaderFor(body)

    await postRaw(`${fx.url}/`, body, { 'stripe-signature': header })

    expect(downstream.received[0].headers['stripe-signature']).toBe(header)
  })

  // Hop-by-hop stripping is tested as a unit on headersForForwarding below.
  // Round-tripping it through fetch is unreliable because undici reinserts
  // its own framing/connection headers regardless of what we pass.

  it('returns the downstream response status to the caller', async () => {
    const downstream = await target(() => ({ status: 418, body: 'teapot' }))
    const fx = await hookLens({ forwardTo: downstream.url })

    const res = await postRaw(`${fx.url}/`, '{}')

    expect(res.status).toBe(418)
    expect(res.body).toBe('teapot')
  })

  it('returns 502 when the forward target is unreachable', async () => {
    // find a port nothing is listening on, then use it
    const probe = http.createServer()
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', () => resolve()))
    const addr = probe.address()
    if (!addr || typeof addr === 'string') throw new Error('probe bad addr')
    const deadPort = addr.port
    await new Promise<void>((resolve) => probe.close(() => resolve()))

    const fx = await hookLens({ forwardTo: `http://127.0.0.1:${deadPort}` })

    const res = await postRaw(`${fx.url}/`, '{}')
    expect(res.status).toBe(502)
  })

  it('acks 200 when no forwardTo is configured', async () => {
    const fx = await hookLens()

    const res = await postRaw(`${fx.url}/`, '{}')

    expect(res.status).toBe(200)
  })

  it('still stores and fires onEvent even when forwarding fails', async () => {
    const onEvent = vi.fn<(e: WebhookEvent, r: VerificationResult | null) => void>()
    const fx = await hookLens({ forwardTo: 'http://127.0.0.1:1', onEvent })

    await postRaw(`${fx.url}/`, '{"a":1}')

    expect(fx.storage.list()).toHaveLength(1)
    expect(onEvent).toHaveBeenCalledTimes(1)
  })
})

describe('headersForForwarding', () => {
  it('strips RFC 7230 hop-by-hop headers', () => {
    const input = {
      connection: 'keep-alive',
      'keep-alive': 'timeout=5',
      'proxy-authenticate': 'Basic',
      'proxy-authorization': 'Bearer x',
      te: 'trailers',
      trailer: 'Expires',
      'transfer-encoding': 'chunked',
      upgrade: 'websocket',
      'content-type': 'application/json',
    }

    const out = headersForForwarding(input)

    expect(out['content-type']).toBe('application/json')
    expect(out['connection']).toBeUndefined()
    expect(out['keep-alive']).toBeUndefined()
    expect(out['proxy-authenticate']).toBeUndefined()
    expect(out['proxy-authorization']).toBeUndefined()
    expect(out['te']).toBeUndefined()
    expect(out['trailer']).toBeUndefined()
    expect(out['transfer-encoding']).toBeUndefined()
    expect(out['upgrade']).toBeUndefined()
  })

  it('strips host so fetch can set it from the destination URL', () => {
    const out = headersForForwarding({
      host: 'hooklens.local:4400',
      'content-type': 'application/json',
    })
    expect(out['host']).toBeUndefined()
    expect(out['content-type']).toBe('application/json')
  })

  it('strips content-length so fetch can recompute it from the body', () => {
    const out = headersForForwarding({
      'content-length': '42',
      'content-type': 'application/json',
    })
    expect(out['content-length']).toBeUndefined()
    expect(out['content-type']).toBe('application/json')
  })

  it('is case-insensitive when matching header names', () => {
    const out = headersForForwarding({
      Connection: 'keep-alive',
      'TRANSFER-ENCODING': 'chunked',
      'Content-Type': 'application/json',
    })
    expect(out['Connection']).toBeUndefined()
    expect(out['TRANSFER-ENCODING']).toBeUndefined()
    expect(out['Content-Type']).toBe('application/json')
  })

  it('preserves custom headers like stripe-signature', () => {
    const out = headersForForwarding({
      'stripe-signature': 't=123,v1=abc',
      'x-forwarded-for': '1.2.3.4',
      connection: 'keep-alive',
    })
    expect(out['stripe-signature']).toBe('t=123,v1=abc')
    expect(out['x-forwarded-for']).toBe('1.2.3.4')
    expect(out['connection']).toBeUndefined()
  })
})
