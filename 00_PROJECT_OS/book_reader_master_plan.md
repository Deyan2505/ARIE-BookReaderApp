# ARIE Book Reader — Master Plan

## Project Identity

This is **not** a generic ebook reader.
This is an official **ARIE author-owned** book reading application.

- Every book in the app is a book written by the author (ARIE).
- The app must feel like a professional author library — comparable in quality to Kindle or Apple Books.
- The ARIE brand identity must be present throughout: logo, gold palette, typography, tone.
- The audience is the author's readers, not developers or general users.

---

## Core Product Requirements

### 1. Book Catalog
- All books are authored by ARIE.
- Each book has structured metadata (see Metadata Model below).
- The source of truth for the catalog is `data/catalog.json` (not filesystem scanning).
- Only books with `status: "published"` appear in the Library.

### 2. Metadata Model

Every book entry in `catalog.json` must support:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Stable slug, never changes. e.g. `paradoksat-na-bolkata-1` |
| `title` | string | yes | Full display title |
| `subtitle` | string | no | Shown below title on card and detail screen |
| `author` | string | yes | Always "Arie Golden" or equivalent |
| `seriesId` | string | no | Groups book into a named series |
| `seriesTitle` | string | no | Human-readable series name |
| `seriesOrder` | number | no | Manual sort order within series |
| `category` | string | yes | `novel`, `standalone`, `essay`, `nonfiction` |
| `language` | string | yes | `bg`, `en` |
| `status` | string | yes | `draft`, `ready`, `published`, `archived` |
| `description` | string | no | Book blurb for the Detail screen |
| `cover` | string | no | Path or URL to cover image |
| `textFile` | string | yes | Relative path to `.txt` content file |
| `format` | string | yes | `txt` (epub/pdf deferred to Phase 7) |
| `publishedAt` | string | no | ISO date |
| `updatedAt` | string | no | ISO date |

### 3. Series Organization

Books are organized by series in the Library. Upload date is not the primary sort.

Known series (subject to expansion):
- `paradoksat` — "Парадоксът на ..." series
- `tesla` — Tesla alternative-history series
- `standalone` — books with no series affiliation
- `essays` — nonfiction/essay collections (future)

Library section rendering order:
1. **Continue Reading** — only if localStorage has real progress data
2. **Нови книги** — only if `publishedAt` < 30 days ago (optional, toggleable)
3. **Series sections** — one named section per `seriesId`, books sorted by `seriesOrder ASC`
4. **Самостоятелни книги** — books with no `seriesId`, sorted by `publishedAt DESC`

### 4. Book Covers
- Real cover images must be shown when the `cover` field exists.
- The **first page of the book text must never be used as a cover**.
- Random placeholders must not be shown when a real cover URL exists.
- Generated gradient + initials cover is allowed **only as fallback** when `cover` is null/empty.
- Cover images are stored in `public/covers/` or Supabase Storage.
- If a cover image URL returns 404 or fails to load, JS silently falls back to the generated cover.

### 5. Content Protection (Current State — Do Not Change Until Phase 5)
- Canvas-based text rendering (no selectable DOM text).
- XOR byte-level encryption on page content in transit.
- Copy/select/print/DevTools event blocking.
- These are **deterrence**, not absolute DRM. A determined technical user can bypass them.
- A subtle ARIE logo watermark behind the reading text is planned for Phase 5.
- **Do not modify the protection system until Phase 5 is explicitly approved.**

### 6. Watermark Plan (Phase 5, not yet implemented)
- Rendered on canvas behind the text layer, before body text is drawn.
- Configurable: opacity (default 0.04), size, mode (`centered` or `tiled`).
- Theme-aware: opacity adjusts per theme (dark / pitch-black / sepia).
- Purpose: branding + screenshot attribution, not technical DRM.

### 7. Make.com Publishing Automation (Phase 6, not yet implemented)
- Source: Airtable as book catalog + Google Drive / OneDrive as file storage.
- Trigger: `status` field in Airtable changes to `"ready"`.
- Steps: validate metadata → fetch `.txt` → fetch cover → push to Supabase/repo → trigger Netlify redeploy → set status to `"published"`.
- Draft protection: automation exits immediately if status is not exactly `"ready"`.
- **Do not implement this until Phase 6 is approved.**

### 8. Deferred Features (Phase 7 or later)
- EPUB parsing
- PDF rendering
- Reading notes
- Highlights
- Bookmarks UI
- Import from external sources
- Advanced user accounts

---

## Technical Architecture

### Stack
- **Frontend:** Vanilla JS SPA, hash-based routing (`#/library`, `#/book/:id`, `#/read/:id`)
- **Backend:** Node.js / Express, served as Netlify serverless functions via `serverless-http`
- **Storage (local/dev):** `.txt` files in `uploads/`, catalog in `data/catalog.json`
- **Storage (production):** Supabase (DB for content, Storage for covers)
- **Canvas:** HTML5 Canvas for text rendering (intentional, part of protection strategy)
- **WebGL:** Smoke background in `public/js/smoke.js` (do not touch)

### File Map

```
BookReaderApp/
├── 00_PROJECT_OS/           ← Project control documents
├── data/
│   └── catalog.json         ← Single source of truth for all books (Phase 1)
├── netlify/functions/
│   └── api.js               ← API routes (read-only)
├── public/
│   ├── covers/              ← Cover images (Phase 2)
│   ├── css/styles.css
│   ├── index.html
│   └── js/
│       ├── reader.js        ← SPA logic (library + reader)
│       └── smoke.js         ← WebGL smoke (do not touch)
├── uploads/                 ← Book text files
├── server.js                ← Local dev server
└── .claude/launch.json
```

### Hash Routing (approved)

| Route | Screen | Notes |
|-------|--------|-------|
| `#/library` | Library screen | Default / home |
| `#/book/:bookId` | Book Detail screen | Phase 4 |
| `#/read/:bookId` | Reader screen | Current |

**Never use `/read/bookId` as a URL path** — this causes relative asset path breakage. All navigation is hash-based.

---

## Development Phases

| Phase | Goal | Status |
|-------|------|--------|
| 0 | Stabilize routing and Library rendering | ✅ Complete |
| 1 | Define metadata model (`catalog.json`) | ⬜ Next |
| 2 | Real covers + series-based Library | ⬜ Pending |
| 3 | Polish Library as ARIE author library | ⬜ Pending |
| 4 | Book Details screen | ⬜ Pending |
| 5 | Reader UX + ARIE watermark | ⬜ Pending |
| 6 | Make.com publishing workflow | ⬜ Pending |
| 7 | EPUB/PDF/notes/highlights (if needed) | ⬜ Deferred |

**A phase cannot begin without explicit author approval.**
