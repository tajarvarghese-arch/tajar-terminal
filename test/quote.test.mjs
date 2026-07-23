import { test } from 'node:test'
import assert from 'node:assert/strict'
import { downsample } from '../api/quote.js'

test('downsample keeps short series intact', () => {
  assert.deepEqual(downsample([1, 2, 3], 24), [1, 2, 3])
})

test('downsample thins long series, preserving endpoints', () => {
  const long = Array.from({ length: 78 }, (_, i) => i)
  const d = downsample(long, 24)
  assert.equal(d.length, 24)
  assert.equal(d[0], 0)
  assert.equal(d[23], 77)
})

test('downsample drops nulls and non-numbers', () => {
  assert.deepEqual(downsample([1, null, 2, NaN, 3, undefined], 24), [1, 2, 3])
})

test('downsample tolerates empty/absent input', () => {
  assert.deepEqual(downsample(null, 24), [])
  assert.deepEqual(downsample([], 24), [])
})
