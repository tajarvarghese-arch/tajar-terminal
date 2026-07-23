import { test } from 'node:test'
import assert from 'node:assert/strict'
import { layoutTreemap } from '../src/lib/treemap.js'

const BOOK = [
  { key: 'UNH', weight: 6887631 }, { key: 'MDT', weight: 1070810 },
  { key: 'GOOG', weight: 1045170 }, { key: 'NFLX', weight: 668600 },
  { key: 'AAPL', weight: 491970 }, { key: 'COST', weight: 473114 },
  { key: 'CRWV', weight: 239684 }, { key: 'CAT', weight: 214561 },
  { key: 'BSX', weight: 147434 }, { key: 'MU', weight: 146395 },
  { key: 'SBUX', weight: 125687 }, { key: 'NBIS', weight: 107099 },
  { key: 'SNDK', weight: 97607 }, { key: 'FISV', weight: 78307 },
  { key: 'PLSE', weight: 45562 }, { key: 'OKLO', weight: 26345 },
]

test('areas are conserved and proportional to weights', () => {
  const rects = layoutTreemap(BOOK, 800, 96)
  const total = rects.reduce((s, r) => s + r.w * r.h, 0)
  assert.ok(Math.abs(total - 800 * 96) < 1, `total area ${total}`)
  const unh = rects.find((r) => r.key === 'UNH')
  const gross = BOOK.reduce((s, b) => s + b.weight, 0)
  assert.ok(Math.abs((unh.w * unh.h) / (800 * 96) - 6887631 / gross) < 0.001)
})

test('every rect stays inside the box', () => {
  for (const r of layoutTreemap(BOOK, 800, 96)) {
    assert.ok(r.x >= -0.01 && r.y >= -0.01, `${r.key} origin`)
    assert.ok(r.x + r.w <= 800.01 && r.y + r.h <= 96.01, `${r.key} extent`)
  }
})

test('no two rects overlap', () => {
  const rects = layoutTreemap(BOOK, 800, 96)
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j]
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      assert.ok(overlapX <= 0.01 || overlapY <= 0.01, `${a.key}×${b.key} overlap`)
    }
  }
})

test('squarified: every block beats the naive-strip slivers', () => {
  // in a 800×140 box a naive strip gives OKLO aspect ≈ (0.0022·800)/140⁻¹ ≈ 79;
  // squarified must keep every block reasonable and the dominant one column-ish
  const rects = layoutTreemap(BOOK, 800, 140)
  for (const r of rects) {
    const aspect = Math.max(r.w / r.h, r.h / r.w)
    assert.ok(aspect < 12, `${r.key} aspect ${aspect.toFixed(1)}`)
  }
  const unh = rects.find((r) => r.key === 'UNH')
  assert.ok(Math.max(unh.w / unh.h, unh.h / unh.w) < 4, 'dominant block column-ish')
})

test('degenerate inputs return empty', () => {
  assert.deepEqual(layoutTreemap([], 800, 96), [])
  assert.deepEqual(layoutTreemap([{ key: 'x', weight: 0 }], 800, 96), [])
  assert.deepEqual(layoutTreemap(BOOK, 0, 96), [])
})
