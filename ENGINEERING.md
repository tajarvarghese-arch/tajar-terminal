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
- [ ] Version-aware wake reload: embed the build hash at build time
      (e.g. define __BUILD__), serve it in a tiny `/version.json`;
      on wake, if the served hash differs from the running one,
      `location.reload()` so home-screen apps stop running stale code.
- [ ] Fuzzy-dedupe calendar events: same start time + near-identical
      titles (case/punctuation-insensitive prefix match) should render
      once — the user's calendar has literal duplicates (3× Phish).

### P1 — features
- [ ] NYSE holiday calendar for the market-status chip (static table of
      2026–2027 full and half days; label HOLIDAY / EARLY CLOSE).
- [ ] Focus-per-day: archive the focus line at day rollover into the
      captain's-log entry for that day (prefix "FOCUS: ") instead of
      letting yesterday's focus linger as today's.
- [ ] Vitals trends view — ONLY once ≥45 days of health data exist in
      the store (check first; if not yet, skip without consuming the
      iteration): 12-week weekly-average bars, weekday-vs-weekend
      split, best/worst annotations. Same chart idiom as VITALS · 28D.
- [ ] Tape polish: relative age on headlines (e.g. `· 2H`), cap any
      single headline at ~90 chars with ellipsis.

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
