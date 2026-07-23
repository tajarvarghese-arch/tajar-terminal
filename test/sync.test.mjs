import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeState, mergeStreaks, mergeTodos, normStreaks } from '../src/lib/sync.js'

const NOW = 1785000000000
const T0 = NOW - 86400000 // "yesterday"
const T1 = NOW - 3600000  // an hour ago (phone taps)
const T2 = NOW - 60000    // a minute ago (desktop edit)

test('stale-device push cannot clobber another device (the original bug)', () => {
  const phoneServerBlob = {
    todos: [{ id: 1, text: 'call brett', done: false, mt: T0 }],
    streaks: { habits: [{ id: 'piano', name: 'PIANO', mt: T0 }], marks: { piano: { '2026-07-22': { on: 1, mt: T1 } } } },
    logEntries: [{ d: '2026-07-22', t: 'good day' }],
    reasons: ['for ben'],
    focus: 'phone focus', soberStart: '2025-10-09',
  }
  const staleDesktopBlob = {
    todos: [{ id: 1, text: 'call brett', done: true, mt: T2 }],
    streaks: { habits: [{ id: 'piano', name: 'PIANO', mt: T0 }], marks: { piano: {} } },
    logEntries: [], reasons: ['for ben'],
    focus: 'desktop focus', soberStart: '2025-10-09',
  }
  const m = mergeState(phoneServerBlob, staleDesktopBlob, false, NOW)
  assert.equal(m.streaks.marks.piano['2026-07-22'].on, 1, 'phone streak tap survives')
  assert.equal(m.todos.find((t) => t.id === 1).done, true, 'desktop check-off survives')
  assert.ok(m.logEntries.some((e) => e.d === '2026-07-22'), 'log entry survives')
  assert.equal(m.focus, 'desktop focus', 'newer side wins scalars')
})

test('deletion tombstones stick against stale live copies', () => {
  const m = mergeStreaks(
    { habits: [{ id: 'golf', name: 'GOLF', mt: T0 }], marks: {} },
    { habits: [{ id: 'golf', name: 'GOLF', mt: T2, del: 1 }], marks: {} },
    NOW
  )
  assert.equal(m.habits.find((h) => h.id === 'golf').del, 1)
})

test('un-marking a streak day beats a stale mark', () => {
  const m = mergeStreaks(
    { habits: [], marks: { piano: { '2026-07-21': { on: 1, mt: T0 } } } },
    { habits: [], marks: { piano: { '2026-07-21': { on: 0, mt: T2 } } } },
    NOW
  )
  assert.equal(m.marks.piano['2026-07-21'].on, 0)
})

test('legacy array-format marks migrate with mt 0', () => {
  const m = normStreaks({ habits: [{ id: 'piano', name: 'PIANO' }], marks: { piano: ['2026-07-20', '2026-07-21'] } })
  assert.equal(m.marks.piano['2026-07-20'].on, 1)
  assert.equal(m.habits[0].mt, 0)
})

test('tombstones purge after TTL; fresh ones survive', () => {
  const m = mergeTodos(
    [{ id: 9, text: 'old ghost', done: false, mt: NOW - 90 * 86400000, del: 1 }],
    [{ id: 8, text: 'recent delete', done: false, mt: T2, del: 1 }],
    NOW
  )
  assert.ok(!m.some((t) => t.id === 9), 'ancient tombstone purged')
  assert.equal(m.find((t) => t.id === 8).del, 1, 'fresh tombstone kept')
})

test('REGRESSION: local-only legacy mark (mt 0) survives an empty remote', () => {
  // newer() once returned the missing side on an mt tie, dropping the mark
  const m = mergeStreaks(
    { habits: [], marks: { piano: {} } },
    { habits: [], marks: { piano: { '2026-07-22': { on: 1, mt: 0 } } } },
    NOW
  )
  assert.equal(m.marks.piano['2026-07-22'].on, 1)
})

test('log entries merge by date, a-side wins conflicts, sorted desc', () => {
  const m = mergeState(
    { logEntries: [{ d: '2026-07-20', t: 'server old' }, { d: '2026-07-21', t: 'server line' }] },
    { logEntries: [{ d: '2026-07-21', t: 'local line' }, { d: '2026-07-22', t: 'local new' }] },
    true, NOW
  )
  assert.equal(m.logEntries.length, 3)
  assert.equal(m.logEntries[0].d, '2026-07-22')
  assert.equal(m.logEntries.find((e) => e.d === '2026-07-21').t, 'server line', 'remote-newer: remote wins date conflict')
})

test('reasons union dedupes case-insensitively', () => {
  const m = mergeState({ reasons: ['For Ben', 'health'] }, { reasons: ['for ben', 'clarity'] }, false, NOW)
  assert.equal(m.reasons.filter((r) => r.toLowerCase() === 'for ben').length, 1)
  assert.ok(m.reasons.includes('clarity') && m.reasons.includes('health'))
})

test('focusDate travels with the newer blob, falls back to the other', () => {
  const m = mergeState({ focus: 'x', focusDate: '2026-07-22' }, { focus: 'y' }, true, 1785000000000)
  assert.equal(m.focusDate, '2026-07-22')
  const m2 = mergeState({}, { focus: 'y', focusDate: '2026-07-23' }, true, 1785000000000)
  assert.equal(m2.focusDate, '2026-07-23')
})

test('normalizers tolerate garbage', () => {
  const m = mergeState({ todos: 'nope', streaks: 42, logEntries: null }, {}, true, NOW)
  assert.deepEqual(m.todos, [])
  assert.deepEqual(m.streaks.habits, [])
  assert.deepEqual(m.logEntries, [])
})
