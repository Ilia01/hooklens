# `hooklens replay`

Replay a stored event to a target URL.

## Usage

```bash
hooklens replay <event-id> [options]
```

## Flags

| Flag         | Default                         | Description               |
| ------------ | ------------------------------- | ------------------------- |
| `--to <url>` | `http://localhost:3000/webhook` | Target URL for the replay |

## Examples

Replay to the default target:

```bash
hooklens replay evt_abc123
```

Replay to a custom target:

```bash
hooklens replay evt_abc123 --to http://localhost:8080/hook
```

## Behavior

Replay loads the stored event from SQLite and sends:

- the original HTTP method
- the original headers, minus stripped hop-by-hop forwarding headers
- the original request body

The CLI prints the downstream response status and a short body preview up to 200 characters.

If the event ID is missing or the replay target fails, the command exits with a non-zero status and prints an actionable error message.
