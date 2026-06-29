# Decision Log

> Record every significant architectural or product decision here.
> Include: date, what was decided, why, and what alternatives were rejected.

---

## Format

```
### [DATE] — [DECISION TITLE]
**Decision:** ...
**Reason:** ...
**Rejected alternatives:** ...
**Impact:** ...
```

---

### 2026-06-29 — Canvas-based reader (preserve, do not change)
**Decision:** Keep the current HTML5 Canvas rendering for book text pages. Do not switch to DOM-based rendering.
**Reason:** Canvas rendering prevents text selection, which is the primary mechanism for casual copy protection. Changing to DOM text would remove this entirely and require a full rewrite of the reader.
**Rejected alternatives:** DOM text with CSS `user-select: none` — defeated by DevTools; Rich text viewer — no copy protection.
**Impact:** Phases 1–4 must not touch canvas rendering. Phase 5 adds watermark to canvas but does not change the text rendering approach.

---

### 2026-06-29 — XOR encryption preserved (do not change)
**Decision:** Keep the XOR byte-level encryption + Base64 on page content delivered from the API. Do not change the encryption scheme.
**Reason:** Changing the encryption would require changing both the server-side `encryptText()` function and the client-side `decryptText()` function simultaneously, with risk of breaking all existing books. The current scheme is functional and sufficient for its purpose (transit obfuscation, not real DRM).
**Rejected alternatives:** AES-GCM — overkill for deterrence, adds complexity; No encryption — removes all transit obfuscation.
**Impact:** `ENCRYPTION_SALT` and `getBookKey()` in `netlify/functions/api.js` must not be changed. `decryptText()` in `reader.js` must not be changed.

---

### 2026-06-29 — Hash-based routing (approved architecture)
**Decision:** All navigation is hash-based. Routes: `#/library`, `#/book/:bookId`, `#/read/:bookId`. No path-based routes for app screens.
**Reason:** The server has a single `index.html` served for all routes. Path-based routing caused relative asset breakage (CSS/JS loaded from `/read/css/styles.css` which does not exist). Hash routing avoids this without requiring a build tool or server-side rewrites for every route.
**Rejected alternatives:** Path-based SPA routing with server rewrites — would work but requires more server config and testing; React Router — unnecessary dependency for a vanilla JS app.
**Impact:** The `/read/*` catch-all in `server.js` stays as a safety net, but the app must never navigate to a path URL. All `window.location` changes must use `#` hashes.

---

### 2026-06-29 — `catalog.json` as source of truth (approved for Phase 1)
**Decision:** Replace `readdirSync` filesystem scanning with a structured `data/catalog.json` file as the book catalog source of truth.
**Reason:** Filesystem scanning cannot know series order, metadata, descriptions, cover paths, or publication status. It derives titles from filenames (fragile, Cyrillic-unsafe). A catalog file gives the author full control over what appears in the Library and in what order.
**Rejected alternatives:** Airtable as catalog — correct long-term (Phase 6), but requires network access and API keys during dev; Supabase `books` table — already exists for production but not needed locally; Continuing with filesystem scanning — fundamentally limits all future phases.
**Impact:** Phase 1 work. The filesystem fallback stays in place during transition so existing books continue to work while the catalog is being built.

---

### 2026-06-29 — This app is author-owned, not a platform
**Decision:** The app is designed for a single author (ARIE). There is no multi-author support, no public upload, no user accounts for uploading. All books in the catalog are written by ARIE.
**Reason:** The product requirement is an official author library, not a reading platform. Adding multi-author or upload features would change the product identity entirely.
**Rejected alternatives:** Generic ebook reader with user uploads — explicitly rejected by author.
**Impact:** No upload endpoint is needed. No admin interface for uploading books is in scope. The Make.com pipeline in Phase 6 is the author's publishing workflow, not a user-facing upload feature.

---

### 2026-06-29 — Generated covers are fallback only
**Decision:** Generated gradient + initials covers are allowed only when the `cover` field in catalog metadata is null or empty. When a real cover image exists, it must be shown.
**Reason:** An official author library must show real covers. Generated covers are acceptable during development when covers are not yet prepared, but must not coexist with real covers for the same book.
**Rejected alternatives:** Always show generated covers (simpler code) — rejected, looks unprofessional; First page of text as cover — explicitly forbidden.
**Impact:** Phase 2 must implement cover image rendering with graceful fallback. The fallback must be silent (no broken image icons).

---

### 2026-06-29 — Series organization over date sort
**Decision:** Books in the Library are organized into named series sections, sorted by `seriesOrder` within each series. Upload date is not the primary sort order.
**Reason:** Upload date is arbitrary and does not reflect reading order or narrative series structure. A reader discovering the series "Парадоксът на..." should see Book 1 first, not the most recently uploaded book.
**Rejected alternatives:** Alphabetical sort — ignores series relationships; Date sort — arbitrary, confusing for multi-book series.
**Impact:** Phase 2 Library rendering must group by `seriesId` and sort by `seriesOrder`. The API must return these fields.

---

### 2026-06-29 — EPUB/PDF deferred to Phase 7
**Decision:** EPUB parsing, PDF rendering, and advanced format support are deferred to Phase 7 and may never be implemented if not needed.
**Reason:** The current book catalog uses `.txt` files which work well with the canvas renderer. Adding EPUB/PDF support is significant complexity that does not benefit the author until the core library experience is polished.
**Rejected alternatives:** Add EPUB support now — rejected, premature and out of scope for current phases.
**Impact:** `format` field in catalog metadata will always be `"txt"` until Phase 7 is approved. No EPUB/PDF parsing libraries should be added.

---

### 2026-06-29 — Watermark is visual deterrence, not DRM
**Decision:** The planned ARIE logo watermark (Phase 5) is classified as visual deterrence and branding, not technical DRM.
**Reason:** Browser-based content protection cannot be made absolute. A watermark makes screenshots carry the ARIE brand and adds friction for casual copying, but a determined technical user can remove it by patching the canvas draw call.
**Rejected alternatives:** Claiming the watermark provides real protection — rejected, would be misleading about actual security posture.
**Impact:** The watermark implementation must be designed for legibility and brand value, not for absolute protection. Default opacity 0.04 (barely perceptible while reading). Do not increase opacity to the point of harming the reading experience.

---

### 2026-06-29 — Smoke/WebGL background is untouched
**Decision:** `public/js/smoke.js` and the `#smoke-canvas` element are not to be modified in any phase.
**Reason:** The WebGL smoke effect works correctly and defines the visual atmosphere of the app. Modifying it carries high risk of breaking the background entirely with no benefit.
**Rejected alternatives:** Replace with CSS animation — rejected, would change the visual identity; Remove entirely — rejected.
**Impact:** No task in any phase should touch `smoke.js` or the canvas element it manages unless a specific smoke-related bug is reported.
