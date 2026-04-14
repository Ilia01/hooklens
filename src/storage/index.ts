import os from 'node:os'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type * as sqlite from 'node:sqlite'
import {
  eventRowSchema,
  tryDecodeUtf8,
  verificationResultSchema,
  webhookEventSchema,
  type EventRow,
  type WebhookEvent,
} from '../types.js'

const require = createRequire(import.meta.url)

// tsup/esbuild currently rewrites a static `node:sqlite` import to `sqlite`,
// which breaks the built CLI. Resolve it at runtime so the core module specifier
// survives the bundle unchanged.
const { DatabaseSync } = require('node:' + 'sqlite') as typeof sqlite

export function defaultDbPath(): string {
  return path.join(os.homedir(), '.hooklens', 'events.db')
}

interface TableColumnInfo {
  name: string
  notnull: 0 | 1
}

function eventColumns(db: sqlite.DatabaseSync): Map<string, TableColumnInfo> {
  const rows = db.prepare(`PRAGMA table_info(events)`).all() as unknown as TableColumnInfo[]
  return new Map(rows.map((row) => [row.name, row]))
}

function migrateEventsTable(db: sqlite.DatabaseSync): void {
  const columns = eventColumns(db)

  if (!columns.has('body_raw')) {
    db.exec(`ALTER TABLE events ADD COLUMN body_raw BLOB`)
  }

  if (!columns.has('verification')) {
    db.exec(`ALTER TABLE events ADD COLUMN verification TEXT`)
  }

  if (!columns.has('body')) {
    db.exec(`ALTER TABLE events ADD COLUMN body TEXT`)
  }

  if (columns.has('body_text')) {
    db.exec(`
      UPDATE events
      SET body = COALESCE(body, body_text)
      WHERE body_text IS NOT NULL
    `)
  }
}

function rowToEvent(row: EventRow): WebhookEvent {
  const verification = row.verification
    ? verificationResultSchema.parse(JSON.parse(row.verification))
    : null
  const bodyRaw = row.body_raw ?? Buffer.from(row.body ?? '', 'utf8')
  const bodyText = row.body_raw ? tryDecodeUtf8(row.body_raw) : (row.body ?? '')
  return webhookEventSchema.parse({
    id: row.id,
    timestamp: row.timestamp,
    method: row.method,
    path: row.path,
    headers: JSON.parse(row.headers),
    bodyRaw,
    bodyText,
    bodyExact: row.body_raw !== null && row.body_raw !== undefined,
    verification,
  })
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
      body TEXT,
      body_raw BLOB,
      verification TEXT
    )
  `)

  migrateEventsTable(db)

  const insertStmt = db.prepare(
    `INSERT OR REPLACE INTO events (id, timestamp, method, path, headers, body, body_raw, verification)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  const getStmt = db.prepare(`SELECT * FROM events WHERE id = ?`)
  const listAllStmt = db.prepare(`SELECT * FROM events ORDER BY timestamp DESC`)
  const listLimitedStmt = db.prepare(`SELECT * FROM events ORDER BY timestamp DESC LIMIT ?`)
  const deleteStmt = db.prepare(`DELETE FROM events WHERE id = ?`)
  const clearStmt = db.prepare(`DELETE FROM events`)

  return {
    save(event: WebhookEvent): void {
      insertStmt.run(
        event.id,
        event.timestamp,
        event.method,
        event.path,
        JSON.stringify(event.headers),
        event.bodyText ?? '',
        event.bodyRaw,
        event.verification ? JSON.stringify(event.verification) : null,
      )
    },

    load(id: string): WebhookEvent | null {
      const raw = getStmt.get(id)
      if (!raw) return null
      const row = eventRowSchema.parse(raw)
      return rowToEvent(row)
    },

    list(limit?: number): WebhookEvent[] {
      if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
        throw new Error(`Invalid limit: must be a positive integer, got ${limit}`)
      }
      const raw = limit === undefined ? listAllStmt.all() : listLimitedStmt.all(limit)
      const rows = raw.map((r) => eventRowSchema.parse(r))
      return rows.map(rowToEvent)
    },

    delete(id: string): boolean {
      const result = deleteStmt.run(id)
      return result.changes > 0
    },

    clear(): number {
      const result = clearStmt.run()
      return Number(result.changes)
    },

    close(): void {
      db.close()
    },
  }
}
