# Commands

HookLens currently exposes five CLI commands:

| Command                      | Purpose                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `hooklens listen`            | Receive webhooks locally, verify them, store them, and optionally forward them |
| `hooklens list`              | Show stored webhook events                                                     |
| `hooklens replay <event-id>` | Re-send a stored event to a target URL                                         |
| `hooklens delete <event-id>` | Delete a single stored event                                                   |
| `hooklens clear`             | Delete all stored events                                                       |

## Typical workflow

```bash
hooklens listen --verify stripe --secret whsec_xxx --forward-to http://localhost:3000/webhook
hooklens list
hooklens replay evt_abc123 --to http://localhost:3000/webhook
hooklens delete evt_abc123
hooklens clear --yes
```

## Command reference

- [listen](/commands/listen)
- [list](/commands/list)
- [replay](/commands/replay)
- [delete](/commands/delete)
- [clear](/commands/clear)
