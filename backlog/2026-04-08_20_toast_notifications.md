# Feature: Toast notifications via Sonner

**Date:** 2026-04-08
**Status:** Done

## Change

Replaced static `errorText`/`infoText` blocks at the bottom of the project tree sidebar
with floating toast notifications using [sonner](https://sonner.emilkowal.ski/).

## What changed

- `package.json`: added `sonner`
- `src/components/Toaster.tsx`: new wrapper around `<Sonner>` with MTCode mono/pixel styling,
  re-exports `toast` for use anywhere in the app
- `src/App.tsx`:
  - imported `Toaster` and `toast`
  - removed `errorText`/`infoText` useState
  - replaced all `setErrorText(...)` → `toast.error(...)`
  - replaced all `setInfoText(...)` → `toast(...)`
  - added `<Toaster />` to JSX
- `src/components/FileTree.tsx`:
  - removed `errorText`/`infoText` from Props type and destructuring
  - removed static notification blocks from sidebar bottom

## Usage

```ts
import { toast } from "./components/Toaster";

toast("File saved");
toast.error("Operation failed: " + err);
toast.warning("...");
```
