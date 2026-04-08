import http from 'node:http'
import crypto from 'node:crypto'
import type { VerificationResult, Verifier, WebhookEvent } from '../types.js'
import type { createStorage } from '../storage/index.js'

type Storage = ReturnType<typeof createStorage>

export interface ServerOptions {
  port: number
  storage: Storage
  verifier?: Verifier
  forwardTo?: string
  onEvent?: (event: WebhookEvent, result: VerificationResult | null) => void
}

export interface Server {
  readonly port: number
  start(): Promise<void>
  stop(): Promise<void>
}

// Headers we strip before forwarding. This is the RFC 7230 section 6.1
// hop-by-hop list plus host (fetch sets this from the destination URL) and
// content-length (fetch recomputes this from the body).
const FORWARD_STRIP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

function forwardedStripSet(headers: Record<string, string>): Set<string> {
  const strip = new Set(FORWARD_STRIP)
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== 'connection') continue
    for (const token of value.split(/[,\s]+/)) {
      const name = token.trim().toLowerCase()
      if (name) strip.add(name)
    }
  }
  return strip
}

function generateEventId(): string {
  return `evt_${crypto.randomBytes(12).toString('base64url')}`
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function headersToRecord(headers: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue
    out[key] = Array.isArray(value) ? value.join(', ') : value
  }
  return out
}

export function headersForForwarding(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  const strip = forwardedStripSet(headers)
  for (const [key, value] of Object.entries(headers)) {
    if (!strip.has(key.toLowerCase())) out[key] = value
  }
  return out
}

interface ForwardResult {
  status: number
  body: string
}

function forwardPathname(targetPathname: string, incomingPathname: string): string {
  if (targetPathname === '/' || targetPathname === '') return incomingPathname || '/'
  if (incomingPathname === '/' || incomingPathname === '') return targetPathname
  const base = targetPathname.endsWith('/') ? targetPathname.slice(0, -1) : targetPathname
  const incoming = incomingPathname.startsWith('/') ? incomingPathname : `/${incomingPathname}`
  return `${base}${incoming}`
}

async function forwardEvent(targetUrl: string, event: WebhookEvent): Promise<ForwardResult> {
  const target = new URL(targetUrl)
  const destination = new URL(target.href)
  const parsedEventPath = new URL(event.path, 'http://hooklens.invalid')
  destination.pathname = forwardPathname(target.pathname, parsedEventPath.pathname)
  destination.search = parsedEventPath.search
  const hasBody = event.method !== 'GET' && event.method !== 'HEAD'
  const response = await fetch(destination, {
    method: event.method,
    headers: headersForForwarding(event.headers),
    body: hasBody ? event.body : undefined,
  })
  return {
    status: response.status,
    body: await response.text(),
  }
}

export function createServer(opts: ServerOptions): Server {
  let boundPort = opts.port
  let httpServer: http.Server | null = null

  const handleRequest = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> => {
    const body = await readBody(req)

    const event: WebhookEvent = {
      id: generateEventId(),
      timestamp: new Date().toISOString(),
      method: req.method ?? 'GET',
      path: req.url ?? '/',
      headers: headersToRecord(req.headers),
      body,
    }

    opts.storage.save(event)
    const verification = opts.verifier?.verify({ headers: event.headers, body: event.body }) ?? null
    opts.onEvent?.(event, verification)

    if (!opts.forwardTo) {
      res.statusCode = 200
      res.end('ok')
      return
    }

    try {
      const forwarded = await forwardEvent(opts.forwardTo, event)
      res.statusCode = forwarded.status
      res.end(forwarded.body)
    } catch {
      res.statusCode = 502
      res.end('bad gateway')
    }
  }

  return {
    get port() {
      return boundPort
    },

    async start() {
      httpServer = http.createServer((req, res) => {
        handleRequest(req, res).catch((err: unknown) => {
          res.statusCode = 500
          res.end(err instanceof Error ? err.message : String(err))
        })
      })

      await new Promise<void>((resolve, reject) => {
        const server = httpServer!
        server.once('error', reject)
        server.listen(opts.port, '127.0.0.1', () => {
          const addr = server.address()
          if (addr && typeof addr !== 'string') {
            boundPort = addr.port
          }
          resolve()
        })
      })
    },

    async stop() {
      if (!httpServer) return
      const server = httpServer
      httpServer = null
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      })
    },
  }
}
