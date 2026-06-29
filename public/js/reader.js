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
    const themeToggleBtn    = document.getElementById('theme-toggle-btn');
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
    // =========================================================================

    function saveProgress(bId, page, total) {
        try {
            localStorage.setItem('arie_p_' + bId, JSON.stringify({ page, total, ts: Date.now() }));
        } catch(e) {}
    }

    function loadProgress(bId) {
        try { return JSON.parse(localStorage.getItem('arie_p_' + bId)) || null; }
        catch(e) { return null; }
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
        const progress = loadProgress(book.id);
        const pct = progress ? Math.round((progress.page / progress.total) * 100) : 0;
        const hasProgress = pct > 0;

        const card = document.createElement('article');
        card.className = 'book-card';
        card.dataset.id = book.id;

        const safeTitle = book.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Prefer author, fall back to subtitle; show nothing if neither exists
        const secondary = (book.author || book.subtitle || '').replace(/</g, '&lt;');

        card.innerHTML = `
            <div class="book-cover" style="background:${coverGradient(book.title)}" role="img" aria-label="Корица: ${safeTitle}">
                <span class="book-initials" aria-hidden="true">${getInitials(book.title)}</span>
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
    // READER MODULE
    // =========================================================================

    // Reader state
    let bookId = '';
    let bookTitle = 'Книга';
    let bookSubtitle = '';
    let totalPages = 1;
    let currentPage = 1;
    let encryptionKey = '';
    let currentPageDecryptedContent = '';
    let readerInitialized = false;

    // User preferences
    let fontSize = 20;
    let currentTheme = 'dark';

    const themes = {
        'dark': {
            bg: '#121824', text: '#e2e8f0', meta: '#64748b', border: '#1e293b'
        },
        'pitch-black': {
            bg: '#05070a', text: '#cbd5e1', meta: '#475569', border: '#0f172a'
        },
        'sepia': {
            bg: '#1c1710', text: '#dfd2bc', meta: '#8b7c67', border: '#2e251a'
        }
    };

    // Open a book in the reader (called by router)
    function openBookInReader(id) {
        if (id === bookId && currentPageDecryptedContent) {
            // Same book already loaded — just re-render
            renderCanvas();
            return;
        }
        bookId = id;
        loadReaderBookList();
    }

    // Load book list for dropdown + then load the target book
    async function loadReaderBookList() {
        try {
            // Use cached allBooks if available, otherwise fetch
            let books = allBooks;
            if (!books.length) {
                const res = await fetch('/api/books');
                if (!res.ok) throw new Error('Неуспешно зареждане на списъка с книги.');
                books = await res.json();
                allBooks = books;
                libraryLoaded = true;
            }

            bookSelect.innerHTML = '';
            books.forEach(book => {
                const opt = document.createElement('option');
                opt.value = book.id;
                opt.textContent = book.title;
                bookSelect.appendChild(opt);
            });

            if (!bookId && books.length > 0) bookId = books[0].id;
            bookSelect.value = bookId;

            await loadBookData();

        } catch(e) {
            showToast(e.message, 'error');
        }
    }

    // Load book metadata + encryption key
    async function loadBookData() {
        try {
            const res = await fetch('/api/books/' + bookId + '/read');
            if (!res.ok) throw new Error('Книгата не беше намерена.');
            const data = await res.json();

            bookTitle    = data.title;
            bookSubtitle = data.subtitle || '';
            bookTitleEl.textContent = bookTitle;
            document.title = 'ARIE — ' + bookTitle;
            totalPages = data.totalPages;
            totalPagesNumEl.textContent = totalPages;
            encryptionKey = atob(data.meta);

            // Restore saved progress or start from page 1
            const saved = loadProgress(bookId);
            currentPage = (saved && saved.page >= 1 && saved.page <= totalPages) ? saved.page : 1;

            await loadPageContent(currentPage);

        } catch(e) {
            showToast(e.message, 'error');
        }
    }

    // XOR Decryption (unchanged from original)
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

    // Fetch, decrypt and render a page
    async function loadPageContent(pageNum) {
        try {
            currentPageDecryptedContent = '';

            const res = await fetch('/api/books/' + bookId + '/page/' + pageNum);
            if (!res.ok) throw new Error('Грешка при зареждане на страницата.');
            const data = await res.json();

            currentPageDecryptedContent = decryptText(data.content, encryptionKey);

            currentPage = pageNum;
            currentPageNumEl.textContent = pageNum;
            updateProgressBar();
            saveProgress(bookId, pageNum, totalPages);
            renderCanvas();

        } catch(e) {
            showToast(e.message, 'error');
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

    // Progress bar
    function updateProgressBar() {
        progressBarFill.style.width = ((currentPage / totalPages) * 100) + '%';
    }

    // ── CANVAS RENDERING ──────────────────────────────────────────────────────

    function wrapText(context, text, x, y, maxWidth, lineHeight, maxY) {
        const paragraphs = text.split(/\n/);
        let currentY = y;

        for (let p = 0; p < paragraphs.length; p++) {
            if (currentY > maxY) break;

            if (paragraphs[p].trim() === '' && p > 0) {
                currentY += lineHeight * 0.75;
                continue;
            }

            const words = paragraphs[p].split(' ');
            let line = '';

            for (let n = 0; n < words.length; n++) {
                const testLine  = line + words[n] + ' ';
                const testWidth = context.measureText(testLine).width;

                if (testWidth > maxWidth && n > 0) {
                    if (currentY <= maxY) context.fillText(line, x, currentY);
                    line = words[n] + ' ';
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            if (currentY <= maxY) context.fillText(line, x, currentY);
            currentY += lineHeight * 1.35;
        }
    }

    function drawLogoWatermark(ctx, width, height) {
        ctx.save();
        ctx.globalAlpha = 0.055;
        ctx.strokeStyle = '#d4af37';
        ctx.fillStyle = '#d4af37';
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

    function renderCover() {
        const rect = canvasWrapper.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        canvas.width  = rect.width  * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const w = rect.width, h = rect.height;

        // Background
        ctx.fillStyle = themes[currentTheme].bg;
        ctx.fillRect(0, 0, w, h);

        // Radial glow
        const vig = ctx.createRadialGradient(w / 2, h * 0.4, h * 0.05, w / 2, h * 0.4, h * 0.7);
        vig.addColorStop(0, 'rgba(212,175,55,0.05)');
        vig.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);

        // Horizontal gold lines
        ctx.strokeStyle = 'rgba(212,175,55,0.4)';
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
        ctx.strokeStyle = '#d4af37';
        ctx.fillStyle   = '#d4af37';
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
        ctx.fillStyle = '#d4af37';
        ctx.font = `700 ${tSize}px 'Outfit', sans-serif`;
        ctx.fillText(bookTitle, w / 2, h * 0.52);

        // Subtitle
        if (bookSubtitle) {
            ctx.fillStyle = 'rgba(212,175,55,0.6)';
            ctx.font = `italic ${tSize * 0.6}px 'Lora', serif`;
            ctx.fillText(bookSubtitle, w / 2, h * 0.52 + tSize * 1.7);
        }

        // Footer
        ctx.fillStyle = 'rgba(107,114,128,0.6)';
        ctx.font = `10px 'Outfit', sans-serif`;
        ctx.letterSpacing = '0.12em';
        ctx.fillText('ARIE SECURE READER', w / 2, h * 0.83);
    }

    function renderCanvas() {
        if (!currentPageDecryptedContent) return;

        if (currentPageDecryptedContent.trim() === '##COVER##') {
            renderCover();
            return;
        }

        const theme = themes[currentTheme];
        const rect  = canvasWrapper.getBoundingClientRect();
        const dpr   = window.devicePixelRatio || 1;

        canvas.width  = rect.width  * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width  = rect.width;
        const height = rect.height;

        // Background
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, width, height);

        // Inner border
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(10, 10, width - 20, height - 20);

        // Logo watermark
        drawLogoWatermark(ctx, width, height);

        const marginX    = Math.max(45, width * 0.08);
        const marginY    = 55;
        const maxWidth   = width - marginX * 2;
        const lineHeight = fontSize * 1.6;
        const maxY       = height - 50;

        // Header title
        ctx.fillStyle    = theme.meta;
        ctx.font         = `italic 11px 'Outfit', sans-serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(bookTitle, width / 2, 22);

        // Body text
        ctx.fillStyle    = theme.text;
        ctx.font         = `${fontSize}px 'Lora', serif`;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';

        wrapText(ctx, currentPageDecryptedContent, marginX, marginY, maxWidth, lineHeight, maxY);

        // Footer
        ctx.fillStyle = theme.meta;
        ctx.font      = `normal 11px 'Outfit', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(
            `ARIE SECURE READER  •  Страница ${currentPage} от ${totalPages}`,
            width / 2, height - 32
        );
    }

    window.addEventListener('resize', renderCanvas);

    // ── NAVIGATION ────────────────────────────────────────────────────────────

    function prevPage() {
        if (currentPage > 1) { currentPage--; loadPageContent(currentPage); }
        else showToast('Начало на книгата.', 'info');
    }

    function nextPage() {
        if (currentPage < totalPages) { currentPage++; loadPageContent(currentPage); }
        else showToast('Последна страница на книгата.', 'info');
    }

    prevPageBtn.addEventListener('click', prevPage);
    nextPageBtn.addEventListener('click', nextPage);

    // Font controls
    fontIncreaseBtn.addEventListener('click', () => {
        if (fontSize < 32) { fontSize += 2; renderCanvas(); }
    });
    fontDecreaseBtn.addEventListener('click', () => {
        if (fontSize > 12) { fontSize -= 2; renderCanvas(); }
    });

    // Theme cycle
    themeToggleBtn.addEventListener('click', () => {
        if (currentTheme === 'dark')        currentTheme = 'pitch-black';
        else if (currentTheme === 'pitch-black') currentTheme = 'sepia';
        else                                currentTheme = 'dark';
        renderCanvas();
    });

    // Fullscreen
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                showToast('Грешка при цял екран: ' + err.message, 'error');
            });
        } else {
            document.exitFullscreen();
        }
    });

    // Progress bar click to jump
    progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const pct  = (e.clientX - rect.left) / rect.width;
        const target = Math.max(1, Math.min(totalPages, Math.round(pct * totalPages)));
        if (target !== currentPage) { currentPage = target; loadPageContent(currentPage); }
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

    // Router boot — must come last so all let variables are initialized
    window.addEventListener('hashchange', route);
    route();

});
