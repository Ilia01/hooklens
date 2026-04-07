import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { eventRowSchema, type EventRow, type WebhookEvent } from '../types.js'

function rowToEvent(row: EventRow): WebhookEvent {
  return {
    id: row.id,
    timestamp: row.timestamp,
    method: row.method,
    path: row.path,
    headers: JSON.parse(row.headers),
    body: row.body,
  }
}

export function createStorage(dbPath: string) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      headers TEXT NOT NULL,
      body TEXT NOT NULL
    )
  `)

  const insertStmt = db.prepare(
    `INSERT OR REPLACE INTO events (id, timestamp, method, path, headers, body)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )

  const getStmt = db.prepare(`SELECT * FROM events WHERE id = ?`)
  const listAllStmt = db.prepare(`SELECT * FROM events ORDER BY timestamp DESC`)
  const listLimitedStmt = db.prepare(`SELECT * FROM events ORDER BY timestamp DESC LIMIT ?`)
  const clearStmt = db.prepare(`DELETE FROM events`)

  return {
    save(event: WebhookEvent): void {
      insertStmt.run(
        event.id,
        event.timestamp,
        event.method,
        event.path,
        JSON.stringify(event.headers),
        event.body,
      )
    },

    load(id: string): WebhookEvent | null {
      const raw = getStmt.get(id)
      if (!raw) return null
      const row = eventRowSchema.parse(raw)
      return rowToEvent(row)
    },

    list(limit?: number): WebhookEvent[] {
      const raw = limit === undefined ? listAllStmt.all() : listLimitedStmt.all(limit)
      const rows = raw.map((r) => eventRowSchema.parse(r))
      return rows.map(rowToEvent)
    },

    clear(): void {
      clearStmt.run()
    },

    close(): void {
      db.close()
    },
  }
}
