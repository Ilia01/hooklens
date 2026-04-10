import os from 'node:os'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import type * as sqlite from 'node:sqlite'
import {
  eventRowSchema,
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

function rowToEvent(row: EventRow): WebhookEvent {
  const verification = row.verification
    ? verificationResultSchema.parse(JSON.parse(row.verification))
    : null
  return webhookEventSchema.parse({
    id: row.id,
    timestamp: row.timestamp,
    method: row.method,
    path: row.path,
    headers: JSON.parse(row.headers),
    body: row.body,
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
      body TEXT NOT NULL,
      verification TEXT
    )
  `)

  // Add verification column to existing databases that lack it.
  try {
    db.exec(`ALTER TABLE events ADD COLUMN verification TEXT`)
  } catch {
    // Column already exists – ignore.
  }

  const insertStmt = db.prepare(
    `INSERT OR REPLACE INTO events (id, timestamp, method, path, headers, body, verification)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
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

    clear(): void {
      clearStmt.run()
    },

    close(): void {
      db.close()
    },
  }
}
