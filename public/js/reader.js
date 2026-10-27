document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // DOM REFERENCES
    // =========================================================================

    // Screens
    const screenLibrary = document.getElementById('screen-library');
    const screenReader  = document.getElementById('screen-reader');

    // Shared
    const toast         = document.getElementById('toast');
    const toastMessage  = document.getElementById('toast-message');
    const toastIcon     = document.getElementById('toast-icon');
    const securityAlert = document.getElementById('security-alert');

    // Library
    const libSearch    = document.getElementById('lib-search');
    const libLoading   = document.getElementById('lib-loading');
    const libEmpty     = document.getElementById('lib-empty');
    const sectionRecent = document.getElementById('section-recent');
    const sectionAll   = document.getElementById('section-all');
    const gridRecent   = document.getElementById('grid-recent');
    const gridAll      = document.getElementById('grid-all');
    const libNoResults = document.getElementById('lib-no-results');

    // Reader
    const canvas            = document.getElementById('reader-canvas');
    const ctx               = canvas.getContext('2d');
    const canvasWrapper     = document.getElementById('canvas-wrapper');
    const bookTitleEl       = document.getElementById('reader-book-title');
    const bookSelect        = document.getElementById('book-select');
    const prevPageBtn       = document.getElementById('prev-page-btn');
    const nextPageBtn       = document.getElementById('next-page-btn');
    const currentPageNumEl  = document.getElementById('current-page-num');
    const totalPagesNumEl   = document.getElementById('total-pages-num');
    const fontDecreaseBtn   = document.getElementById('font-decrease-btn');
    const fontIncreaseBtn   = document.getElementById('font-increase-btn');
    const themeMenuBtn      = document.getElementById('theme-menu-btn');
    const themeMenu         = document.getElementById('theme-menu');
    const fullscreenBtn     = document.getElementById('fullscreen-btn');
    const progressBarFill   = document.getElementById('progress-bar-fill');
    const progressContainer = document.getElementById('progress-container');


    // =========================================================================
    // SHARED UTILITIES
    // =========================================================================

    let toastTimer = null;
    function showToast(message, type = 'info') {
        toastMessage.textContent = message;
        toast.className = 'toast show';
        toastIcon.className = 'fa-solid';

        if (type === 'success') {
            toast.classList.add('toast-success');
            toastIcon.classList.add('fa-circle-check');
        } else if (type === 'error') {
            toast.classList.add('toast-error');
            toastIcon.classList.add('fa-circle-exclamation');
        } else {
            toast.classList.add('toast-info');
            toastIcon.classList.add('fa-circle-info');
        }

        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.className = 'toast'; }, 3500);
    }

    let alertTimeout = null;
    function triggerSecurityAlert() {
        securityAlert.classList.add('show');
        clearTimeout(alertTimeout);
        try { navigator.clipboard.writeText('© ARIE. Всички права запазени.'); } catch(e) {}
        alertTimeout = setTimeout(() => securityAlert.classList.remove('show'), 3500);
    }


    // =========================================================================
    // ROUTER
    // =========================================================================

    function showScreen(id) {
        screenLibrary.classList.remove('active');
        screenReader.classList.remove('active');
        document.getElementById(id).classList.add('active');
    }

    function route() {
        const hash = window.location.hash;
        if (hash.startsWith('#/read/')) {
            const id = decodeURIComponent(hash.slice(7));
            showScreen('screen-reader');
            document.title = 'ARIE — Четец';
            openBookInReader(id);
        } else {
            showScreen('screen-library');
            document.title = 'ARIE — Библиотека';
            renderLibrary();
        }
    }

    // =========================================================================
    // PROGRESS & RECENT  (localStorage)
    // Progress schema v2 (Phase 0A): the logical character offset is the source
    // of truth; visual page numbers are layout-dependent. The legacy v1 fields
    // page/total are still written (as the containing logical chunk) so an
    // older client keeps working after a rollback.
    // =========================================================================

    // Saved progress belongs to one edition of the text. A different or missing
    // bookVersion (catalog.json) means the stored offsets no longer map to this
    // text, so the record is ignored (and overwritten on the next persist).
    function loadProgressRaw(bId, ver) {
        try {
            const raw = JSON.parse(localStorage.getItem('arie_p_' + bId)) || null;
            return raw && raw.bv === ver ? raw : null;
        }
        catch(e) { return null; }
    }

    // Library card display adapter — understands both v1 and v2 records.
    function progressDisplay(bId, ver) {
        const raw = loadProgressRaw(bId, ver);
        if (!raw) return null;
        if (raw.v === 2) {
            return {
                pct: Math.round((raw.percent || 0) * 100),
                page: raw.visualPage || 1,
                total: raw.visualTotal || 1
            };
        }
        if (raw.page && raw.total) {
            return {
                pct: Math.round((raw.page / raw.total) * 100),
                page: raw.page,
                total: raw.total
            };
        }
        return null;
    }

    function addToRecent(bId) {
        try {
            let r = JSON.parse(localStorage.getItem('arie_recent') || '[]');
            r = [bId, ...r.filter(x => x !== bId)].slice(0, 8);
            localStorage.setItem('arie_recent', JSON.stringify(r));
        } catch(e) {}
    }

    function getRecent() {
        try { return JSON.parse(localStorage.getItem('arie_recent') || '[]'); }
        catch(e) { return []; }
    }


    // =========================================================================
    // LIBRARY MODULE
    // =========================================================================

    let allBooks = [];
    let libraryLoaded = false;

    function getInitials(title) {
        const words = title.replace(/[-_]/g, ' ').split(/\s+/).filter(w => w.length > 1);
        if (!words.length) return (title[0] || '?').toUpperCase();
        if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
        return (words[0][0] + words[1][0]).toUpperCase();
    }

    function coverGradient(title) {
        let h = 5381;
        for (let i = 0; i < title.length; i++) {
            h = (((h << 5) + h) ^ title.charCodeAt(i)) | 0;
        }
        const hue = ((h % 360) + 360) % 360;
        const hue2 = (hue + 45) % 360;
        return `linear-gradient(150deg, hsl(${hue},32%,13%) 0%, hsl(${hue2},22%,8%) 100%)`;
    }

    function makeBookCard(book) {
        const progress = progressDisplay(book.id, book.bookVersion || 1);
        const pct = progress ? progress.pct : 0;
        const hasProgress = pct > 0;

        const card = document.createElement('article');
        card.className = 'book-card';
        card.dataset.id = book.id;

        const safeTitle = book.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Prefer author, fall back to subtitle; show nothing if neither exists
        const secondary = (book.author || book.subtitle || '').replace(/</g, '&lt;');
        const gradient = coverGradient(book.title);
        const coverImg = book.cover
            ? `<img src="${book.cover}" alt="" class="cover-img"
                   onerror="this.style.display='none';this.nextElementSibling.style.display=''">`
            : '';

        card.innerHTML = `
            <div class="book-cover" style="background:${gradient}" role="img" aria-label="Корица: ${safeTitle}">
                ${coverImg}
                <span class="book-initials" aria-hidden="true"${book.cover ? ' style="display:none"' : ''}>${getInitials(book.title)}</span>
                <div class="cover-progress-bar" aria-hidden="true">
                    <div class="cover-progress-fill" style="width:${pct}%"></div>
                </div>
            </div>
            <div class="book-info">
                <div class="book-title-text">${safeTitle}</div>
                ${secondary ? `<div class="book-author-text">${secondary}</div>` : ''}
                ${hasProgress ? `<div class="book-progress-text">${pct}% · стр. ${progress.page} от ${progress.total}</div>` : ''}
            </div>
            <button class="btn-read" aria-label="${hasProgress ? 'Продължи' : 'Започни'} ${safeTitle}">
                ${hasProgress ? `Продължи — ${pct}%` : 'Започни четенето'}
            </button>
        `;

        card.addEventListener('click', () => {
            addToRecent(book.id);
            window.location.hash = '#/read/' + encodeURIComponent(book.id);
        });

        return card;
    }

    function renderGrid(el, books) {
        el.innerHTML = '';
        books.forEach(b => el.appendChild(makeBookCard(b)));
    }

    function filterBooks(query) {
        if (!query.trim()) return allBooks;
        const q = query.toLowerCase().trim();
        return allBooks.filter(b =>
            b.title.toLowerCase().includes(q) ||
            (b.author || '').toLowerCase().includes(q)
        );
    }

    async function renderLibrary() {
        // If books are cached, just re-render (progress may have changed)
        if (libraryLoaded) {
            if (allBooks.length > 0) {
                // The reader may have loaded the list first (direct link to a book):
                // the sections are only made visible on the first library load.
                libLoading.classList.remove('visible');
                sectionAll.classList.add('visible');
                renderGrid(gridAll, allBooks);
                renderRecentSection();
            }
            return;
        }

        // First load
        libLoading.classList.add('visible');
        libEmpty.classList.remove('visible');
        sectionAll.classList.remove('visible');
        sectionRecent.classList.remove('visible');

        try {
            const res = await fetch('/api/books');
            if (!res.ok) throw new Error('Грешка при зареждане на книгите.');
            allBooks = await res.json();
            libraryLoaded = true;

            libLoading.classList.remove('visible');

            if (allBooks.length === 0) {
                libEmpty.classList.add('visible');
                return;
            }

            sectionAll.classList.add('visible');
            renderGrid(gridAll, allBooks);
            renderRecentSection();

        } catch(e) {
            libLoading.classList.remove('visible');
            showToast(e.message, 'error');
        }
    }

    function renderRecentSection() {
        const recent = getRecent();
        const recentBooks = recent.map(id => allBooks.find(b => b.id === id)).filter(Boolean);
        if (recentBooks.length > 0) {
            sectionRecent.classList.add('visible');
            renderGrid(gridRecent, recentBooks.slice(0, 6));
        } else {
            sectionRecent.classList.remove('visible');
        }
    }

    // Search
    libSearch.addEventListener('input', (e) => {
        const filtered = filterBooks(e.target.value);
        renderGrid(gridAll, filtered);
        const hasQuery = e.target.value.trim().length > 0;
        libNoResults.classList.toggle('visible', hasQuery && filtered.length === 0);
    });


    // =========================================================================
    // READER MODULE — Phase 0A lossless client-side visual pagination
    //
    // The book is fetched as ENCRYPTED logical chunks with exact character
    // offsets and stays encrypted at rest in memory. Plaintext exists only in
    // a small bounded cache (PLAIN_CACHE_MAX chunks) while measuring/drawing.
    // A layout pass measures the text with the SAME canvas font that draws it
    // and produces visual pages as contiguous [startOffset, endOffset) ranges:
    //   visualPages[0].startOffset === 0
    //   visualPages[n].endOffset === visualPages[n+1].startOffset
    //   visualPages.at(-1).endOffset === totalChars
    // The virtual cover is visual page 1 and is NOT part of the text offsets.
    // =========================================================================

    // ── Reader state ─────────────────────────────────────────────────────────
    let bookId = '';
    let bookTitle = 'Книга';
    let bookSubtitle = '';
    let bookVersion = 1;
    let encryptionKey = '';
    let fontSize = 20;
    let currentTheme = 'dark';

    // Content model (encrypted at rest)
    let totalChars = 0;
    let chunkCount = 0;
    let chunkStart = [];
    let chunkEnd = [];
    let encChunks = [];
    let legacyTotalPages = 1;

    // Layout state
    let visualPages = [];      // text pages only (cover excluded)
    let layoutMetrics = null;  // metrics the current visualPages were built with
    let layoutSig = '';
    let currentVisual = 0;     // 0 = cover, k >= 1 = visualPages[k - 1]
    let layoutBusy = false;
    let lastLayoutMs = 0;

    // Async-safety
    let generation = 0;        // stale-work token (book switch / repagination)
    let abortCtl = null;       // aborts in-flight chunk fetches
    let resizeTimer = null;

    // ── Named layout constants (see V2_PHASE0A_PAGINATION_DEFECT.md) ────────
    const LAYOUT_VERSION = 1;      // bump on layout algorithm changes
    const TEXT_TOP = 55;           // first line top; header title renders at y=22
    const FRAME_INSET = 10;        // inner border inset (renderer draws at 10px)
    const FOOTER_TOP_FROM_BOTTOM = 32;  // footer info line top offset from bottom
    const FOOTER_CLEARANCE = 12;   // min gap between text glyphs and the footer
    const LINE_HEIGHT_FACTOR = 1.6;     // line advance = fontSize * 1.6 (legacy rhythm)
    const PARA_ADVANCE_FACTOR = 1.35;   // advance after a paragraph's last line
    const BLANK_ADVANCE_FACTOR = 0.75;  // advance for a blank source line
    const CHUNK_BATCH = 64;        // client batch size (server cap: 64)
    const PLAIN_CACHE_MAX = 6;     // max simultaneously decrypted chunks

    // Reading themes. The palette is defined ONCE, in CSS (--reader-* variables
    // under [data-theme] in styles.css); the canvas reads the same variables, so
    // DOM and canvas can never disagree.
    const THEMES = ['dark', 'sepia', 'light'];
    let colors = {};   // canvas palette for the active theme

    function readThemeColors() {
        const cs = getComputedStyle(document.documentElement);
        const v = n => cs.getPropertyValue('--reader-' + n).trim();
        colors = {
            bg: v('bg'), text: v('text'), meta: v('meta'), border: v('border'),
            gold: v('gold'), goldLine: v('gold-line'), subtitle: v('subtitle'),
            vignette: v('vignette')
        };
    }

    function savedTheme() {
        try {
            const t = localStorage.getItem('arie_theme');
            return THEMES.includes(t) ? t : 'dark';
        } catch (e) { return 'dark'; }
    }

    // Applies a theme and redraws the CURRENT page only: no reload, no relayout,
    // so the reading position (currentVisual / offsets) is untouched.
    function setTheme(name, persist) {
        if (!THEMES.includes(name)) name = 'dark';
        currentTheme = name;
        document.documentElement.setAttribute('data-theme', name);
        if (persist) { try { localStorage.setItem('arie_theme', name); } catch (e) {} }
        readThemeColors();
        themeMenu.querySelectorAll('[data-theme-opt]').forEach(b =>
            b.setAttribute('aria-checked', String(b.dataset.themeOpt === name)));
        renderCurrent();
    }

    // Initial theme: the inline <script> in <head> already set data-theme.
    currentTheme = savedTheme();
    document.documentElement.setAttribute('data-theme', currentTheme);
    readThemeColors();
    themeMenu.querySelectorAll('[data-theme-opt]').forEach(b =>
        b.setAttribute('aria-checked', String(b.dataset.themeOpt === currentTheme)));

    // ── XOR Decryption (unchanged from original) ─────────────────────────────
    function decryptText(base64Str, key) {
        try {
            const binaryStr = atob(base64Str);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

            const encoder = new TextEncoder();
            const keyBytes = encoder.encode(key);
            const decryptedBytes = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) decryptedBytes[i] = bytes[i] ^ keyBytes[i % keyBytes.length];

            return new TextDecoder('utf-8').decode(decryptedBytes);
        } catch(e) {
            console.error('Decryption error:', e);
            return 'Грешка при декриптиране на съдържанието.';
        }
    }

    // ── Bounded decrypt-on-demand text access ────────────────────────────────
    const plainCache = new Map();   // chunkIndex -> plaintext (FIFO, bounded)

    function chunkPlain(i) {
        if (plainCache.has(i)) return plainCache.get(i);
        const t = decryptText(encChunks[i], encryptionKey);
        plainCache.set(i, t);
        if (plainCache.size > PLAIN_CACHE_MAX) {
            plainCache.delete(plainCache.keys().next().value);
        }
        return t;
    }

    function chunkIndexAt(off) {   // chunk containing absolute offset (binary search)
        let lo = 0, hi = chunkCount - 1;
        const target = Math.max(0, Math.min(totalChars - 1, off));
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (chunkEnd[mid] <= target) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }

    // Decrypts only the chunks overlapping [start, end) and returns that slice.
    function textSlice(start, end) {
        if (start >= end || !chunkCount) return '';
        let out = '';
        let i = chunkIndexAt(start);
        while (i < chunkCount && chunkStart[i] < end) {
            const t = chunkPlain(i);
            out += t.substring(Math.max(0, start - chunkStart[i]),
                               Math.min(t.length, end - chunkStart[i]));
            i++;
        }
        return out;
    }

    // ── Layout metrics: ONE source of truth for measuring AND drawing ────────
    const measureCanvas = document.createElement('canvas');
    const mctx = measureCanvas.getContext('2d');

    function buildLayoutMetrics() {
        const rect = canvasWrapper.getBoundingClientRect();
        const width = rect.width, height = rect.height;
        const marginX = Math.max(45, width * 0.08);
        const fontString = `${fontSize}px 'Lora', serif`;
        mctx.font = fontString;
        // Real glyph box (ascent + descent) of the actual font; safe fallback
        // when TextMetrics bounding boxes are unavailable.
        let asc = fontSize * 0.9, desc = fontSize * 0.25;
        try {
            const probe = mctx.measureText('ЙјgÁў„—');
            if (probe.actualBoundingBoxAscent)  asc  = probe.actualBoundingBoxAscent;
            if (probe.actualBoundingBoxDescent) desc = probe.actualBoundingBoxDescent;
        } catch(e) {}
        return {
            width: width,
            height: height,
            marginX: marginX,
            maxWidth: width - marginX * 2,
            fontString: fontString,
            lineHeight: fontSize * LINE_HEIGHT_FACTOR,
            lineBox: asc + desc,
            textTop: TEXT_TOP,
            // Real safe text zone: glyphs must clear the canvas footer line.
            textBottom: height - FOOTER_TOP_FROM_BOTTOM - FOOTER_CLEARANCE,
            dpr: window.devicePixelRatio || 1
        };
    }

    function layoutSignatureOf(m) {
        return [LAYOUT_VERSION, m.width, m.height, fontSize, m.fontString,
                m.lineHeight, m.dpr].join('|');
    }

    function isHighSurr(c) { return c >= 0xD800 && c <= 0xDBFF; }
    function isLowSurr(c)  { return c >= 0xDC00 && c <= 0xDFFF; }

    // ── Core layout pass ─────────────────────────────────────────────────────
    // sliceFn(start, end) -> string gives windowed access to the text, so the
    // full plaintext never needs to exist as one persistent string.
    function findNewlineFrom(sliceFn, totalLen, from) {
        let p = from;
        while (p < totalLen) {
            const end = Math.min(totalLen, p + 4096);
            const idx = sliceFn(p, end).indexOf('\n');
            if (idx !== -1) return p + idx;
            p = end;
        }
        return -1;
    }

    async function computeLayout(sliceFn, totalLen, m, myGen, onProgress) {
        mctx.font = m.fontString;
        const spaceW = mctx.measureText(' ').width;
        const widthCache = new Map();
        const wordW = (w) => {
            let v = widthCache.get(w);
            if (v === undefined) { v = mctx.measureText(w).width; widthCache.set(w, v); }
            return v;
        };

        const pages = [];
        let pageStart = 0;
        let pageLines = [];
        let y = m.textTop;

        function closePage(endOff) {
            pages.push({ startOffset: pageStart, endOffset: endOff, lines: pageLines });
            pageStart = endOff;
            pageLines = [];
            y = m.textTop;
        }

        function placeTextLine(absStart, absEnd) {
            if (y + m.lineBox > m.textBottom && pageLines.length > 0) closePage(absStart);
            pageLines.push({ startOffset: absStart, endOffset: absEnd, x: m.marginX, y: y });
        }

        function placeBlankLine(absStart, absEnd) {
            if (y > m.textBottom && pageLines.length > 0) closePage(absStart);
            pageLines.push({ startOffset: absStart, endOffset: absEnd, x: m.marginX, y: y, blank: true });
            y += m.lineHeight * BLANK_ADVANCE_FACTOR;
        }

        // Wraps one paragraph. para excludes its newline; absEndExcl includes it
        // (the newline chars ride along with the paragraph's last line range).
        function layoutParagraph(para, absBase, absEndExcl) {
            const n = para.length;
            let i = 0;
            let lineStart = 0;
            let lineWidth = 0;
            let lineHasWord = false;

            function wrapAt(rel) {
                placeTextLine(absBase + lineStart, absBase + rel);
                y += m.lineHeight;
                lineStart = rel;
                lineWidth = 0;
                lineHasWord = false;
            }

            while (i < n) {
                let ws = i;
                while (ws < n && para.charCodeAt(ws) === 32) ws++;
                let we = ws;
                while (we < n && para.charCodeAt(we) !== 32) we++;
                if (ws === we) break;   // only trailing spaces remain — attach to last line

                const word = para.slice(ws, we);
                const w = wordW(word);
                const gapW = (ws - i) * spaceW;

                if (!lineHasWord && w > m.maxWidth) {
                    // Fallback of last resort: a single word wider than the
                    // content area is split by characters (surrogate-safe).
                    let ps = ws;
                    while (ps < we) {
                        let lo = ps + 1, hi = we, fit = ps + 1;
                        while (lo <= hi) {
                            const mid = (lo + hi) >> 1;
                            if (wordW(para.slice(ps, mid)) <= m.maxWidth) { fit = mid; lo = mid + 1; }
                            else hi = mid - 1;
                        }
                        if (fit < we && isLowSurr(para.charCodeAt(fit)) && isHighSurr(para.charCodeAt(fit - 1))) fit--;
                        if (fit <= ps) fit = Math.min(we, ps + (isHighSurr(para.charCodeAt(ps)) ? 2 : 1));
                        if (fit < we) {
                            wrapAt(fit);
                            ps = fit;
                        } else {
                            lineWidth = wordW(para.slice(ps, we));
                            lineHasWord = true;
                            ps = we;
                        }
                    }
                    i = we;
                    continue;
                }

                if (lineHasWord && lineWidth + gapW + w > m.maxWidth) {
                    wrapAt(ws);           // gap spaces stay with the finished line
                    lineWidth = w;
                    lineHasWord = true;
                } else {
                    lineWidth += gapW + w;
                    lineHasWord = true;
                }
                i = we;
            }

            // Paragraph's last line: range runs to absEndExcl (incl. newline).
            placeTextLine(absBase + lineStart, absEndExcl);
            y += m.lineHeight * PARA_ADVANCE_FACTOR;
        }

        let pos = 0;
        let sinceYield = 0;
        while (pos < totalLen) {
            const nl = findNewlineFrom(sliceFn, totalLen, pos);
            const lineEndExcl = nl === -1 ? totalLen : nl + 1;
            let contentEnd = nl === -1 ? totalLen : nl;
            if (contentEnd > pos && sliceFn(contentEnd - 1, contentEnd) === '\r') contentEnd--;
            const para = sliceFn(pos, contentEnd);

            if (para.trim() === '') {
                placeBlankLine(pos, lineEndExcl);
            } else {
                layoutParagraph(para, pos, lineEndExcl);
            }
            sinceYield += lineEndExcl - pos;
            pos = lineEndExcl;

            if (sinceYield > 20000) {   // keep UI responsive; check staleness
                sinceYield = 0;
                if (onProgress) onProgress(pos / totalLen);
                await new Promise(r => setTimeout(r, 0));
                if (myGen !== generation) return null;
            }
        }
        if (totalLen > 0) closePage(totalLen);
        return pages;
    }

    // ── Layout orchestration ─────────────────────────────────────────────────
    async function runLayout(myGen) {
        const t0 = performance.now();
        layoutBusy = true;
        const m = buildLayoutMetrics();
        drawLoadingState('Подреждане на страниците…');
        const pages = await computeLayout(textSlice, totalChars, m, myGen,
            (p) => drawLoadingState('Подреждане на страниците… ' + Math.round(p * 100) + '%'));
        if (!pages || myGen !== generation) return false;

        // Invariant self-check (offsets only): reject a broken layout outright.
        let ok = pages.length > 0 && pages[0].startOffset === 0 &&
                 pages[pages.length - 1].endOffset === totalChars;
        for (let i = 0; ok && i < pages.length; i++) {
            const pg = pages[i];
            if (i + 1 < pages.length && pg.endOffset !== pages[i + 1].startOffset) ok = false;
            let prev = pg.startOffset;
            for (const ln of pg.lines) {
                if (ln.startOffset !== prev) { ok = false; break; }
                prev = ln.endOffset;
            }
            if (ok && prev !== pg.endOffset) ok = false;
        }
        if (!ok) {
            console.error('ARIE layout: offset invariant violation — layout rejected');
            layoutBusy = false;
            showToast('Грешка при подреждане на страниците.', 'error');
            return false;
        }

        visualPages = pages;
        layoutMetrics = m;
        layoutSig = layoutSignatureOf(m);
        plainCache.clear();   // release the decrypted layout window
        lastLayoutMs = Math.round(performance.now() - t0);
        layoutBusy = false;
        return true;
    }

    function findVisualPageByOffset(off) {
        if (!visualPages.length) return 0;
        const target = Math.max(0, Math.min(totalChars - 1, off));
        let lo = 0, hi = visualPages.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (visualPages[mid].endOffset <= target) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }

    async function repaginateAroundOffset() {
        if (!bookId || !encChunks.length || !totalChars) return;
        if (layoutBusy) {   // a pass is running; try again shortly
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(repaginateAroundOffset, 300);
            return;
        }
        const keepOffset = currentVisual === 0 ? -1 : visualPages[currentVisual - 1].startOffset;
        const myGen = ++generation;
        if (!(await runLayout(myGen))) return;
        currentVisual = keepOffset < 0 ? 0 : findVisualPageByOffset(keepOffset) + 1;
        renderCurrent();
        persistProgress();
    }

    // ── Progress v2 ──────────────────────────────────────────────────────────
    function persistProgress() {
        try {
            const onCover = currentVisual === 0;
            const off = onCover ? 0 : visualPages[currentVisual - 1].startOffset;
            const legacyPage = onCover ? 1 : (chunkIndexAt(off) + 2);
            localStorage.setItem('arie_p_' + bookId, JSON.stringify({
                v: 2,
                bv: bookVersion,
                offset: off,
                percent: totalChars ? off / totalChars : 0,
                visualPage: currentVisual + 1,
                visualTotal: visualPages.length + 1,
                legacyPage: legacyPage,
                page: legacyPage,        // rollback compat: old client reads saved.page
                total: legacyTotalPages, // rollback compat: old client validates range
                ts: Date.now(),
                layoutSignature: layoutSig
            }));
        } catch(e) {}
    }

    // v1 -> v2 resolution. v1 page semantics: 1 = cover, K >= 2 = chunk[K - 2]
    // (proven by tests/pagination-conservation.test.js "legacy parity").
    // The original record is never removed before a successful v2 write.
    function resolveStartPosition(saved) {
        if (!saved || typeof saved !== 'object') return { cover: true, offset: 0 };
        if (saved.v === 2) {
            const off = Number(saved.offset);
            if (Number.isFinite(off) && off >= 0 && off < totalChars) {
                return { cover: off === 0 && saved.visualPage === 1, offset: off };
            }
            return { cover: true, offset: 0 };
        }
        const p = Number(saved.page);
        if (!Number.isFinite(p) || p <= 1) return { cover: true, offset: 0 };
        if (p >= 2 && p - 2 < chunkCount) return { cover: false, offset: chunkStart[p - 2] };
        // Stale v1 (content/total changed): safe percent-based approximation.
        const t = Number(saved.total);
        if (Number.isFinite(t) && t > 1 && totalChars > 0) {
            const approx = Math.min(totalChars - 1,
                Math.max(0, Math.round(((p - 1) / (t - 1)) * totalChars)));
            return { cover: false, offset: chunkStart[chunkIndexAt(approx)] };
        }
        return { cover: true, offset: 0 };
    }

    // ── Fonts: measure only after the reader font is actually available ─────
    function fontsReady() {
        try {
            if (document.fonts && document.fonts.ready) {
                document.fonts.load(`${fontSize}px 'Lora'`).catch(() => {});
                document.fonts.load(`italic 11px 'Outfit'`).catch(() => {});
                // Don't block reading forever on a hung font download.
                return Promise.race([
                    document.fonts.ready,
                    new Promise(r => setTimeout(r, 3000))
                ]);
            }
        } catch(e) {}
        return Promise.resolve();   // Font Loading API unavailable — proceed
    }

    // ── Book loading ─────────────────────────────────────────────────────────
    function openBookInReader(id) {
        if (id === bookId && visualPages.length) {
            renderCurrent();
            return;
        }
        bookId = id;
        if (abortCtl) abortCtl.abort();   // cancel work for the previous book
        abortCtl = new AbortController();
        const myGen = ++generation;
        visualPages = []; layoutMetrics = null; layoutSig = '';
        encChunks = []; chunkStart = []; chunkEnd = [];
        totalChars = 0; chunkCount = 0; currentVisual = 0;
        plainCache.clear();
        loadReaderBookList(myGen);
    }

    async function loadReaderBookList(myGen) {
        try {
            let books = allBooks;
            if (!books.length) {
                const res = await fetch('/api/books');
                if (!res.ok) throw new Error('Неуспешно зареждане на списъка с книги.');
                books = await res.json();
                allBooks = books;
                libraryLoaded = true;
            }
            if (myGen !== generation) return;

            bookSelect.innerHTML = '';
            books.forEach(book => {
                const opt = document.createElement('option');
                opt.value = book.id;
                opt.textContent = book.title;
                bookSelect.appendChild(opt);
            });

            if (!bookId && books.length > 0) bookId = books[0].id;
            bookSelect.value = bookId;

            await loadBook(bookId, myGen);

        } catch(e) {
            showToast(e.message, 'error');
        }
    }

    async function loadBook(id, myGen) {
        try {
            layoutBusy = true;
            drawLoadingState('Зареждане на книгата…');

            const res = await fetch('/api/books/' + id + '/read', { signal: abortCtl.signal });
            if (!res.ok) throw new Error('Книгата не беше намерена.');
            const data = await res.json();
            if (myGen !== generation) return;
            if (!Array.isArray(data.chunkRanges) || !Number.isFinite(data.totalChars)) {
                throw new Error('Сървърът не поддържа новия формат на четеца.');
            }

            bookTitle    = data.title;
            bookSubtitle = data.subtitle || '';
            bookVersion  = data.bookVersion || 1;
            bookTitleEl.textContent = bookTitle;
            document.title = 'ARIE — ' + bookTitle;
            encryptionKey = atob(data.meta);
            totalChars = data.totalChars;
            chunkCount = data.chunkCount;
            chunkEnd = data.chunkRanges;
            chunkStart = chunkEnd.map((e, i) => (i === 0 ? 0 : chunkEnd[i - 1]));
            legacyTotalPages = data.totalPages;
            encChunks = new Array(chunkCount);

            // Batched download of encrypted chunks (kept encrypted at rest).
            for (let from = 0; from < chunkCount; from += CHUNK_BATCH) {
                const to = Math.min(chunkCount - 1, from + CHUNK_BATCH - 1);
                const r = await fetch('/api/books/' + id + '/chunks?from=' + from + '&to=' + to,
                    { signal: abortCtl.signal });
                if (!r.ok) throw new Error('Грешка при зареждане на съдържанието.');
                const batch = await r.json();
                if (myGen !== generation) return;
                for (const c of batch.chunks) encChunks[c.index] = c.content;
                drawLoadingState('Зареждане… ' + Math.round(((to + 1) / chunkCount) * 100) + '%');
            }

            await fontsReady();
            if (myGen !== generation) return;

            const target = resolveStartPosition(loadProgressRaw(id, bookVersion));
            if (!(await runLayout(myGen))) return;
            currentVisual = target.cover ? 0 : findVisualPageByOffset(target.offset) + 1;
            renderCurrent();
            persistProgress();

            // If the reader font was still downloading when we measured (the
            // fontsReady timeout fired first), re-run the layout ONCE when the
            // font actually arrives, so measure and draw always share a font.
            try {
                if (document.fonts && document.fonts.status !== 'loaded') {
                    document.fonts.ready.then(() => {
                        if (myGen === generation) repaginateAroundOffset();
                    });
                }
            } catch(e) {}

        } catch(e) {
            if (e && e.name === 'AbortError') return;
            layoutBusy = false;
            showToast(e.message || 'Грешка при зареждане.', 'error');
        }
    }

    // Dropdown change → update hash
    bookSelect.addEventListener('change', () => {
        const selectedId = bookSelect.value;
        if (selectedId && selectedId !== bookId) {
            addToRecent(selectedId);
            window.location.hash = '#/read/' + encodeURIComponent(selectedId);
        }
    });

    // ── HUD ──────────────────────────────────────────────────────────────────
    function updateHud() {
        currentPageNumEl.textContent = currentVisual + 1;
        totalPagesNumEl.textContent = visualPages.length + 1;
        // Progress fill formula: read-through fraction by logical offset —
        // cover fills 0%, a text page fills endOffset / totalChars.
        const off = currentVisual === 0 ? 0 : visualPages[currentVisual - 1].endOffset;
        progressBarFill.style.width = (totalChars ? (off / totalChars) * 100 : 0) + '%';
    }

    // ── CANVAS RENDERING ──────────────────────────────────────────────────────

    function drawLogoWatermark(ctx, width, height) {
        ctx.save();
        ctx.globalAlpha = 0.055;
        ctx.strokeStyle = colors.gold;
        ctx.fillStyle = colors.gold;
        ctx.lineCap = 'round';

        const size = 48, stepX = 130, stepY = 130;
        const sc = size / 100;

        for (let x = stepX / 2; x < width + stepX; x += stepX) {
            for (let y = stepY / 2; y < height + stepY; y += stepY) {
                ctx.save();
                ctx.translate(x - size / 2, y - size / 2);
                ctx.scale(sc, sc);

                ctx.lineWidth = 2.5 / sc;
                ctx.beginPath();
                ctx.moveTo(23, 72);
                ctx.bezierCurveTo(37, 67, 47, 42, 50, 18);
                ctx.bezierCurveTo(53, 42, 63, 67, 77, 72);
                ctx.stroke();

                ctx.lineWidth = 1.5 / sc;
                ctx.beginPath();
                ctx.moveTo(37, 52); ctx.bezierCurveTo(47, 59, 50, 56, 63, 52);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(50, 37); ctx.lineTo(55, 43);
                ctx.lineTo(50, 49); ctx.lineTo(45, 43);
                ctx.closePath(); ctx.fill();

                ctx.restore();
            }
        }
        ctx.restore();
    }

    // Greedy word wrap with the CURRENT ctx.font; the last allowed line is cut
    // with an ellipsis when the text does not fit in maxLines.
    function wrapLines(text, maxW, maxLines) {
        const lines = [];
        let cur = '';
        for (const word of String(text).split(/\s+/).filter(Boolean)) {
            const next = cur ? cur + ' ' + word : word;
            if (cur && ctx.measureText(next).width > maxW) { lines.push(cur); cur = word; }
            else cur = next;
        }
        if (cur) lines.push(cur);
        if (lines.length > maxLines) {
            let last = lines.slice(maxLines - 1).join(' ');
            while (last.length > 1 && ctx.measureText(last + '…').width > maxW) last = last.slice(0, -1);
            lines.length = maxLines - 1;
            lines.push(last.trimEnd() + '…');
        }
        return lines;
    }

    function renderCover() {
        const rect = canvasWrapper.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        canvas.width  = rect.width  * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const w = rect.width, h = rect.height;

        // Background
        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, w, h);

        // Radial glow
        const vig = ctx.createRadialGradient(w / 2, h * 0.4, h * 0.05, w / 2, h * 0.4, h * 0.7);
        vig.addColorStop(0, 'rgba(212,175,55,0.05)');
        vig.addColorStop(1, colors.vignette);
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);

        // Horizontal gold lines
        ctx.strokeStyle = colors.goldLine;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(w * 0.12, h * 0.22); ctx.lineTo(w * 0.88, h * 0.22);
        ctx.moveTo(w * 0.12, h * 0.78); ctx.lineTo(w * 0.88, h * 0.78);
        ctx.stroke();

        // Logo centered above title
        const ls = Math.min(w * 0.18, 72);
        const sc = ls / 100;
        ctx.save();
        ctx.translate(w / 2 - ls / 2, h * 0.28 - ls / 2);
        ctx.scale(sc, sc);
        ctx.strokeStyle = colors.gold;
        ctx.fillStyle   = colors.gold;
        ctx.lineCap = 'round';

        ctx.lineWidth = 2.5 / sc;
        ctx.beginPath();
        ctx.moveTo(23, 72); ctx.bezierCurveTo(37, 67, 47, 42, 50, 18);
        ctx.bezierCurveTo(53, 42, 63, 67, 77, 72);
        ctx.stroke();

        ctx.lineWidth = 1.5 / sc;
        ctx.beginPath();
        ctx.moveTo(37, 52); ctx.bezierCurveTo(47, 59, 50, 56, 63, 52);
        ctx.stroke();

        ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(50, 18); ctx.lineTo(50, 76); ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.moveTo(50, 37); ctx.lineTo(55, 43); ctx.lineTo(50, 49); ctx.lineTo(45, 43);
        ctx.closePath(); ctx.fill();
        ctx.restore();

        // Title
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        const tSize = Math.min(Math.max(w * 0.044, 16), 28);
        ctx.fillStyle = colors.gold;
        ctx.font = `700 ${tSize}px 'Outfit', sans-serif`;
        const maxW = w * 0.76;   // inside the gold rules (0.12 .. 0.88)
        const titleLines = wrapLines(bookTitle, maxW, 3);
        const titleLh = tSize * 1.3;
        titleLines.forEach((ln, i) => ctx.fillText(ln, w / 2, h * 0.52 + i * titleLh));

        // Subtitle (wrapped + clamped to 3 lines with an ellipsis; data stays whole)
        if (bookSubtitle) {
            const sSize = tSize * 0.6;
            ctx.fillStyle = colors.subtitle;
            ctx.font = `italic ${sSize}px 'Lora', serif`;
            const y0 = h * 0.52 + (titleLines.length - 1) * titleLh + tSize * 1.7;
            wrapLines(bookSubtitle, maxW, 3).forEach((ln, i) => ctx.fillText(ln, w / 2, y0 + i * sSize * 1.4));
        }

        // Footer
        ctx.fillStyle = colors.meta;
        ctx.font = `10px 'Outfit', sans-serif`;
        ctx.letterSpacing = '0.12em';
        ctx.fillText('ARIE SECURE READER', w / 2, h * 0.83);
    }

    function drawLoadingState(msg) {
        const rect = canvasWrapper.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        canvas.width  = rect.width  * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const w = rect.width, h = rect.height;

        ctx.fillStyle = colors.bg;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(FRAME_INSET, FRAME_INSET, w - FRAME_INSET * 2, h - FRAME_INSET * 2);

        ctx.fillStyle = colors.gold;
        ctx.font = `600 15px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(msg, w / 2, h / 2);

        ctx.fillStyle = colors.meta;
        ctx.font = `10px 'Outfit', sans-serif`;
        ctx.fillText('ARIE SECURE READER', w / 2, h / 2 + 28);
    }

    // Draws a text page from its precomputed lines. The body text uses the
    // EXACT metrics/font the layout measured with (layoutMetrics), so measure
    // and draw can never disagree.
    function renderTextPage(pageIdx) {
        const page = visualPages[pageIdx];
        const m = layoutMetrics;
        if (!page || !m) return;

        const theme = colors;
        const rect  = canvasWrapper.getBoundingClientRect();
        const dpr   = window.devicePixelRatio || 1;
        canvas.width  = rect.width  * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const width = rect.width, height = rect.height;

        // Background
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, width, height);

        // Inner border
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(FRAME_INSET, FRAME_INSET, width - FRAME_INSET * 2, height - FRAME_INSET * 2);

        // Logo watermark (behind the text)
        drawLogoWatermark(ctx, width, height);

        // Header title
        ctx.fillStyle    = theme.meta;
        ctx.font         = `italic 11px 'Outfit', sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(bookTitle, width / 2, 22);

        // Body text
        ctx.fillStyle    = theme.text;
        ctx.font         = m.fontString;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';
        for (const line of page.lines) {
            if (line.blank) continue;
            // Display-only trailing-whitespace strip; offsets stay untouched.
            const s = textSlice(line.startOffset, line.endOffset).replace(/\s+$/g, '');
            if (s) ctx.fillText(s, line.x, line.y);
        }

        // Footer (visual page numbering)
        ctx.fillStyle = theme.meta;
        ctx.font      = `normal 11px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(
            `ARIE SECURE READER  •  Страница ${pageIdx + 2} от ${visualPages.length + 1}`,
            width / 2, height - FOOTER_TOP_FROM_BOTTOM
        );
    }

    function renderCurrent() {
        if (!visualPages.length) return;
        if (currentVisual === 0) renderCover();
        else renderTextPage(currentVisual - 1);
        updateHud();
    }

    // Redraw-only resize: repaginate ONLY when the layout signature changes.
    window.addEventListener('resize', () => {
        if (!screenReader.classList.contains('active') || !visualPages.length) return;
        const m = buildLayoutMetrics();
        if (layoutSignatureOf(m) === layoutSig) { renderCurrent(); return; }
        drawLoadingState('Преподреждане на страниците…');
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(repaginateAroundOffset, 250);
    });

    // ── NAVIGATION ────────────────────────────────────────────────────────────
    // Page flips are synchronous over the precomputed layout (no network, no
    // race); navigation is blocked while a layout pass is running.

    function gotoVisual(idx) {
        if (layoutBusy || !visualPages.length) return;
        if (idx < 0) { showToast('Начало на книгата.', 'info'); return; }
        if (idx > visualPages.length) { showToast('Последна страница на книгата.', 'info'); return; }
        currentVisual = idx;
        renderCurrent();
        persistProgress();
    }

    function prevPage() { gotoVisual(currentVisual - 1); }
    function nextPage() { gotoVisual(currentVisual + 1); }

    prevPageBtn.addEventListener('click', prevPage);
    nextPageBtn.addEventListener('click', nextPage);

    // Font controls → metrics change → repagination around the kept offset
    fontIncreaseBtn.addEventListener('click', () => {
        if (fontSize < 32 && !layoutBusy) { fontSize += 2; repaginateAroundOffset(); }
    });
    fontDecreaseBtn.addEventListener('click', () => {
        if (fontSize > 12 && !layoutBusy) { fontSize -= 2; repaginateAroundOffset(); }
    });

    // Theme menu ("Аа") → redraw only (theme is not part of the layout signature)
    function setThemeMenu(open) {
        themeMenu.hidden = !open;
        themeMenuBtn.setAttribute('aria-expanded', String(open));
    }
    themeMenuBtn.addEventListener('click', () => setThemeMenu(themeMenu.hidden));
    themeMenu.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-theme-opt]');
        if (!opt) return;
        setTheme(opt.dataset.themeOpt, true);
        setThemeMenu(false);
        themeMenuBtn.focus();
    });
    document.addEventListener('click', (e) => {
        if (!themeMenu.hidden && !e.target.closest('.theme-wrap')) setThemeMenu(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !themeMenu.hidden) { setThemeMenu(false); themeMenuBtn.focus(); }
    });
    window.addEventListener('hashchange', () => setThemeMenu(false));

    // Fullscreen (the following resize event triggers repagination if needed)
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                showToast('Грешка при цял екран: ' + err.message, 'error');
            });
        } else {
            document.exitFullscreen();
        }
    });

    // Progress bar click → % of the book by LOGICAL offset → containing page.
    progressContainer.addEventListener('click', (e) => {
        if (layoutBusy || !visualPages.length || !totalChars) return;
        const rect = progressContainer.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const targetOff = Math.min(totalChars - 1, Math.round(pct * totalChars));
        gotoVisual(findVisualPageByOffset(targetOff) + 1);
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (screenReader.classList.contains('active')) {
            if (e.key === 'ArrowLeft')  prevPage();
            if (e.key === 'ArrowRight') nextPage();
        }
    });

    // ── SECURITY SHIELD ───────────────────────────────────────────────────────

    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        triggerSecurityAlert();
    });

    window.addEventListener('beforeprint', (e) => {
        e.preventDefault();
        triggerSecurityAlert();
        showToast('Печатът е строго забранен!', 'error');
    });

    document.addEventListener('copy', (e) => {
        e.preventDefault();
        triggerSecurityAlert();
    });

    document.addEventListener('selectionchange', () => {
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) {
            sel.removeAllRanges();
            triggerSecurityAlert();
        }
    });

    document.addEventListener('keydown', (e) => {
        const meta = navigator.platform.toUpperCase().includes('MAC') ? e.metaKey : e.ctrlKey;
        if (meta && ['c','p','s','u'].includes(e.key.toLowerCase())) {
            e.preventDefault(); triggerSecurityAlert();
        }
        if (e.key === 'F12' || (meta && e.shiftKey && ['i','j'].includes(e.key.toLowerCase()))) {
            e.preventDefault(); triggerSecurityAlert();
        }
    });

    window.addEventListener('blur', () => {
        try { navigator.clipboard.writeText('© ARIE. Защитено авторско право.'); } catch(e) {}
    });

    // ── DIAGNOSTICS HOOK (offsets only; localhost only) ──────────────────────
    // Enables tests/browser-conservation.js. Exposes NO book text — only
    // offsets, counts and timings — and only on a local dev origin.
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
        window.__ARIE_TEST__ = {
            state: () => ({ bookId, totalChars, chunkCount, fontSize, layoutSig,
                            visualCount: visualPages.length, currentVisual,
                            lastLayoutMs, layoutBusy }),
            pageOffsets: () => visualPages.map(p =>
                ({ s: p.startOffset, e: p.endOffset, lines: p.lines.length })),
            lineOffsets: (i) => (visualPages[i] || { lines: [] }).lines.map(l =>
                ({ s: l.startOffset, e: l.endOffset, y: l.y, blank: !!l.blank })),
            chunkStarts: () => chunkStart.slice(),
            findPageByOffset: (off) => findVisualPageByOffset(off),
            gotoVisual: (i) => gotoVisual(i),
            setFontSize: async (fs) => {
                fontSize = Math.max(12, Math.min(32, fs));
                await repaginateAroundOffset();
                return { layoutSig, visualCount: visualPages.length, lastLayoutMs };
            },
            relayout: () => repaginateAroundOffset(),
            layoutFixture: async (text, opts) => {
                const m = Object.assign(buildLayoutMetrics(), opts || {});
                const pages = await computeLayout((s, e) => text.slice(s, e),
                    text.length, m, generation, null);
                return pages ? pages.map(p => ({
                    s: p.startOffset, e: p.endOffset,
                    lines: p.lines.map(l => ({ s: l.startOffset, e: l.endOffset, blank: !!l.blank }))
                })) : null;
            }
        };
    }

    // Router boot — must come last so all let variables are initialized
    window.addEventListener('hashchange', route);
    route();

});
