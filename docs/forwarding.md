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

## Response passthrough

If the downstream target responds successfully, HookLens forwards that status code and response body back to the original caller.
