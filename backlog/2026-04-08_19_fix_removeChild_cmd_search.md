# Fix: NotFoundError removeChild on Cmd (F1) and Ctrl+Shift+F

**Date:** 2026-04-08
**Status:** Done

## Problem

Pressing F1 ("Cmd" F-key button) or Ctrl+Shift+F (global search) threw:
`Error: Rendered more hooks than during the previous render.`
which manifested as `NotFoundError: removeChild` and killed the UI via the fatal error overlay.

## Root Cause

`CommandPalette.tsx` had two `useEffect` calls placed **after** an early `if (!open) return null`.
This violates the Rules of Hooks — the number of hooks called changed between renders when `open`
toggled from `false` to `true`, causing React to crash.

```
Previous render (open=false): 5 hooks  (early return before 2 useEffects)
Next render    (open=true):   7 hooks  (all 3 useEffects + 2 more after return)
```

## Fix (`src/components/CommandPalette.tsx`)

Moved all `useEffect` calls above the `if (!open) return null` early return.
Added `if (!open) return` guards inside each effect so they're no-ops when closed.

## Other changes (same session, not the root cause)

- `src/App.tsx`: added `stopPropagation()` to window-level hotkey handler for `findInProject`,
  `settings`, `commandPalette`, and F-key bar — prevents double-firing into Monaco.
- `src/App.tsx`: removed redundant `editor.addCommand(F1, ...)` — window listener handles F1 first.
- `src/main.tsx`: removed `<React.StrictMode>` (Monaco incompatible in dev double-mount cycle).
- `src/main.tsx`: added dev-only console logging for fatal errors instead of killing UI.
