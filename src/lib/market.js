/* NYSE session clock — weekday/weekend, full holidays, early closes.
   Static table through 2027; extend before 2028-01-01. */

export const NYSE_HOLIDAYS = {
  '2026-01-01': 'NEW YEAR', '2026-01-19': 'MLK DAY', '2026-02-16': 'PRESIDENTS DAY',
  '2026-04-03': 'GOOD FRIDAY', '2026-05-25': 'MEMORIAL DAY', '2026-06-19': 'JUNETEENTH',
  '2026-07-03': 'JULY 4TH (OBS)', '2026-09-07': 'LABOR DAY',
  '2026-11-26': 'THANKSGIVING', '2026-12-25': 'CHRISTMAS',
  '2027-01-01': 'NEW YEAR', '2027-01-18': 'MLK DAY', '2027-02-15': 'PRESIDENTS DAY',
  '2027-03-26': 'GOOD FRIDAY', '2027-05-31': 'MEMORIAL DAY', '2027-06-18': 'JUNETEENTH (OBS)',
  '2027-07-05': 'JULY 4TH (OBS)', '2027-09-06': 'LABOR DAY',
  '2027-11-25': 'THANKSGIVING', '2027-12-24': 'CHRISTMAS (OBS)',
}

/* 13:00 ET closes */
export const NYSE_EARLY_CLOSE = new Set(['2026-11-27', '2026-12-24', '2027-11-26'])

const OPEN_MIN = 9 * 60 + 30
const CLOSE_MIN = 16 * 60
const EARLY_CLOSE_MIN = 13 * 60

/* et: { iso: 'YYYY-MM-DD', weekday: 'Mon'..'Sun', mins: minutes since midnight ET } */
export function sessionState(et) {
  const { iso, weekday, mins } = et
  if (NYSE_HOLIDAYS[iso]) return { open: false, label: NYSE_HOLIDAYS[iso] }
  if (['Sat', 'Sun'].includes(weekday)) return { open: false, label: 'MKT CLOSED' }
  const closeMin = NYSE_EARLY_CLOSE.has(iso) ? EARLY_CLOSE_MIN : CLOSE_MIN
  if (mins < OPEN_MIN) return { open: false, label: 'PRE-MKT' }
  if (mins < closeMin) {
    return { open: true, label: NYSE_EARLY_CLOSE.has(iso) ? 'EARLY CLOSE 13:00' : 'MKT OPEN' }
  }
  return { open: false, label: 'AFT-MKT' }
}

export function etParts(now) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return {
    iso: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: get('weekday'),
    mins: (+get('hour') % 24) * 60 + +get('minute'),
  }
}

export function marketState(now) {
  return sessionState(etParts(now))
}
