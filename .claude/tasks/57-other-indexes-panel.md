# Task 57 — Other Indexes Slide-out Panel

## Goal

Add a hideable right-edge slide-out panel for quickly entering intraday VIX, $ADD, and $TICK
readings. Accessible at any time via a fixed tab on the right edge.

## Changes

### New: `client/src/api/otherIndexes.ts`

```typescript
export async function saveOtherIndexes(data: {
  time?: string;
  vix?: number | null;
  add?: number | null;
  tick?: number | null;
}): Promise<{ time: string }> {
  const res = await fetch("/api/other_indexes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}
```

### New: `client/src/components/OtherIndexesPanel.tsx`

**Toggle tab:**
- Fixed vertical tab on the right edge of the viewport (always visible)
- Label: "Indexes" rotated 90°
- Clicking slides panel in/out

**Panel behavior:**
- Slides in from the right (CSS transition), overlays content — does not push layout
- Default: hidden
- Width: ~220px

**Form fields:**
- `Time` (text input, format HH:MM)
  - Defaults to current ET time (HH:MM) each time the panel is opened
  - User can override
- `VIX` (number input, step 0.01)
- `ADD` (number input, integer)
- `TICK` (number input, integer)
- At least one of VIX / ADD / TICK must be filled (validate client-side before submit)

**[Save] button:**
- Calls `POST /api/other_indexes` with `{ time, vix, add, tick }` (omit null/empty fields)
- On success:
  - Clear VIX, ADD, TICK fields
  - Keep `Time` field as-is (user can adjust for next entry)
  - Show "Saved ✓ HH:MM" inline (echoes `time` from response) for 3 seconds
- On error: show inline error in red

**Time default logic:**
```typescript
function currentETTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
// Reset time to current ET whenever panel opens
```

## Done When

- Fixed "Indexes" tab is visible on the right edge at all times
- Clicking tab slides panel open/closed
- Time field defaults to current ET time on open
- Saving clears VIX/ADD/TICK but keeps Time
- Confirmation shows the echoed time from the server response
- Validation prevents submit if all value fields are empty
