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
- [ ] PWA manifest (name, icons from /public, display: standalone,
      background/theme #0a0908) so the home-screen app gets correct
      splash and icon metadata everywhere.
- [ ] Accessibility pass: aria-labels on all icon-only controls,
      prefers-reduced-motion disables the tape scroll and blinking
      cursors, focus outlines that fit the aesthetic.
- [ ] Expanded book view: group rows long/short with subtotal lines
      (gross long, gross short, net).
- [ ] Lighthouse pass: fix anything scoring under 90 that doesn't
      conflict with the aesthetic (expect font-display, meta hints).

### Discovered (loop appends here; user triages into P0–P2)
- (empty)

## Cadence

Maintenance mode: one iteration per day is plenty — the P0 section is
about four days of work. Burst mode to clear P0 faster is fine, but
never run two iterations concurrently (push conflicts).
