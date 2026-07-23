import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sessionState, marketState } from '../src/lib/market.js'

test('normal weekday session states', () => {
  assert.equal(sessionState({ iso: '2026-07-22', weekday: 'Wed', mins: 8 * 60 }).label, 'PRE-MKT')
  assert.deepEqual(sessionState({ iso: '2026-07-22', weekday: 'Wed', mins: 10 * 60 }), { open: true, label: 'MKT OPEN' })
  assert.equal(sessionState({ iso: '2026-07-22', weekday: 'Wed', mins: 16 * 60 + 1 }).label, 'AFT-MKT')
  assert.equal(sessionState({ iso: '2026-07-22', weekday: 'Wed', mins: 9 * 60 + 29 }).open, false)
  assert.equal(sessionState({ iso: '2026-07-22', weekday: 'Wed', mins: 9 * 60 + 30 }).open, true)
})

test('weekends closed', () => {
  assert.equal(sessionState({ iso: '2026-07-25', weekday: 'Sat', mins: 12 * 60 }).open, false)
})

test('full holidays closed with names', () => {
  const s = sessionState({ iso: '2026-11-26', weekday: 'Thu', mins: 11 * 60 })
  assert.equal(s.open, false)
  assert.equal(s.label, 'THANKSGIVING')
  assert.equal(sessionState({ iso: '2026-07-03', weekday: 'Fri', mins: 11 * 60 }).label, 'JULY 4TH (OBS)')
})

test('early close: open until 13:00, closed after', () => {
  assert.equal(sessionState({ iso: '2026-11-27', weekday: 'Fri', mins: 12 * 60 + 59 }).open, true)
  assert.equal(sessionState({ iso: '2026-11-27', weekday: 'Fri', mins: 12 * 60 + 59 }).label, 'EARLY CLOSE 13:00')
  assert.equal(sessionState({ iso: '2026-11-27', weekday: 'Fri', mins: 13 * 60 }).open, false)
})

test('marketState resolves a real Date via ET', () => {
  // 2026-07-22 14:00 UTC = 10:00 ET Wednesday -> open
  assert.equal(marketState(new Date('2026-07-22T14:00:00Z')).open, true)
  // Thanksgiving 2026
  assert.equal(marketState(new Date('2026-11-26T16:00:00Z')).label, 'THANKSGIVING')
})
