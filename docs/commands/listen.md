# `hooklens listen`

Start the local HTTP capture server.

## Usage

```bash
hooklens listen [options]
```

## Flags

| Flag                  | Default | Description                                            |
| --------------------- | ------- | ------------------------------------------------------ |
| `-p, --port <port>`   | `4400`  | Port to bind on `127.0.0.1`                            |
| `--verify <provider>` | none    | Enable signature verification for `stripe` or `github` |
| `--secret <secret>`   | none    | Provider signing secret                                |
| `--forward-to <url>`  | none    | Forward captured requests to a downstream URL          |
| `--retry <count>`     | `0`     | Retry failed forwards with exponential backoff         |

## Examples

Listen only:

```bash
hooklens listen
```

Listen and forward:

```bash
hooklens listen -p 8080 --forward-to http://localhost:3000/webhook
```

Verify Stripe:

```bash
hooklens listen --verify stripe --secret whsec_xxx
```

Verify GitHub:

```bash
hooklens listen --verify github --secret ghsecret_xxx
```

## What it prints

Startup output includes:

- bound address
- selected verifier
- forwarding target
- SQLite storage path

Per-event output includes:

- `RECV` if verification is disabled
- `PASS` if verification succeeds
- `FAIL` with the verification message if it does not

Forwarding failures are printed separately with an `FWD` prefix.

Retry attempts (when `--retry` is set) are printed with a `RETRY` prefix, showing the attempt number and reason.

## Notes

- The listener binds to `127.0.0.1` only.
- Request bodies are buffered in memory and currently capped at 1 MiB.
- If forwarding is enabled and the downstream target fails, HookLens returns `502 bad gateway` to the original caller.
