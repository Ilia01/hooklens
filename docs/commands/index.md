# Commands

HookLens currently exposes six CLI commands:

| Command                 | Purpose                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| `hooklens listen`       | Receive webhooks locally, verify them, store them, and optionally forward them |
| `hooklens list`         | Show stored webhook events                                                     |
| `hooklens inspect <id>` | View full details of a stored event                                            |
| `hooklens replay <id>`  | Re-send a stored event to a target URL                                         |
| `hooklens delete <id>`  | Delete a single stored event                                                   |
| `hooklens clear`        | Delete all stored events                                                       |

## Typical workflow

```bash
hooklens listen --verify stripe --secret whsec_xxx --forward-to http://localhost:3000/webhook
hooklens list
hooklens inspect evt_abc123
hooklens replay evt_abc123 --to http://localhost:3000/webhook
hooklens delete evt_abc123
hooklens clear --yes
```

## Command reference

- [listen](/commands/listen)
- [list](/commands/list)
- [inspect](/commands/inspect)
- [replay](/commands/replay)
- [delete](/commands/delete)
- [clear](/commands/clear)
