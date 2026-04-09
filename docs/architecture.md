# Architecture

HookLens is small on purpose. The main seams are the CLI, the HTTP server, storage, and the verifier interface.

## Flow

1. `hooklens listen` builds a verifier from CLI flags
2. The server binds to `127.0.0.1`
3. Incoming requests are buffered into a `WebhookEvent`
4. The event is saved to SQLite
5. The verifier runs, if configured
6. The terminal UI prints the result
7. The request is optionally forwarded downstream

## The event shape

The in-memory event contract is:

```ts
{
  id: string
  timestamp: string
  method: string
  path: string
  headers: Record<string, string>
  body: string
}
```

On disk, headers are stored as a JSON string and parsed back into the event shape on read.

## Storage

Storage uses the built-in `node:sqlite` module and writes to:

```text
~/.hooklens/events.db
```

The storage layer exposes four operations:

- `save(event)`
- `load(id)`
- `list(limit?)`
- `clear()`

## Verifier seam

The server is intentionally provider-agnostic. It receives an optional `Verifier` and only asks it to validate `{ headers, body }`.

That keeps provider logic out of the transport layer and makes new providers cheap to add.

## Forwarding seam

Forwarding is implemented separately from request capture and is also reused by `hooklens replay`.

The exported `forwardEvent()` helper is responsible for:

- building the trusted destination URL
- stripping forwarding headers
- applying the timeout
- returning downstream status and body

## Terminal UI seam

The CLI commands call a small `TerminalUI` interface for output. That keeps the long-running runtime code testable without having to inspect raw stdout everywhere.
