import http from 'node:http'
import crypto from 'node:crypto'
import { errorMessage, toError } from '../errors.js'
import type { ReplayResult, VerificationResult, Verifier, WebhookEvent } from '../types.js'
import type { createStorage } from '../storage/index.js'

type Storage = ReturnType<typeof createStorage>

export interface ServerOptions {
  port: number
  storage: Storage
  verifier?: Verifier
  forwardTo?: string
  forwardTimeoutMs?: number
  maxBodyBytes?: number
  onEvent?: (event: WebhookEvent, result: VerificationResult | null) => void
  onForwardError?: (event: WebhookEvent, error: Error) => void
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

const DEFAULT_MAX_BODY_BYTES = 1024 * 1024
const DEFAULT_FORWARD_TIMEOUT_MS = 5000

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

class PayloadTooLargeError extends Error {
  constructor(readonly maxBytes: number) {
    super(`payload too large: max ${maxBytes} bytes`)
    this.name = 'PayloadTooLargeError'
  }
}

function isPayloadTooLargeError(error: unknown): error is PayloadTooLargeError {
  return error instanceof PayloadTooLargeError
}

function requestSockets(req: http.IncomingMessage): NodeJS.EventEmitter[] {
  const sockets = new Set<NodeJS.EventEmitter>()
  sockets.add(req.socket)
  const proxiedSocket = (req.socket as typeof req.socket & { proxy?: NodeJS.EventEmitter | null })
    .proxy
  if (proxiedSocket) sockets.add(proxiedSocket)
  return [...sockets]
}

export function readBody(req: http.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0
    let settled = false
    const sockets = requestSockets(req)

    const cleanup = () => {
      req.off('data', onData)
      req.off('end', onEnd)
      req.off('error', onError)
      for (const socket of sockets) {
        socket.off('close', onSocketClose)
        socket.off('error', onSocketError)
      }
    }

    const rejectOnce = (error: Error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const resolveOnce = (body: string) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(body)
    }

    const onData = (chunk: Buffer) => {
      totalBytes += chunk.length
      if (totalBytes > maxBytes) {
        req.resume()
        rejectOnce(new PayloadTooLargeError(maxBytes))
        return
      }
      chunks.push(chunk)
    }

    const onEnd = () => resolveOnce(Buffer.concat(chunks, totalBytes).toString('utf8'))
    const onError = (error: Error) => rejectOnce(error)
    const onSocketClose = () => rejectOnce(new Error('socket closed during request body'))
    const onSocketError = (error: Error) => rejectOnce(error)

    req.on('data', onData)
    req.on('end', onEnd)
    req.on('error', onError)
    for (const socket of sockets) {
      socket.on('close', onSocketClose)
      socket.on('error', onSocketError)
    }
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

interface ParsedEventPath {
  pathname: string
  search: string
}

function forwardPathname(targetPathname: string, incomingPathname: string): string {
  if (targetPathname === '/' || targetPathname === '') return incomingPathname || '/'
  if (incomingPathname === '/' || incomingPathname === '') return targetPathname
  const base = targetPathname.endsWith('/') ? targetPathname.slice(0, -1) : targetPathname
  const incoming = incomingPathname.startsWith('/') ? incomingPathname : `/${incomingPathname}`
  return `${base}${incoming}`
}

export function parseEventPath(path: string): ParsedEventPath {
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(path)) {
    const parsed = new URL(path)
    return { pathname: parsed.pathname, search: parsed.search }
  }

  const queryIndex = path.indexOf('?')
  if (queryIndex === -1) {
    return { pathname: path, search: '' }
  }

  return {
    pathname: path.slice(0, queryIndex),
    search: path.slice(queryIndex),
  }
}

function mergeForwardSearch(targetSearch: string, incomingSearch: string): string {
  const merged = new URLSearchParams(incomingSearch)
  const trusted = new URLSearchParams(targetSearch)

  for (const key of new Set(trusted.keys())) {
    merged.delete(key)
  }
  for (const [key, value] of trusted) {
    merged.append(key, value)
  }

  const search = merged.toString()
  return search.length > 0 ? `?${search}` : ''
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export async function forwardEvent(
  targetUrl: string,
  event: WebhookEvent,
  timeoutMs = DEFAULT_FORWARD_TIMEOUT_MS,
): Promise<ReplayResult> {
  const target = new URL(targetUrl)
  const destination = new URL(target.href)
  const parsedEventPath = parseEventPath(event.path)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  destination.pathname = forwardPathname(destination.pathname, parsedEventPath.pathname)
  destination.search = mergeForwardSearch(destination.search, parsedEventPath.search)

  try {
    const hasBody = event.method !== 'GET' && event.method !== 'HEAD'
    const response = await fetch(destination, {
      method: event.method,
      headers: headersForForwarding(event.headers),
      body: hasBody ? event.body : undefined,
      signal: controller.signal,
    })

    return {
      status: response.status,
      body: await response.text(),
    }
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`forward timed out after ${timeoutMs}ms`)
    }
    // fetch() wraps the real error (e.g. ECONNREFUSED) inside error.cause.
    // AggregateError (localhost resolving to both IPv6 and IPv4) has an empty
    // message but a useful code property. Fall back through each layer.
    const cause = error instanceof Error ? error.cause : undefined
    const code = cause instanceof Error ? (cause as NodeJS.ErrnoException).code : undefined
    const message = cause instanceof Error && cause.message ? cause.message : code
    throw new Error(message ?? errorMessage(error))
  } finally {
    clearTimeout(timeout)
  }
}

export function createServer(opts: ServerOptions): Server {
  let boundPort = opts.port
  let httpServer: http.Server | null = null
  let isStarting = false
  const maxBodyBytes = opts.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
  const forwardTimeoutMs = opts.forwardTimeoutMs ?? DEFAULT_FORWARD_TIMEOUT_MS

  const handleRequest = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> => {
    const body = await readBody(req, maxBodyBytes)

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
      const forwarded = await forwardEvent(opts.forwardTo, event, forwardTimeoutMs)
      res.statusCode = forwarded.status
      res.end(forwarded.body)
    } catch (error) {
      const err = toError(error)
      try {
        opts.onForwardError?.(event, err)
      } catch {
        // Don't let a broken callback turn a 502 into a 500.
      }
      res.statusCode = 502
      res.end(`bad gateway: ${err.message}`)
    }
  }

  return {
    get port() {
      return boundPort
    },

    async start() {
      if (httpServer || isStarting) {
        throw new Error('server already started')
      }

      isStarting = true
      const server = http.createServer((req, res) => {
        handleRequest(req, res).catch((err: unknown) => {
          if (isPayloadTooLargeError(err)) {
            res.statusCode = 413
            res.end(err.message)
            return
          }
          res.statusCode = 500
          res.end(errorMessage(err))
        })
      })
      httpServer = server

      try {
        await new Promise<void>((resolve, reject) => {
          const onError = (err: Error) => {
            server.off('error', onError)
            if (httpServer === server) httpServer = null
            boundPort = opts.port
            isStarting = false
            reject(err)
          }

          server.once('error', onError)
          server.listen(opts.port, '127.0.0.1', () => {
            server.off('error', onError)
            const addr = server.address()
            if (addr && typeof addr !== 'string') {
              boundPort = addr.port
            }
            isStarting = false
            resolve()
          })
        })
      } catch (err) {
        if (httpServer === server) httpServer = null
        boundPort = opts.port
        isStarting = false
        throw err
      }
    },

    async stop() {
      if (!httpServer) return
      const server = httpServer
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (httpServer === server) httpServer = null
          boundPort = opts.port
          isStarting = false
          if (err) {
            reject(err)
            return
          }
          resolve()
        })
      })
    },
  }
}
