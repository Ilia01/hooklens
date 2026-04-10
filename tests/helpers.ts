import { vi } from 'vitest'
import type { TerminalUI } from '../src/ui/terminal.js'

export interface FakeStorage {
  save: ReturnType<typeof vi.fn>
  load: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

export function fakeStorage(): FakeStorage {
  return {
    save: vi.fn(),
    load: vi.fn(),
    list: vi.fn(() => []),
    delete: vi.fn(() => false),
    clear: vi.fn(() => 0),
    close: vi.fn(),
  }
}

export function fakeTerminal(): TerminalUI {
  return {
    printListenStarted: vi.fn(),
    printEventCaptured: vi.fn(),
    printForwardError: vi.fn(),
    printEventList: vi.fn(),
    printEventDetail: vi.fn(),
    printReplayResult: vi.fn(),
    printDeleted: vi.fn(),
    printCleared: vi.fn(),
    printListenStopped: vi.fn(),
    printError: vi.fn(),
  }
}
