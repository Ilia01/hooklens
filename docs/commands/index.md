# Commands

HookLens currently exposes three CLI commands:

| Command                      | Purpose                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------ |
| `hooklens listen`            | Receive webhooks locally, verify them, store them, and optionally forward them |
| `hooklens list`              | Show stored webhook events                                                     |
| `hooklens replay <event-id>` | Re-send a stored event to a target URL                                         |

## Typical workflow

```bash
hooklens listen --verify stripe --secret whsec_xxx --forward-to http://localhost:3000/webhook
hooklens list
hooklens replay evt_abc123 --to http://localhost:3000/webhook
```

## Command reference

- [listen](/commands/listen)
- [list](/commands/list)
- [replay](/commands/replay)
