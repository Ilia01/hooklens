# `hooklens list`

Show stored webhook events from the local SQLite database.

## Usage

```bash
hooklens list [options]
```

## Flags

| Flag                  | Default | Description              |
| --------------------- | ------- | ------------------------ |
| `-n, --limit <count>` | `20`    | Number of events to show |

## Examples

```bash
hooklens list
hooklens list -n 5
```

## Output

Each row contains:

- timestamp
- HTTP method
- event ID
- request path

If there are no stored events, HookLens prints `No stored events.`
