import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createStorage } from '../src/storage/index.js'
import type { WebhookEvent } from '../src/types.js'

function makeEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    id: 'evt_001',
    timestamp: '2026-04-06T12:00:00.000Z',
    method: 'POST',
    path: '/webhook',
    headers: { 'content-type': 'application/json' },
    body: '{"type":"checkout.session.completed"}',
    ...overrides,
  }
}

let testDir: string
let dbPath: string
let storage: ReturnType<typeof createStorage>

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hooklens-test-'))
  dbPath = path.join(testDir, 'events.db')
  storage = createStorage(dbPath)
})

afterEach(() => {
  storage.close()
  fs.rmSync(testDir, { recursive: true, force: true })
})

// Inject a row directly into SQLite, bypassing the storage API.
// Used to simulate on-disk corruption.
function injectRawRow(row: {
  id: string
  timestamp: string
  method: string
  path: string
  headers: string
  body: string
}): void {
  storage.close()
  const db = new DatabaseSync(dbPath)
  db.prepare(
    `INSERT INTO events (id, timestamp, method, path, headers, body) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.timestamp, row.method, row.path, row.headers, row.body)
  db.close()
  storage = createStorage(dbPath)
}

describe('save', () => {
  it('saves an event without throwing', () => {
    const event = makeEvent()
    expect(() => storage.save(event)).not.toThrow()
  })
})

describe('load', () => {
  it('loads a saved event by ID', () => {
    storage.save(makeEvent())

    const loaded = storage.load('evt_001')

    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe('evt_001')
    expect(loaded!.method).toBe('POST')
    expect(loaded!.body).toBe('{"type":"checkout.session.completed"}')
  })

  it('returns the headers as an object', () => {
    storage.save(makeEvent())

    const loaded = storage.load('evt_001')

    expect(loaded!.headers).toEqual({ 'content-type': 'application/json' })
  })

  it('returns null for a non-existent event', () => {
    const loaded = storage.load('evt_doesnt_exist')
    expect(loaded).toBeNull()
  })

  it('round-trips a verification result when present', () => {
    const verification = {
      valid: true,
      provider: 'github',
      message: 'signature matches',
      code: 'valid' as const,
    }
    storage.save(makeEvent({ verification }))

    const loaded = storage.load('evt_001')

    expect(loaded!.verification).toEqual(verification)
  })

  it('returns null verification when none was stored', () => {
    storage.save(makeEvent())

    const loaded = storage.load('evt_001')

    expect(loaded!.verification).toBeNull()
  })
})

describe('list', () => {
  it('returns an empty array when no events exist', () => {
    const events = storage.list()
    expect(events).toEqual([])
  })

  it('returns events sorted newest first', () => {
    storage.save(makeEvent({ id: 'evt_old', timestamp: '2026-04-06T10:00:00.000Z' }))
    storage.save(makeEvent({ id: 'evt_new', timestamp: '2026-04-06T12:00:00.000Z' }))

    const events = storage.list()

    expect(events).toHaveLength(2)
    expect(events[0].id).toBe('evt_new')
    expect(events[1].id).toBe('evt_old')
  })

  it('respects the limit option', () => {
    storage.save(makeEvent({ id: 'evt_1', timestamp: '2026-04-06T10:00:00.000Z' }))
    storage.save(makeEvent({ id: 'evt_2', timestamp: '2026-04-06T11:00:00.000Z' }))
    storage.save(makeEvent({ id: 'evt_3', timestamp: '2026-04-06T12:00:00.000Z' }))

    const events = storage.list(2)

    expect(events).toHaveLength(2)
    expect(events[0].id).toBe('evt_3')
    expect(events[1].id).toBe('evt_2')
  })

  it.each([0, -1, 1.5, Number.NaN])('throws when limit is %s', (badLimit) => {
    expect(() => storage.list(badLimit)).toThrow(/limit/i)
  })
})

describe('corruption', () => {
  it('throws when load encounters malformed headers JSON', () => {
    injectRawRow({
      id: 'evt_bad',
      timestamp: '2026-04-06T12:00:00.000Z',
      method: 'POST',
      path: '/webhook',
      headers: '{not json',
      body: '{}',
    })

    expect(() => storage.load('evt_bad')).toThrow()
  })

  it('throws when load encounters headers with the wrong shape', () => {
    injectRawRow({
      id: 'evt_bad_shape',
      timestamp: '2026-04-06T12:00:00.000Z',
      method: 'POST',
      path: '/webhook',
      headers: JSON.stringify([1, 2, 3]),
      body: '{}',
    })

    expect(() => storage.load('evt_bad_shape')).toThrow()
  })

  it('throws when list encounters a corrupt row', () => {
    storage.save(makeEvent())
    injectRawRow({
      id: 'evt_bad',
      timestamp: '2026-04-06T13:00:00.000Z',
      method: 'POST',
      path: '/webhook',
      headers: '{not json',
      body: '{}',
    })

    expect(() => storage.list()).toThrow()
  })
})

describe('clear', () => {
  it('removes all stored events', () => {
    storage.save(makeEvent({ id: 'evt_1' }))
    storage.save(makeEvent({ id: 'evt_2' }))

    storage.clear()

    const events = storage.list()
    expect(events).toEqual([])
  })
})
