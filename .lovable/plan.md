## Summary
Extend the compare-table sorting so each of the A, B, and Δ columns can cycle between sorting by *value* and sorting by *CI width* (high − low). This lets users quickly surface metrics with the most/least precise estimates.

## Why
Wide CIs mean uncertainty. Being able to sort by CI width makes it easy to spot which metrics are trustworthy and which are noisy.

## Changes

### 1. Extend sort-key types
Add `"aci"`, `"bci"`, `"dci"` to the `SortKey` union in `CompareView` and to the `SortableThProps` interface.

### 2. Compute CI width in the sort extractor
In the `valOf` function inside `sortedMetrics`:
- `"aci"` → `m.aStat.ci ? m.aStat.ci.high - m.aStat.ci.low : null`
- `"bci"` → `m.bStat.ci ? m.bStat.ci.high - m.bStat.ci.low : null`
- `"dci"` → `m.diffTest ? m.diffTest.ciHigh - m.diffTest.ciLow : null`

Null/undefined CIs sort to the bottom, following the existing null-handling convention.

### 3. Cycle sort mode on A/B/Δ columns
Update `toggleSort` so that clicking a column that is **already** the active sort key switches to its CI-width counterpart instead of just flipping direction:

- A value (`"a"`) → A CI width (`"aci"`) → back to A value (toggle direction)
- B value (`"b"`) → B CI width (`"bci"`) → back to B value
- Δ value (`"delta"`) → Δ CI width (`"dci"`) → back to Δ value

This keeps the table compact (no extra columns) while giving two sort dimensions per column.

### 4. Visual feedback
- Update `SortableTh` labels so they read `"A (95% CI)"` / `"A CI width"` depending on the active sort key.
- The arrow icon direction reflects ascending/descending order as usual.
- ARIA labels are updated so screen-reader users hear whether sorting is by value or by width.

### 5. Default direction
CI-width sorts default to `descending` (widest first), which is typically more useful for spotting uncertainty.

## Files
- `src/components/DatasetHistory.tsx` — compare view sorting logic only.

## Out of scope
- No new dependencies.
- No changes to chart rendering, export, or statistical calculations.