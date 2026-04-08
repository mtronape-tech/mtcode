# Feature: Save confirmation on Exit / Close

**Date:** 2026-04-08  
**Status:** Done

## What was added

When the app is being closed (via File → Exit), MTCode now checks for unsaved editor tabs
and shows a confirmation dialog.

### `src/components/UnsavedChangesDialog.tsx`

- New modal dialog listing unsaved files (up to a few entries).
- Actions:
  - **SAVE & EXIT**: saves all dirty tabs (including untitled via Save As) then closes.
  - **DISCARD & EXIT**: closes without saving.
  - **CANCEL**: abort closing.

### `src/App.tsx`

- Added `requestAppClose()` and wired it to File → Exit.
- Added a `beforeunload` handler as a safety net for non-Tauri runs (preview/browser).

