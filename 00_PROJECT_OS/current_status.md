# Current Status

> Update this file after every completed implementation step.
> Date format: YYYY-MM-DD

---

## Active Phase

**Phase 1 — Define metadata model for author-owned books**
Status: ⬜ Not started (awaiting author approval to begin)

---

## Last Completed Step

**Date:** 2026-06-29
**Step:** Phase 0 complete — Library rendering stabilized, malformed book filtered, layout fixed, security banner fixed on mobile.

### What was done
- Fixed JavaScript Temporal Dead Zone bug: `route()` was called before `let libraryLoaded` and `let allBooks` were initialized. Moved both to end of DOMContentLoaded.
- Fixed `/api/books` to filter out empty files and files with no valid title (malformed duplicate `1780343541579___…_1_.txt` now excluded).
- Added `titleFromFilename()` and `hasLetters()` helpers to API.
- Scoped `header { position: sticky }` CSS rule to `#screen-reader header` only — was leaking into `.lib-header` and causing layout issues.
- Fixed `.security-alert` hidden transform from `translateY(-100px)` (too small on mobile) to `calc(-100% - 40px)` — fully off-screen at any banner height.
- Book card secondary line now shows `author` with fallback to `subtitle`, hidden if neither exists (removed hardcoded "Неизвестен автор").
- Created `.claude/launch.json` pointing at `node server.js` for preview tool integration.

### Files changed in this step
- `public/js/reader.js`
- `public/css/styles.css`
- `netlify/functions/api.js`
- `.claude/launch.json`

### Current API state
`GET /api/books` returns:
```json
[
  {
    "id": "1_Paradoksat-na-bolkata.txt",
    "title": "Парадоксът на болката",
    "author": "",
    "subtitle": "Механика на близостта",
    "sizeBytes": 467952,
    "uploadedAt": "2026-06-28T18:13:27.140Z"
  }
]
```

### Known issues / tech debt remaining
- `id` is the raw filename — should become a stable slug after Phase 1 catalog is introduced.
- API still uses `readdirSync` fallback (filesystem scanning) — to be replaced by `catalog.json` in Phase 1.
- `author` field is empty string — will be populated from catalog metadata in Phase 1.
- `1780343541579___…_1_.txt` is still on disk; filtered at API level but not deleted (may be real content needing a proper entry).
- The series-based Library organization is not yet implemented.

---

## Phase History

| Phase | Completed | Notes |
|-------|-----------|-------|
| 0 | 2026-06-29 | Library rendering stabilized. All bugs listed above fixed. |

---

## Environment

- Dev server: `node server.js` on `http://localhost:3001`
- Preview tool: configured in `.claude/launch.json`
- Platform: Windows 11, Node.js v24.15.0
- Deployment target: Netlify (serverless) + Supabase (production)
- Current mode: **local fallback** (no Supabase keys set)
