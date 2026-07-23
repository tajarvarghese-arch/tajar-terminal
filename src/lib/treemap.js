/* Squarified treemap (Bruls, Huizing, van Wijk) — packs weighted items
   into a W×H rectangle, keeping each block's aspect ratio as close to
   square as the weights allow. Items must be sorted by area descending
   for best results; areas are used as given (caller normalizes so that
   Σarea = W×H). */

function worstAspect(row, rowArea, side) {
  const s2 = side * side
  const ra2 = rowArea * rowArea
  let max = -Infinity, min = Infinity
  for (const it of row) {
    if (it.area > max) max = it.area
    if (it.area < min) min = it.area
  }
  return Math.max((s2 * max) / ra2, ra2 / (s2 * min))
}

export function squarify(items, x0, y0, w0, h0) {
  const out = []
  let x = x0, y = y0, w = w0, h = h0
  let rest = items.filter((it) => it.area > 0)
  while (rest.length) {
    const vertical = w >= h // row runs along the short side
    const side = vertical ? h : w
    let row = [rest[0]]
    let rowArea = rest[0].area
    let i = 1
    while (i < rest.length) {
      const candidateArea = rowArea + rest[i].area
      if (worstAspect([...row, rest[i]], candidateArea, side) <= worstAspect(row, rowArea, side)) {
        row.push(rest[i])
        rowArea = candidateArea
        i++
      } else break
    }
    const thickness = rowArea / side
    let offset = 0
    for (const it of row) {
      const len = it.area / thickness
      if (vertical) out.push({ ...it, x, y: y + offset, w: thickness, h: len })
      else out.push({ ...it, x: x + offset, y, w: len, h: thickness })
      offset += len
    }
    if (vertical) { x += thickness; w -= thickness } else { y += thickness; h -= thickness }
    rest = rest.slice(row.length)
  }
  return out
}

/* convenience: weights -> rects in a W×H box, sorted desc, normalized */
export function layoutTreemap(weights, W, H) {
  const total = weights.reduce((s, it) => s + it.weight, 0)
  if (total <= 0 || W <= 0 || H <= 0) return []
  const items = [...weights]
    .filter((it) => it.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((it) => ({ ...it, area: (it.weight / total) * W * H }))
  return squarify(items, 0, 0, W, H)
}
