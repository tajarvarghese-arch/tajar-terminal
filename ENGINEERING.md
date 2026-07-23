# TAJAR TERMINAL — engineering loop plan

Operating contract for autonomous improvement iterations. Each loop
iteration reads this file, executes exactly one backlog item, and
updates the checkboxes before ending.

## Iteration shape (every run)

1. `git pull --rebase origin main` — the 6:30 AM refresh routine also
   commits to this repo; never work on a stale base.
2. Pick the **topmost unchecked item** in the backlog below. One item
   per iteration, smallest shippable slice. If an item is too large,
   split it into sub-items in place and do the first.
3. Implement. Match the existing style: brutalist Bloomberg, Consolas,
   amber/cyan/green palette, hairline grid, no emoji in UI, no
   frameworks beyond what exists.
4. Verify before shipping — all of:
   - `npm test` passes (add/extend tests for anything you change)
   - `npm run build` passes
   - dev-server smoke check: page renders, no console errors,
     personal-state round-trip works if sync code was touched
5. Commit with a clear message, push to main (standing authorization
   for this loop), then confirm the deploy: the live site responds and
   `/api/quote?symbols=UNH` returns 200 within ~2 minutes.
6. Check the box, note anything learned under "Discovered", and stop.
   If verification fails: revert, uncheck, note why, stop.

## Hard rules — never violate

- **No data loss risk**: never weaken `src/lib/sync.js` merge
  semantics, auth checks (`x-sync-key` vs `SYNC_SECRET`), or storage
  keys without adding tests FIRST proving the old guarantees hold.
- **No fake data**: this dashboard shows a real brokerage book and real
  commitments. Never simulate, estimate, or extrapolate values.
- **Respect the seed contract**: `SCHEDULE_FOR` and `seedWeek[].iso`
  are maintained by the morning-refresh routine — change their shape
  only if you also update the routine's prompt and say so.
- **Sobriety stays minimal**: the masthead chip only. Never add
  prominence, gamification, or streak-risk framing around it.
- **No new paid services, no new env vars** without flagging for the
  user first (stop the iteration and leave a note instead).
- **No redesigns**: the aesthetic is settled. Polish, don't reinvent.

## Backlog (priority order)

### P0 — reliability
- [x] Move the test suites into the repo: `test/` with 23 cases across
      sync-merge (incl. the newer()-tie regression), calendar ICS, and
      health payloads; `npm test` runs `node --test "test/*.test.mjs"`
      (bare `test/` breaks on Windows — treated as a module path).
- [x] React error boundary (TermBoundary): render crashes show an
      amber-on-black TERMINAL FAULT screen with the error text and a
      RELOAD button. Verifiable crash seam: set localStorage
      `tajar-crash-test` and reload.
- [x] Version-aware wake reload: __BUILD__ define + dist/version.json
      emitted per build; wake handler fetches it (no-store) and reloads
      when the served id differs from the compiled one.
- [x] Fuzzy-dedupe calendar events: same start + ≥60% word overlap
      collapses to the richer record (location kept, longer title wins).
      Kept conservative: different start times never merge.

### P1 — features
- [x] NYSE holiday calendar (src/lib/market.js, tables through 2027 —
      extend before 2028): named holiday labels, 13:00 early closes,
      5 test cases. Design rider: weekend rows in the week grid render
      dimmed for glanceable workday/weekend separation.
- [x] Focus-per-day: focus carries a focusDate (synced scalar); at
      rollover it archives as "FOCUS: …" into that day's log entry —
      only when the user didn't write one — then clears. Design rider:
      ▸ NEXT chip marks the first upcoming event in today's agenda
      (suppressed while something is ● NOW).
- [x] Vitals trends view — gate check found 1,095 days (HAE synced the
      user's full HealthKit history, not just new days). TRENDS · 12W
      panel: weekly-average bars for steps + exercise, weekday-vs-
      weekend split, best-day annotation; hidden below 45 days of data.
      Design rider: market strip dims its frozen prices whenever the
      session is closed (honesty cue, verified both color paths).
- [x] Tape polish: dim relative-age chip on headlines, 90-char cap
      with ellipsis. Design rider: prefers-reduced-motion stops the
      tape (static, data intact) and every blink/pulse animation.

### P2 — polish
- [x] PWA manifest: standalone display, #0a0908 theme/background,
      icons = scalable icon.svg (vector redraw of the glyph) +
      icon-192.png + apple-touch-icon. iOS ignores manifest icons
      (uses apple-touch-icon) — manifest serves spec-compliance and
      any future Android use.
- [x] Accessibility pass: aria-labels on all inputs and ✕ controls,
      ✕ spans keyboard-operable (role=button, tabIndex, Enter/Space),
      amber :focus-visible ring. (Reduced-motion shipped in loop 8.)
      Design rider: hover affordance on the sober and sync chips.
- [x] Expanded book view: LONG/SHORT group rails with GROSS LONG,
      GROSS SHORT, and NET subtotal rows (5 long / 11 short today).
- [x] Lighthouse pass — real audits, before → after:
      Perf 86→94, A11y 90→96, Best Practices 100, SEO 100;
      CLS 0.266→0 (placeholder-reserved async strips), AA contrast
      (--dim #8a8272), <main> landmark, touch-target hygiene.

### P3 — added by the loop (round 3, user-approved batch)
- [ ] Data export: DOWNLOAD ARCHIVE in the footer — full personal
      snapshot (todos, horizon, streaks, log, reasons, vitals history)
      as a dated JSON file. Ownership guarantee: the data is always
      leavable.
- [x] Grounding quote bank: 14 → 30 curated lines (stoic/recovery
      register), day-of-year rotation unchanged — repeats now monthly
      instead of biweekly. NOTE: user rejected the inverted block
      headers from the visible loop — de-boxed same day; numbering,
      domain colors, and glow survive on text + marker instead.
- [ ] Streak depth: show best-ever run alongside the current one
      (dim `BEST nD`) — habits only, never sobriety.

### Design loop (round 4) — text & graphics, aesthetic preserved
- [x] D1 Type scale: 15 font sizes → 7 (9/10/11/12/13/15/20),
      6 letter-spacings → 3 (0.5/1/2).
- [x] D2 Spacing rhythm: row/head paddings collapsed to 5/7/9(/10–14
      masthead) verticals on the 12px gutter.
- [x] D3 Color semantics enforced: amber=structure, green=life/live,
      red=losses only, cyan=family. Precip in the tape de-redded;
      VITALS/TRENDS panels carry green markers.
- [x] D4 Microcopy voice: short declaratives; removed the stale
      "11:59 PM sync" claim (HAE syncs hourly now).
- [x] D5 Graphic details: weather glyphs get proportional stroke
      (2.4 at ≤14px), chart columns grounded with a baseline rule.

### Visible loop (round 5, user-directed: "all 3 tastefully")
- [x] V1 Typographic drama: inverted function-row headers (black caps
      on amber/cyan/green blocks with phosphor bloom), numbered
      sections 01–09, focus line 20→26px.
- [x] V2 CRT texture: brand + clock glow, scanlines deepened
      (0.15/0.35 → 0.18/0.45), corner vignette.
- [x] V3 Instruments: intraday sparklines beside movers (real Yahoo
      5-min closes via api/quote spark passthrough, downsample tested),
      24h tide curve with NOW dot (cosine-interpolated NOAA extremes),
      daylight-spent gauge under the clock, steps-vs-10K micro meter.
      Quote attribution suppressed for anonymous lines.

### Creative loop (round 6, user-directed: "be more creative")
- [x] C1 Boot sequence: ~1.3s three-line ritual (TERMINAL / LINK OK /
      time-of-day greeting) on standalone launches only, once per
      session, reduced-motion + tap skip, ?boot=1 test override.
- [x] C2 Command line: / or glyph tap opens a prompt driving the desk —
      FOCUS, TODO, GOAL (natural dates), LOG, DID <habit>, WHY, HABIT,
      BOOK, HELP. All eight verbs verified end-to-end.
- [x] C3 The log talks back: ON THIS DAY resurfaces the entry from a
      year (or 30 days) ago inside the log panel — compounds as the
      journal grows. Moon phase cell in the conditions strip (pure
      astronomy, drawn terminator glyph, no API).

### Creative loop (round 7)
- [x] X1 Book heat strip: 16 positions as intensity-scaled green/red
      blocks in the collapsed markets strip; tap opens the book;
      desaturates when the session is closed.
- [x] X2 Night watch: after real sunset (weather-fed, clock fallback)
      glow goes off, scanlines quiet, vignette deepens, amber steps
      down via variable swap; moon marker in the clock row; ?night=1
      test override.
- [x] X3 Interactive tape: headlines are real links (duplicate rep is
      aria-hidden), a finger/hover holds the crawl still, tickers and
      BOOK jump to the markets panel. Ritual: when every habit is
      logged, the masthead cursor stops blinking and holds solid
      green. (Tape pause verified by inspection — hidden test pane
      halts rAF entirely; motion itself verified in loop 8's fix.)

### Discovered (loop appends here; user triages into P0–P2)
- [x] Captain's log capped at 10 entries with no way to read history
      (grows daily via focus archiving) → SHOW ALL/SHOW RECENT toggle;
      journal dates now carry the weekday (THU · JUL 23).
- [ ] Icon rasters: only 192px PNG generated; manifest leans on the
      scalable icon.svg. Generate a 512 PNG if Android install support
      ever matters.

## Cadence

Maintenance mode: one iteration per day is plenty — the P0 section is
about four days of work. Burst mode to clear P0 faster is fine, but
never run two iterations concurrently (push conflicts).
