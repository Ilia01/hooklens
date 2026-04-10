# `hooklens inspect`

View full details of a stored webhook event.

## Usage

```bash
hooklens inspect <event-id> [options]
```

## Flags

| Flag     | Default | Description    |
| -------- | ------- | -------------- |
| `--json` | —       | Output as JSON |

## Examples

```bash
hooklens inspect evt_abc123
hooklens inspect evt_abc123 --json
```

## Behavior

Loads the stored event from the local SQLite database and prints its full details — headers, body, method, path, timestamp, and verification status.

With `--json`, the event is written to stdout as a single JSON line, which is useful for piping into other tools.

If the event ID does not exist, the command prints an error and exits with a non-zero status.
