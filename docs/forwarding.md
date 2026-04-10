# Forwarding

Forwarding lets HookLens verify and store an incoming webhook before sending it on to your local app.

## Basic usage

```bash
hooklens listen --forward-to http://localhost:3000/webhook
```

You can combine this with verification:

```bash
hooklens listen \
  --verify stripe \
  --secret whsec_xxx \
  --forward-to http://localhost:3000/webhook
```

## Target URL behavior

HookLens treats `--forward-to` as the trusted base URL.

That means:

- the downstream origin always comes from `--forward-to`
- an incoming absolute-form path cannot override the trusted host or protocol
- a base path on `--forward-to` is preserved

Example:

- forward target: `http://localhost:3000/webhook`
- incoming path: `/events/stripe?mode=test`

Forwarded destination:

- `http://localhost:3000/webhook/events/stripe?mode=test`

## Query string merging

Trusted query params from the configured target are preserved and win on conflicts.

Example:

- forward target: `http://localhost:3000/webhook?token=trusted`
- incoming path: `/events?token=untrusted&mode=test`

Forwarded destination:

- `http://localhost:3000/webhook/events?mode=test&token=trusted`

## Header handling

HookLens strips hop-by-hop headers before forwarding, including:

- `connection`
- `keep-alive`
- `transfer-encoding`
- `upgrade`
- `host`
- `content-length`

It also parses the incoming `Connection` header and removes any header names listed there from the forwarded request.

## Timeouts and errors

- Forwarding uses a 5-second timeout by default
- Timeout or network failure results in `502 bad gateway`
- The CLI prints a `FWD` line with the event ID and error reason
- A broken `onForwardError` callback is isolated so it cannot turn a forward failure into a server-side `500`

## Retries

By default, HookLens does not retry failed forwards. Pass `--retry <count>` to enable automatic retries with exponential backoff:

```bash
hooklens listen --forward-to http://localhost:3000/webhook --retry 3
```

Retry behavior:

- Only connection-level errors are retried (`ECONNREFUSED`, `ETIMEDOUT`, DNS failures, timeouts). HTTP 4xx/5xx responses are **not** retried — those are real responses from the target.
- Backoff schedule: 100 ms, 400 ms, 1.6 s, … (each delay is multiplied by 4).
- Each retry attempt is printed with a `RETRY` prefix so you can see what is happening.
- After all retries are exhausted, HookLens returns `502 bad gateway` and fires the `FWD` error line.

::: warning Idempotency caveat
Retries can cause the target to receive the same webhook more than once. Make sure your webhook handler is **idempotent** — it should safely handle duplicate deliveries without double-processing side effects.
:::

## Response passthrough

If the downstream target responds successfully, HookLens forwards that status code and response body back to the original caller.
