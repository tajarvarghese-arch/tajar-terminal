import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHealthPayload } from '../api/health.js'

const FALLBACK = '2026-07-22'

test('Health Auto Export payload maps metrics per date', () => {
  const hae = {
    data: {
      metrics: [
        { name: 'step_count', units: 'count', data: [
          { date: '2026-07-22 00:00:00 -0400', qty: 273.4 },
          { date: '2026-07-21 00:00:00 -0400', qty: 9182 },
        ]},
        { name: 'apple_exercise_time', units: 'min', data: [{ date: '2026-07-22 00:00:00 -0400', qty: 12 }] },
      ],
    },
  }
  const u = parseHealthPayload(hae, FALLBACK)
  assert.equal(u['2026-07-22'].steps, 273, 'rounded')
  assert.equal(u['2026-07-21'].steps, 9182, 'multi-day batch')
  assert.equal(u['2026-07-22'].exercise, 12)
})

test('unknown HAE metrics are ignored', () => {
  const u = parseHealthPayload({ data: { metrics: [{ name: 'heart_rate', data: [{ date: '2026-07-22 00:00:00 -0400', qty: 61 }] }] } }, FALLBACK)
  assert.deepEqual(u, {})
})

test('simple Shortcuts shape still works, date defaults to fallback', () => {
  const u = parseHealthPayload({ steps: 415, exercise: 31 }, FALLBACK)
  assert.equal(u[FALLBACK].steps, 415)
  assert.equal(u[FALLBACK].exercise, 31)
})

test('explicit date in simple shape is honored', () => {
  const u = parseHealthPayload({ date: '2026-07-20', steps: 100 }, FALLBACK)
  assert.equal(u['2026-07-20'].steps, 100)
})

test('garbage yields empty updates', () => {
  assert.deepEqual(parseHealthPayload({ data: { metrics: [{ name: 'step_count', data: [{ date: 'nope', qty: 'x' }] }] } }, FALLBACK), {})
  assert.deepEqual(parseHealthPayload({ steps: -5 }, FALLBACK), {})
})

test('negative and non-finite values rejected in HAE shape', () => {
  const u = parseHealthPayload({ data: { metrics: [{ name: 'steps', data: [
    { date: '2026-07-22 00:00:00 -0400', qty: -10 },
    { date: '2026-07-22 00:00:00 -0400', qty: Infinity },
  ] }] } }, FALLBACK)
  assert.deepEqual(u, {})
})
