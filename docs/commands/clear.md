# `hooklens clear`

Delete all stored webhook events.

## Usage

```bash
hooklens clear [options]
```

## Flags

| Flag    | Default | Description              |
| ------- | ------- | ------------------------ |
| `--yes` | `false` | Skip confirmation prompt |

## Examples

Skip the confirmation prompt:

```bash
hooklens clear --yes
```

Interactive confirmation:

```bash
hooklens clear
```

## Behavior

Deletes every event from the local SQLite database. Without the `--yes` flag, an interactive confirmation prompt is shown to prevent accidental data loss.

On success, prints the number of deleted events:

```
Cleared 42 events
```
