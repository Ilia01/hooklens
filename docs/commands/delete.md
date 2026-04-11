# `hooklens delete`

Delete a single stored webhook event by ID.

## Usage

```bash
hooklens delete <id>
```

## Examples

```bash
hooklens delete evt_abc123
```

## Behavior

Deletes the event with the given ID from the local SQLite database.

On success, prints:

```
Deleted evt_abc123
```

If the event does not exist, the command prints an error and exits with a non-zero status.
