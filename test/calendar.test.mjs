import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDays, mergeDays, dedupeDay } from '../api/calendar.js'

const NOW = new Date('2026-07-22T11:10:00Z') // 07:10 ET Wed Jul 22

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:daily-mazurka
DTSTART;TZID=America/New_York:20260201T070000
DTEND;TZID=America/New_York:20260201T080000
RRULE:FREQ=DAILY
EXDATE;TZID=America/New_York:20260723T070000
SUMMARY:Daily practice
END:VEVENT
BEGIN:VEVENT
UID:weekly-gmg
DTSTART;TZID=America/New_York:20260204T070000
DTEND;TZID=America/New_York:20260204T080000
RRULE:FREQ=WEEKLY;BYDAY=WE
SUMMARY:Weekly meeting
END:VEVENT
BEGIN:VEVENT
UID:weekly-gmg
RECURRENCE-ID;TZID=America/New_York:20260729T070000
DTSTART;TZID=America/New_York:20260729T090000
DTEND;TZID=America/New_York:20260729T100000
SUMMARY:Weekly meeting (moved)
END:VEVENT
BEGIN:VEVENT
UID:single-dinner
DTSTART;TZID=America/New_York:20260729T173000
DTEND;TZID=America/New_York:20260729T190000
SUMMARY:Dinner
LOCATION:Keens Steakhouse\\, 72 W 36th St
END:VEVENT
BEGIN:VEVENT
UID:allday
DTSTART;VALUE=DATE:20260724
DTEND;VALUE=DATE:20260725
SUMMARY:All day thing
END:VEVENT
BEGIN:VEVENT
UID:cancelled-ev
DTSTART;TZID=America/New_York:20260723T120000
DTEND;TZID=America/New_York:20260723T130000
STATUS:CANCELLED
SUMMARY:Cancelled thing
END:VEVENT
END:VCALENDAR`

const FAM_ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:fam-soccer
DTSTART;TZID=America/New_York:20260725T100000
DTEND;TZID=America/New_York:20260725T113000
SUMMARY:Soccer game
END:VEVENT
BEGIN:VEVENT
UID:dup-dinner
DTSTART;TZID=America/New_York:20260729T173000
DTEND;TZID=America/New_York:20260729T190000
SUMMARY:Dinner
END:VEVENT
END:VCALENDAR`

test('daily recurrence expands within the window', () => {
  const d = buildDays(ICS, NOW)
  assert.ok(d['2026-07-22'].some((i) => i.s === 'Daily practice' && i.t === '07:00'))
  assert.ok(d['2026-07-24'].some((i) => i.s === 'Daily practice'))
})

test('EXDATE removes the excluded instance only', () => {
  const d = buildDays(ICS, NOW)
  assert.ok(!(d['2026-07-23'] || []).some((i) => i.s === 'Daily practice'))
})

test('weekly recurrence lands on its weekday', () => {
  const d = buildDays(ICS, NOW)
  assert.ok(d['2026-07-22'].some((i) => i.s === 'Weekly meeting'))
})

test('RECURRENCE-ID override replaces the base instance', () => {
  const d = buildDays(ICS, NOW)
  const day = d['2026-07-29'] || []
  assert.ok(!day.some((i) => i.s === 'Weekly meeting' && i.t === '07:00'), 'base gone')
  assert.ok(day.some((i) => i.s.includes('moved') && i.t === '09:00'), 'override present')
})

test('single events carry shortened locations', () => {
  const d = buildDays(ICS, NOW)
  assert.equal(d['2026-07-29'].find((i) => i.s === 'Dinner').loc, 'Keens Steakhouse')
})

test('all-day and cancelled events are skipped', () => {
  const d = buildDays(ICS, NOW)
  assert.ok(!(d['2026-07-24'] || []).some((i) => i.s === 'All day thing'))
  assert.ok(!(d['2026-07-23'] || []).some((i) => i.s === 'Cancelled thing'))
})

test('labeled feeds tag their events', () => {
  const fam = buildDays(FAM_ICS, NOW, 'FAM')
  assert.equal(fam['2026-07-25'].find((i) => i.s === 'Soccer game').cal, 'FAM')
})

test('fuzzy dedupe: near-identical titles at the same time collapse', () => {
  const d = dedupeDay([
    { t: '17:30', e: '19:00', s: 'Reservation at Keens Steakhouse' },
    { t: '17:30', e: '19:00', s: 'Dinner at Keens Steakhouse', loc: 'Keens Steakhouse' },
    { t: '18:00', e: '23:00', s: 'Phish at MSG: Sec 120, Row 6, Seats 3-6' },
    { t: '18:00', e: '23:00', s: 'Phish at MSG: Sec 120, Row 6, Seats 3-6' },
  ])
  assert.equal(d.filter((i) => i.s.toLowerCase().includes('keens')).length, 1, 'keens pair collapsed')
  assert.equal(d.filter((i) => i.s.includes('Phish')).length, 1, 'exact pair collapsed')
  assert.equal(d.find((i) => i.s.toLowerCase().includes('keens')).loc, 'Keens Steakhouse', 'richer record kept')
})

test('fuzzy dedupe: distinct events at the same time are NOT merged', () => {
  const d = dedupeDay([
    { t: '07:00', e: '08:00', s: 'GMG meeting' },
    { t: '07:00', e: '08:00', s: 'Sight read mazurka 2x' },
  ])
  assert.equal(d.length, 2)
})

test('mergeDays drops cross-feed duplicates and keeps days sorted', () => {
  const merged = mergeDays([buildDays(ICS, NOW), buildDays(FAM_ICS, NOW, 'FAM')])
  assert.equal(merged['2026-07-29'].filter((i) => i.s === 'Dinner').length, 1, 'duplicate dropped')
  const day = merged['2026-07-29']
  assert.ok(day.every((it, i) => i === 0 || day[i - 1].t <= it.t), 'sorted by time')
})
