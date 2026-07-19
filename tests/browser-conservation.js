// Phase 0A — Visual pagination conservation tests (Tests 2–7).
// NOT deployed (lives outside public/). Run against a LOCAL dev server:
//   1. node server.js  (http://localhost:3101 or :3001)
//   2. Open http://localhost:<port>/#/read/<bookId> and let the book load.
//   3. Paste this whole file in the browser console (or run via the preview
//      tool's javascript_exec) and: await __ARIE_CONSERVATION__.runAll()
// The reader exposes window.__ARIE_TEST__ (offsets only) on localhost only.
'use strict';

window.__ARIE_CONSERVATION__ = (() => {

    const T = () => {
        if (!window.__ARIE_TEST__) throw new Error('__ARIE_TEST__ hook missing (localhost only)');
        return window.__ARIE_TEST__;
    };

    // Tests 2–4 via offsets: conservation, boundary continuity, no overlap.
    // (Offset ranges are the source of truth — not lines.map(text).join(''),
    // because visual wrapping legitimately re-distributes inter-word spaces.)
    function checkBookInvariants() {
        const st = T().state();
        const pages = T().pageOffsets();
        if (!pages.length) return 'NO PAGES';
        if (pages[0].s !== 0) return 'first.startOffset !== 0';
        if (pages[pages.length - 1].e !== st.totalChars) return 'last.endOffset !== totalChars';
        for (let i = 0; i + 1 < pages.length; i++) {
            if (pages[i].e !== pages[i + 1].s) return 'discontinuity at page ' + i;
            if (pages[i].e <= pages[i].s) return 'empty page ' + i;
        }
        const idxs = [0, pages.length - 1];
        for (let i = 25; i < pages.length; i += 25) idxs.push(i);
        for (const pi of idxs) {
            const lines = T().lineOffsets(pi);
            let prev = pages[pi].s;
            for (const l of lines) { if (l.s !== prev) return 'line gap page ' + pi; prev = l.e; }
            if (prev !== pages[pi].e) return 'line end mismatch page ' + pi;
        }
        return 'OK';
    }

    // Test 6: all font sizes at the current viewport.
    async function runFontSweep() {
        const results = [];
        for (let fs = 12; fs <= 32; fs += 2) {
            const r = await T().setFontSize(fs);
            results.push({ fs, pages: r.visualCount, ms: r.lastLayoutMs, inv: checkBookInvariants() });
        }
        await T().setFontSize(20);
        return results;
    }

    // Test 7: content structure fixtures through the same layout engine.
    function validateFixture(pages, totalLen) {
        if (totalLen === 0) return pages.length === 0 ? 'OK' : 'expected 0 pages';
        if (!pages || !pages.length) return 'no pages';
        if (pages[0].s !== 0) return 'first!=0';
        if (pages[pages.length - 1].e !== totalLen) return 'last!=len';
        for (let i = 0; i + 1 < pages.length; i++) if (pages[i].e !== pages[i + 1].s) return 'gap@' + i;
        for (const p of pages) {
            let prev = p.s;
            for (const l of p.lines) { if (l.s !== prev) return 'lineGap'; prev = l.e; }
            if (prev !== p.e) return 'lineEnd';
        }
        return 'OK';
    }

    async function runFixtures() {
        const fixtures = {
            normalParagraph: 'Обикновен абзац с няколко изречения. Второ изречение.\n\nВтори абзац.',
            veryLongParagraph: ('дума с текст и още думи в дълъг поток ').repeat(200),
            dialogueSequence: Array.from({ length: 40 }, (_, i) => `— Реплика ${i} — каза някой.`).join('\n'),
            headingThenText: 'ГЛАВА ПЪРВА\n\nТекстът започва тук.',
            multipleBlankLines: 'Първи ред.\n\n\n\n\nВтори ред.',
            noTrailingNewline: 'Финал без нов ред в края',
            wordWiderThanCanvas: 'нормално ' + 'щ'.repeat(400) + ' продължение',
            crlf: 'Ред едно.\r\n\r\nРед две.\r\nРед три.',
            surrogatePairs: ('текст 😀😃 с емоджита 🧠 и още ').repeat(60),
            whitespaceOnly: '   \n\n  \n ',
            zeroLength: ''
        };
        const out = {};
        for (const [name, text] of Object.entries(fixtures)) {
            const pages = await T().layoutFixture(text);
            out[name] = pages === null ? 'ABORTED' : validateFixture(pages, text.length);
        }
        return out;
    }

    // Regression for the historical screenshot defect: the 682 characters of
    // legacy chunk 6 ([4533, 5582)) that the old renderer silently dropped
    // must belong to reachable, contiguous visual pages.
    function runScreenshotRegression() {
        const pages = T().pageOffsets();
        const lostStart = 4873, lostEnd = 5582;
        const pA = T().findPageByOffset(lostStart);
        const pB = T().findPageByOffset(lostEnd - 1);
        const covered = pages[pA].s <= lostStart && pages[pB].e >= lostEnd;
        const contiguous = pages.slice(pA, pB + 1)
            .every((p, i, arr) => i === 0 || arr[i - 1].e === p.s);
        return { lostRange: [lostStart, lostEnd], onPages: [pA, pB],
                 fullyCovered: covered, boundariesContiguous: contiguous,
                 verdict: covered && contiguous ? 'OK' : 'FAIL' };
    }

    // Test 5 note: the responsive matrix is driven from OUTSIDE the page
    // (resize the window/emulator to 1440×900, 1366×768, 1024×768, 768×1024,
    // 430×932, 390×844) and call runAll() at each size.
    async function runAll() {
        return {
            invariants: checkBookInvariants(),
            fontSweep: await runFontSweep(),
            fixtures: await runFixtures(),
            screenshotRegression: runScreenshotRegression()
        };
    }

    return { checkBookInvariants, runFontSweep, runFixtures, runScreenshotRegression, runAll };
})();
