import { afterEach, describe, expect, it, vi } from 'vitest'
import http from 'node:http'
import crypto from 'node:crypto'
import { EventEmitter } from 'node:events'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import Stripe from 'stripe'
import {
  createServer,
  headersForForwarding,
  parseEventPath,
  readBody,
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
  delayMs?: number
}

async function startTarget(
  responder?: (rec: TargetRecord) => TargetResponse | Promise<TargetResponse>,
): Promise<TargetServer> {
  const received: TargetRecord[] = []
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', async () => {
      const rec: TargetRecord = {
        method: req.method ?? '',
        path: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }
      received.push(rec)
      const resp = (await responder?.(rec)) ?? {}
      if (resp.delayMs && resp.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, resp.delayMs))
      }
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

async function postAbsoluteForm(
  url: string,
  requestPath: string,
  body: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  const target = new URL(url)
  return await new Promise((resolve, reject) => {
    const req = http.request(
      {
        method: 'POST',
        hostname: target.hostname,
        port: Number(target.port),
        path: requestPath,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body).toString(),
          ...headers,
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
          })
        })
      },
    )
    req.on('error', reject)
    req.end(body)
  })
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

async function target(
  responder?: (rec: TargetRecord) => TargetResponse | Promise<TargetResponse>,
): Promise<TargetServer> {
  const t = await startTarget(responder)
  targets.push(t)
  return t
}

function fakeBodyRequest(): {
  req: http.IncomingMessage
  socket: EventEmitter & { proxy?: EventEmitter }
  proxy: EventEmitter
} {
  const req = new EventEmitter() as http.IncomingMessage
  const socket = new EventEmitter() as EventEmitter & { proxy?: EventEmitter }
  const proxy = new EventEmitter()
  socket.proxy = proxy
  Object.defineProperty(req, 'socket', {
    configurable: true,
    enumerable: true,
    value: socket,
  })
  return { req, socket, proxy }
}

describe('createServer - lifecycle', () => {
  it('binds to a port and exposes it after start()', async () => {
    const fx = await hookLens()
    expect(fx.server.port).toBeGreaterThan(0)
  })

  it('stop() closes the listener so further requests fail', async () => {
    const fx = await hookLens()
    await fx.server.stop()
    expect(fx.server.port).toBe(0)

    fixtures.pop()
    fx.storage.close()
    fs.rmSync(fx.dbPath, { force: true })
    await expect(postRaw(fx.url, '{}')).rejects.toThrow()
  })

  it('rejects concurrent and repeated start() calls', async () => {
    const dbPath = tmpDb()
    const storage = createStorage(dbPath)
    const server = createServer({ port: 0, storage })

    try {
      const firstStart = server.start()
      await expect(server.start()).rejects.toThrow('server already started')
      await firstStart
      await expect(server.start()).rejects.toThrow('server already started')
    } finally {
      await server.stop()
      storage.close()
      fs.rmSync(dbPath, { force: true })
    }
  })

  it('clears startup state after a failed listen so start() can be retried', async () => {
    const blocker = http.createServer()
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', () => resolve()))
    const addr = blocker.address()
    if (!addr || typeof addr === 'string') throw new Error('blocker bad addr')

    const dbPath = tmpDb()
    const storage = createStorage(dbPath)
    const server = createServer({ port: addr.port, storage })

    try {
      await expect(server.start()).rejects.toThrow()
      await new Promise<void>((resolve) => blocker.close(() => resolve()))
      await expect(server.start()).resolves.toBeUndefined()
      expect(server.port).toBe(addr.port)
    } finally {
      if (blocker.listening) {
        await new Promise<void>((resolve) => blocker.close(() => resolve()))
      }
      await server.stop()
      storage.close()
      fs.rmSync(dbPath, { force: true })
    }
  })
})

describe('readBody', () => {
  it.each(['socket', 'proxy'] as const)(
    'rejects when the %s closes before the request body settles',
    async (which) => {
      const { req, socket, proxy } = fakeBodyRequest()
      const body = readBody(req, 1024)

      req.emit('data', Buffer.from('{"partial":'))
      ;(which === 'socket' ? socket : proxy).emit('close')

      await expect(body).rejects.toThrow('socket closed during request body')
    },
  )

  it('cleans up request and socket listeners after the body settles', async () => {
    const { req, socket, proxy } = fakeBodyRequest()
    const body = readBody(req, 1024)

    req.emit('data', Buffer.from('{"ok":true}'))
    req.emit('end')

    await expect(body).resolves.toBe('{"ok":true}')
    expect(req.listenerCount('data')).toBe(0)
    expect(req.listenerCount('end')).toBe(0)
    expect(req.listenerCount('error')).toBe(0)
    expect(socket.listenerCount('close')).toBe(0)
    expect(socket.listenerCount('error')).toBe(0)
    expect(proxy.listenerCount('close')).toBe(0)
    expect(proxy.listenerCount('error')).toBe(0)
  })
})

describe('parseEventPath', () => {
  it('parses absolute-form URLs with the URL parser', () => {
    expect(parseEventPath('http://malicious.invalid/custom/path?source=stripe')).toEqual({
      pathname: '/custom/path',
      search: '?source=stripe',
    })
  })

  it('keeps network-path references raw', () => {
    expect(parseEventPath('//evil.invalid/custom/path?source=stripe')).toEqual({
      pathname: '//evil.invalid/custom/path',
      search: '?source=stripe',
    })
  })

  it('keeps dot segments raw for origin-form paths', () => {
    expect(parseEventPath('/../escape?source=stripe')).toEqual({
      pathname: '/../escape',
      search: '?source=stripe',
    })
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

  it('returns 413 and skips storage when the body exceeds maxBodyBytes', async () => {
    const onEvent = vi.fn<(e: WebhookEvent, r: VerificationResult | null) => void>()
    const fx = await hookLens({ maxBodyBytes: 8, onEvent })

    const res = await postRaw(`${fx.url}/`, '{"too":"large"}')

    expect(res.status).toBe(413)
    expect(res.body).toBe('payload too large: max 8 bytes')
    expect(fx.storage.list()).toHaveLength(0)
    expect(onEvent).not.toHaveBeenCalled()
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

  it('retains the configured target origin and base path for forwarded requests', async () => {
    const downstream = await target()
    const fx = await hookLens({ forwardTo: `${downstream.url}/webhook` })

    const res = await postAbsoluteForm(
      fx.url,
      'http://malicious.invalid/custom/path?source=stripe',
      '{}',
    )

    expect(res.status).toBe(200)
    expect(downstream.received).toHaveLength(1)
    expect(downstream.received[0].path).toBe('/webhook/custom/path?source=stripe')
  })

  it('preserves trusted forwardTo query params over incoming query params', async () => {
    const downstream = await target()
    const fx = await hookLens({
      forwardTo: `${downstream.url}/webhook?token=trusted&mode=debug`,
    })

    await postRaw(`${fx.url}/custom/path?source=stripe&token=attacker`, '{}')

    const forwarded = new URL(downstream.received[0].path, 'http://hooklens.invalid')
    expect(forwarded.pathname).toBe('/webhook/custom/path')
    expect(forwarded.searchParams.get('source')).toBe('stripe')
    expect(forwarded.searchParams.get('token')).toBe('trusted')
    expect(forwarded.searchParams.get('mode')).toBe('debug')
  })

  it('applies raw dot-segment paths after the configured base path is joined', async () => {
    const downstream = await target()
    const fx = await hookLens({ forwardTo: `${downstream.url}/webhook` })

    const res = await postAbsoluteForm(fx.url, '/../escape?source=stripe', '{}')

    expect(res.status).toBe(200)
    expect(downstream.received[0].path).toBe('/escape?source=stripe')
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

  it('returns 502 with reason when the forward target is unreachable', async () => {
    const probe = http.createServer()
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', () => resolve()))
    const addr = probe.address()
    if (!addr || typeof addr === 'string') throw new Error('probe bad addr')
    const deadPort = addr.port
    await new Promise<void>((resolve) => probe.close(() => resolve()))

    const fx = await hookLens({ forwardTo: `http://127.0.0.1:${deadPort}` })

    const res = await postRaw(`${fx.url}/`, '{}')
    expect(res.status).toBe(502)
    expect(res.body).toMatch(/^bad gateway: /)
    expect(res.body).toMatch(/ECONNREFUSED/)
  })

  it('returns 502 with reason when the downstream target exceeds forwardTimeoutMs', async () => {
    const downstream = await target(() => ({ delayMs: 50, body: 'slow' }))
    const fx = await hookLens({ forwardTo: downstream.url, forwardTimeoutMs: 10 })

    const res = await postRaw(`${fx.url}/`, '{}')

    expect(res.status).toBe(502)
    expect(res.body).toMatch(/^bad gateway: /)
    expect(res.body).toMatch(/timed out/)
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

  it('calls onForwardError with the event and error when forwarding fails', async () => {
    const onForwardError = vi.fn<(e: WebhookEvent, err: Error) => void>()
    const fx = await hookLens({ forwardTo: 'http://127.0.0.1:1', onForwardError })

    await postRaw(`${fx.url}/`, '{"a":1}')

    expect(onForwardError).toHaveBeenCalledTimes(1)
    const [event, error] = onForwardError.mock.calls[0]
    expect(event.body).toBe('{"a":1}')
    expect(error).toBeInstanceOf(Error)
    expect(error.message.length).toBeGreaterThan(0)
  })

  it('still returns 502 when onForwardError throws', async () => {
    const onForwardError = vi.fn(() => {
      throw new Error('callback exploded')
    })
    const fx = await hookLens({ forwardTo: 'http://127.0.0.1:1', onForwardError })

    const res = await postRaw(`${fx.url}/`, '{}')

    expect(res.status).toBe(502)
    expect(res.body).toMatch(/^bad gateway: /)
    expect(onForwardError).toHaveBeenCalledTimes(1)
  })

  it('returns 413 and does not forward when the body exceeds maxBodyBytes', async () => {
    const downstream = await target()
    const fx = await hookLens({ forwardTo: downstream.url, maxBodyBytes: 8 })

    const res = await postRaw(`${fx.url}/`, '{"too":"large"}')

    expect(res.status).toBe(413)
    expect(res.body).toBe('payload too large: max 8 bytes')
    expect(downstream.received).toHaveLength(0)
    expect(fx.storage.list()).toHaveLength(0)
  })

  it('returns 502 when the forward response body exceeds maxForwardResponseBytes', async () => {
    const largeBody = 'x'.repeat(64)
    const downstream = await target(() => ({ status: 200, body: largeBody }))
    const fx = await hookLens({ forwardTo: downstream.url, maxForwardResponseBytes: 32 })

    const res = await postRaw(`${fx.url}/`, '{}')

    expect(res.status).toBe(502)
    expect(res.body).toMatch(/^bad gateway: forward response too large/)
  })

  it('allows forward responses within maxForwardResponseBytes', async () => {
    const downstream = await target(() => ({ status: 200, body: 'short' }))
    const fx = await hookLens({ forwardTo: downstream.url, maxForwardResponseBytes: 32 })

    const res = await postRaw(`${fx.url}/`, '{}')

    expect(res.status).toBe(200)
    expect(res.body).toBe('short')
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

  it('strips headers named by the incoming connection header', () => {
    const out = headersForForwarding({
      Connection: 'keep-alive, x-hop',
      'x-hop': '1',
      'content-type': 'application/json',
    })
    expect(out['Connection']).toBeUndefined()
    expect(out['x-hop']).toBeUndefined()
    expect(out['content-type']).toBe('application/json')
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

describe('createServer - retry', () => {
  it('retries on connection error and eventually returns 502', async () => {
    const onForwardError = vi.fn<(e: WebhookEvent, err: Error) => void>()
    const onForwardRetry =
      vi.fn<(e: WebhookEvent, attempt: number, max: number, err: Error) => void>()

    const fx = await hookLens({
      forwardTo: 'http://127.0.0.1:1',
      retryCount: 2,
      retryBaseDelayMs: 0,
      onForwardError,
      onForwardRetry,
    })

    const res = await postRaw(`${fx.url}/`, '{}')

    expect(res.status).toBe(502)
    expect(res.body).toMatch(/^bad gateway: /)
    expect(onForwardRetry).toHaveBeenCalledTimes(2)
    expect(onForwardRetry.mock.calls[0][1]).toBe(1)
    expect(onForwardRetry.mock.calls[0][2]).toBe(2)
    expect(onForwardRetry.mock.calls[1][1]).toBe(2)
    expect(onForwardRetry.mock.calls[1][2]).toBe(2)
    expect(onForwardError).toHaveBeenCalledTimes(1)
  })

  it('succeeds on a later retry when the target recovers', async () => {
    // Use a raw server so we can destroy the socket on the first request
    // to simulate a connection-level failure that triggers a retry.
    let requestCount = 0
    const rawServer = http.createServer((req, res) => {
      const chunks: Buffer[] = []
      req.on('data', (c: Buffer) => chunks.push(c))
      req.on('end', () => {
        requestCount++
        if (requestCount === 1) {
          // Destroy the socket to simulate a connection-level failure
          req.socket.destroy()
          return
        }
        res.statusCode = 200
        res.end('recovered')
      })
    })
    await new Promise<void>((resolve) => rawServer.listen(0, '127.0.0.1', () => resolve()))

    try {
      const rawAddr = rawServer.address()
      if (!rawAddr || typeof rawAddr === 'string') throw new Error('raw server bad addr')
      const rawUrl = `http://127.0.0.1:${rawAddr.port}`

      const onForwardRetry =
        vi.fn<(e: WebhookEvent, attempt: number, max: number, err: Error) => void>()

      const fx = await hookLens({
        forwardTo: rawUrl,
        retryCount: 2,
        retryBaseDelayMs: 0,
        onForwardRetry,
      })

      const res = await postRaw(`${fx.url}/`, '{"test":true}')

      expect(res.status).toBe(200)
      expect(res.body).toBe('recovered')
      expect(onForwardRetry).toHaveBeenCalledTimes(1)
      expect(requestCount).toBe(2)
    } finally {
      await new Promise<void>((resolve) => rawServer.close(() => resolve()))
    }
  })

  it('does not retry when retryCount is 0', async () => {
    const onForwardRetry =
      vi.fn<(e: WebhookEvent, attempt: number, max: number, err: Error) => void>()

    const fx = await hookLens({
      forwardTo: 'http://127.0.0.1:1',
      retryCount: 0,
      onForwardRetry,
    })

    const res = await postRaw(`${fx.url}/`, '{}')

    expect(res.status).toBe(502)
    expect(onForwardRetry).not.toHaveBeenCalled()
  })

  it('does not retry on 4xx/5xx responses (those are real responses)', async () => {
    const onForwardRetry =
      vi.fn<(e: WebhookEvent, attempt: number, max: number, err: Error) => void>()
    const downstream = await target(() => ({ status: 500, body: 'internal error' }))

    const fx = await hookLens({
      forwardTo: downstream.url,
      retryCount: 3,
      retryBaseDelayMs: 0,
      onForwardRetry,
    })

    const res = await postRaw(`${fx.url}/`, '{}')

    expect(res.status).toBe(500)
    expect(res.body).toBe('internal error')
    expect(onForwardRetry).not.toHaveBeenCalled()
    expect(downstream.received).toHaveLength(1)
  })

  it('isolates a broken onForwardRetry callback', async () => {
    const onForwardRetry = vi.fn(() => {
      throw new Error('callback exploded')
    })

    const fx = await hookLens({
      forwardTo: 'http://127.0.0.1:1',
      retryCount: 1,
      retryBaseDelayMs: 0,
      onForwardRetry,
    })

    const res = await postRaw(`${fx.url}/`, '{}')

    expect(res.status).toBe(502)
    expect(onForwardRetry).toHaveBeenCalledTimes(1)
  })
})
