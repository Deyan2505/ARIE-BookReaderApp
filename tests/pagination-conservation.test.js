// Phase 0A — Server chunking conservation tests (Test 1).
// Run: npm test   (or: node tests/pagination-conservation.test.js)
// No external test framework — plain Node asserts, exit code 1 on failure.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { app, buildChunks, paginateText } = require('../netlify/functions/api.js');

let passed = 0;
let failed = 0;

function isLowSurrogate(code) { return code >= 0xDC00 && code <= 0xDFFF; }
function isHighSurrogate(code) { return code >= 0xD800 && code <= 0xDBFF; }

// Core conservation contract for one input text.
function checkConservation(label, text) {
    try {
        const chunks = buildChunks(text);

        // 1) Byte-exact reconstruction (string + UTF-8 buffer equality).
        const reconstructed = chunks.map(c => c.text).join('');
        assert.strictEqual(reconstructed, text, 'join(chunks) !== originalText');
        assert.ok(
            Buffer.from(reconstructed, 'utf8').equals(Buffer.from(text, 'utf8')),
            'UTF-8 Buffer equality failed'
        );

        // 2) Offset continuity: contiguous, gap-free, overlap-free, full cover.
        if (text.length === 0) {
            assert.strictEqual(chunks.length, 0, 'empty text must produce 0 chunks');
        } else {
            assert.strictEqual(chunks[0].startOffset, 0, 'first chunk must start at 0');
            assert.strictEqual(chunks[chunks.length - 1].endOffset, text.length,
                'last chunk must end at text.length');
        }
        for (let i = 0; i < chunks.length; i++) {
            const c = chunks[i];
            assert.strictEqual(c.index, i, 'index must be sequential');
            assert.ok(c.endOffset > c.startOffset, 'chunk must be non-empty');
            assert.strictEqual(c.text, text.substring(c.startOffset, c.endOffset),
                'chunk.text must equal its exact source range');
            if (i > 0) {
                assert.strictEqual(chunks[i - 1].endOffset, c.startOffset,
                    `chunk[${i - 1}].endOffset !== chunk[${i}].startOffset`);
            }
        }

        // 3) No UTF-16 surrogate pair is split at any internal boundary.
        for (let i = 1; i < chunks.length; i++) {
            const b = chunks[i].startOffset;
            assert.ok(
                !(isHighSurrogate(text.charCodeAt(b - 1)) && isLowSurrogate(text.charCodeAt(b))),
                `surrogate pair split at boundary offset ${b}`
            );
        }

        console.log(`  PASS  ${label} (${text.length} chars, ${chunks.length} chunks)`);
        passed++;
        return chunks;
    } catch (e) {
        console.error(`  FAIL  ${label}: ${e.message}`);
        failed++;
        return null;
    }
}

console.log('== Test 1: server chunking conservation ==');

// ── Real books: every entry of data/catalog.json ───────────────────────────
const root = path.join(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data', 'catalog.json'), 'utf8'));
const netlifyToml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');

function check(label, fn) {
    try { fn(); console.log(`  PASS  ${label}`); passed++; }
    catch (e) { console.error(`  FAIL  ${label}: ${e.message}`); failed++; }
}

const books = catalog.books.map(entry => {
    const text = fs.readFileSync(path.join(root, entry.textFile), 'utf8');
    return { entry, text, chunks: checkConservation(`real book ${entry.id}`, text) };
});

// BOM decision (documented): a BOM is treated as content and preserved.
// The real books have no BOM; the synthetic case below proves preservation.
for (const { entry, text } of books) {
    check(`${entry.id}: no BOM`, () => assert.ok(text.charCodeAt(0) !== 0xFEFF, 'starts with BOM'));
}

// ── Catalog integrity: a bad entry here is a production 404 / wrong-progress bug
console.log('== Catalog integrity ==');
const ids = new Set();
for (const { entry, text } of books) {
    check(`catalog ${entry.id}`, () => {
        assert.ok(!ids.has(entry.id), 'duplicate id');
        ids.add(entry.id);
        assert.ok(/^[a-z0-9-]+$/.test(entry.id), 'id must match ^[a-z0-9-]+$');
        assert.ok(entry.title && entry.author, 'title and author are required');
        assert.ok(Number.isInteger(entry.bookVersion) && entry.bookVersion >= 1,
            'bookVersion must be an integer >= 1 (bump it when the text is replaced)');
        assert.ok(entry.status === 'published' || entry.status === 'draft', 'unknown status');
        assert.ok(entry.cover && fs.existsSync(path.join(root, 'public', entry.cover)),
            'cover file missing: ' + entry.cover);
        assert.ok(fs.statSync(path.join(root, 'public', entry.cover)).size <= 3 * 1024 * 1024,
            'cover over 3 MB');
        assert.ok(Buffer.byteLength(text) <= 5 * 1024 * 1024, 'text over 5 MB');
        assert.ok(!text.includes('�'), 'contains U+FFFD (broken encoding)');
        assert.ok(netlifyToml.includes(`"${entry.textFile}"`),
            `netlify.toml included_files lacks ${entry.textFile} (production would 404)`);
    });
}
const bookText = books[0].text;
const bookChunks = books[0].chunks;

// ── Synthetic structures ───────────────────────────────────────────────────
checkConservation('empty text', '');
checkConservation('whitespace only', ' \n \n\n   \n '.repeat(120));
checkConservation('single very long paragraph (no newlines)',
    ('дума '.repeat(240) + 'край.').repeat(3));
checkConservation('dialogue sequence',
    Array.from({ length: 80 }, (_, i) => `— Реплика номер ${i}, казана тихо.`).join('\n'));
checkConservation('multiple consecutive blank lines at boundary',
    'а'.repeat(1195) + '\n\n\n\n\n' + 'б'.repeat(1300) + '\n\n\n' + 'в'.repeat(400));
checkConservation('CRLF text',
    ('Ред едно с текст на кирилица.\r\n\r\nВтори абзац след празен ред.\r\n').repeat(60));
checkConservation('LF text',
    ('Ред едно с текст на кирилица.\n\nВтори абзац след празен ред.\n').repeat(60));
checkConservation('Unicode punctuation near boundary',
    ('„Цитат” — каза тя… и продължи: —— ―дълги тирета― «ъгловати» ’апострофи’ ').repeat(40));
checkConservation('surrogate pairs (emoji) across boundaries',
    'а'.repeat(1190) + '😀😃😄😁😆😅🤣😂'.repeat(6) + 'б'.repeat(1250) + '🧠📚'.repeat(300));
checkConservation('word wider than any page',
    'нормален текст ' + 'щ'.repeat(3000) + ' и още текст след дългата дума');
checkConservation('no trailing newline', 'Финално изречение без нов ред в края');
checkConservation('BOM preserved as content', '﻿' + 'Текст след BOM.\n\nВтори абзац.'.repeat(80));
checkConservation('exact multiple of target length', 'х'.repeat(2400));

// ── Legacy /page parity and v1 progress migration formula ─────────────────
console.log('== Legacy parity: paginateText vs buildChunks ==');
for (const { entry, text, chunks } of books) {
    check(`legacy parity ${entry.id}`, () => {
        const pages = paginateText(text);
        assert.strictEqual(pages[0], '##COVER##', 'page 1 must be the virtual cover');
        assert.strictEqual(pages.length, chunks.length + 1,
            'legacy totalPages must equal chunkCount + 1');
        // Migration formula proof: legacy API page K (K >= 2) === chunk[K - 2].
        for (const K of [2, 6, 7, 100, pages.length]) {
            assert.strictEqual(pages[K - 1], chunks[K - 2].text,
                `legacy page ${K} !== chunk[${K - 2}]`);
        }
    });
}

// ── Boundary markers for the known screenshot regression (offsets only) ────
check('screenshot boundary: chunk6/chunk7 contiguous', () => {
    const c6 = bookChunks[4]; // legacy visual page 6
    const c7 = bookChunks[5]; // legacy visual page 7
    assert.strictEqual(c6.endOffset, c7.startOffset, 'chunk 6/7 must be contiguous');
});

// ── HTTP: the real API over the real catalog ───────────────────────────────
async function apiChecks() {
    console.log('== API (local app) ==');
    const server = require('http').createServer(app);
    await new Promise(r => server.listen(0, r));
    const base = 'http://localhost:' + server.address().port;
    try {
        const published = catalog.books.filter(b => b.status === 'published');
        const list = await (await fetch(base + '/api/books')).json();
        check('/api/books lists exactly the published books', () => {
            assert.deepStrictEqual(list.map(b => b.id).sort(), published.map(b => b.id).sort());
            for (const b of list) {
                assert.strictEqual(b.bookVersion, catalog.books.find(x => x.id === b.id).bookVersion,
                    `${b.id}: bookVersion not exposed`);
            }
        });
        for (const { entry, text, chunks } of books.filter(b => b.entry.status === 'published')) {
            const r = await (await fetch(`${base}/api/books/${entry.id}/read`)).json();
            check(`/read ${entry.id}`, () => {
                assert.strictEqual(r.totalChars, text.length);
                assert.strictEqual(r.chunkCount, chunks.length);
                assert.strictEqual(r.chunkRanges[r.chunkRanges.length - 1], text.length);
                assert.strictEqual(r.bookVersion, entry.bookVersion);
                assert.strictEqual(r.title, entry.title);
            });
        }
    } catch (e) {
        console.error(`  FAIL  api: ${e.message}`);
        failed++;
    }
    server.closeAllConnections();   // fetch keep-alive would otherwise hold the process open
    server.close();
}

apiChecks().then(() => {
    console.log(`\n== RESULT: ${passed} passed, ${failed} failed ==`);
    process.exitCode = failed === 0 ? 0 : 1;   // let the loop drain; process.exit() on Windows trips a libuv assert
});
