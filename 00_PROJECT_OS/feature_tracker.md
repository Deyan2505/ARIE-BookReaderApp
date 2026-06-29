# Feature Tracker

> Update this file when any feature changes status.
> Status values: ✅ Done | 🔄 In Progress | ⬜ Planned | 🚫 Blocked | ⏸ Deferred | ❌ Rejected

---

## Phase 0 — Stabilize Routing and Library Rendering

| Feature | Status | Notes |
|---------|--------|-------|
| Hash-based routing (`#/library`, `#/read/:id`) | ✅ Done | |
| Library renders book cards | ✅ Done | TDZ bug fixed |
| Library empty state | ✅ Done | |
| Library error toast | ✅ Done | |
| Filter malformed/invalid books from API | ✅ Done | `hasLetters()` guard |
| Clean title fallback from filename | ✅ Done | `titleFromFilename()` |
| Book card: title display | ✅ Done | |
| Book card: subtitle/author secondary line | ✅ Done | Falls back, hidden if neither |
| Book card: generated gradient cover (fallback) | ✅ Done | |
| Book card: progress bar on cover | ✅ Done | |
| Book card: progress % text | ✅ Done | |
| Header/main layout — no overlap | ✅ Done | Scoped sticky rule |
| Security banner hidden correctly on mobile | ✅ Done | `calc(-100% - 40px)` |
| "Recently Opened" section | ✅ Done | Hidden when empty |
| Search / filter books | ✅ Done | |
| Smoke/WebGL background | ✅ Done | Untouched, works |
| Canvas reader rendering | ✅ Done | Untouched, works |
| XOR encryption / decryption | ✅ Done | Untouched, works |
| Font size controls (reader) | ✅ Done | Not yet persisted to localStorage |
| Theme toggle (reader) | ✅ Done | |
| Progress saved to localStorage | ✅ Done | |
| Book dropdown in reader header | ✅ Done | |
| Fullscreen button | ✅ Done | |

---

## Phase 1 — Metadata Model

| Feature | Status | Notes |
|---------|--------|-------|
| `data/catalog.json` file created | ⬜ Planned | |
| Catalog schema with all metadata fields | ⬜ Planned | id, title, subtitle, author, seriesId, seriesTitle, seriesOrder, category, language, status, description, cover, textFile, format, publishedAt, updatedAt |
| API reads from `catalog.json` instead of `readdirSync` | ⬜ Planned | Keep filesystem fallback during transition |
| Status filter: only `published` books returned | ⬜ Planned | |
| Stable `id` slug (not raw filename) | ⬜ Planned | |
| Author field populated from catalog | ⬜ Planned | |
| `series.json` for series display order | ⬜ Planned | Optional, may be part of catalog.json |

---

## Phase 2 — Real Covers + Series Organization

| Feature | Status | Notes |
|---------|--------|-------|
| Real cover image display in book card | ⬜ Planned | |
| Cover image fallback (gradient) when no cover field | ⬜ Planned | |
| `public/covers/` folder | ⬜ Planned | |
| Series sections in Library | ⬜ Planned | Group by `seriesId`, sort by `seriesOrder` |
| Series section headings | ⬜ Planned | |
| Standalone books section | ⬜ Planned | |
| "Нови книги" section (optional) | ⬜ Planned | `publishedAt` < 30 days |

---

## Phase 3 — Polish Library as ARIE Author Library

| Feature | Status | Notes |
|---------|--------|-------|
| "Continue Reading" section | ⬜ Planned | Only if progress data exists in localStorage |
| Series section visual polish | ⬜ Planned | |
| ARIE branding consistency | ⬜ Planned | |
| Mobile layout of series sections | ⬜ Planned | |

---

## Phase 4 — Book Details Screen

| Feature | Status | Notes |
|---------|--------|-------|
| `#/book/:bookId` route | ⬜ Planned | |
| `#screen-detail` DOM section | ⬜ Planned | |
| Cover, title, subtitle, series badge | ⬜ Planned | |
| Description (book blurb) | ⬜ Planned | |
| "Start Reading" / "Continue" CTA | ⬜ Planned | |
| Back button → Library | ⬜ Planned | |
| Progress indicator on detail screen | ⬜ Planned | |

---

## Phase 5 — Reader UX + Watermark

| Feature | Status | Notes |
|---------|--------|-------|
| ARIE logo watermark on canvas (behind text) | ⬜ Planned | Opacity 0.04 default, theme-aware |
| Watermark mode: centered / tiled | ⬜ Planned | |
| Font size preference persisted to localStorage | ⬜ Planned | Currently resets on reload |
| Theme preference persisted to localStorage | ⬜ Planned | |
| Cover page rendering (page 1 = `##COVER##`) | ⬜ Planned | Currently just shows marker text |
| Reader keyboard navigation (arrow keys) | ⬜ Planned | |
| Swipe navigation on mobile | ⬜ Planned | |

---

## Phase 6 — Make.com Publishing Automation

| Feature | Status | Notes |
|---------|--------|-------|
| Publishing workflow plan | ✅ Done | Documented in master plan |
| Airtable catalog integration | ⬜ Planned | |
| Make.com scenario | ⬜ Planned | Do not implement until Phase 6 approved |
| Netlify redeploy webhook | ⬜ Planned | |
| Draft protection (status guard) | ⬜ Planned | |

---

## Phase 7 — Deferred

| Feature | Status | Notes |
|---------|--------|-------|
| EPUB parsing | ⏸ Deferred | |
| PDF rendering | ⏸ Deferred | |
| Reading notes | ⏸ Deferred | |
| Highlights | ⏸ Deferred | |
| Bookmarks UI | ⏸ Deferred | |
| Import from external sources | ⏸ Deferred | |
| User accounts / auth | ⏸ Deferred | |

---

## Rejected / Out of Scope

| Feature | Status | Reason |
|---------|--------|--------|
| Generic multi-author book upload | ❌ Rejected | This is author-owned, not a platform |
| Random placeholder cover images | ❌ Rejected | Only gradient fallback allowed |
| First page of text as cover | ❌ Rejected | Explicitly forbidden |
| "Неизвестен автор" hardcoded string | ❌ Rejected | Replaced with conditional rendering |
