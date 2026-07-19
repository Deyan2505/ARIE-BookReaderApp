// Phase 0A — Server chunking conservation tests (Test 1).
// Run: npm test   (or: node tests/pagination-conservation.test.js)
// No external test framework — plain Node asserts, exit code 1 on failure.
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { buildChunks, paginateText } = require('../netlify/functions/api.js');

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

// ── Real book ──────────────────────────────────────────────────────────────
const bookPath = path.join(__dirname, '..', 'uploads', '1_Paradoksat-na-bolkata.txt');
const bookText = fs.readFileSync(bookPath, 'utf8');
const bookChunks = checkConservation('real book (Парадоксът на болката)', bookText);

// BOM decision (documented): a BOM is treated as content and preserved.
// The real book has no BOM; the synthetic case below proves preservation.
assert.ok(bookText.charCodeAt(0) !== 0xFEFF, 'real book unexpectedly starts with BOM');
console.log('  INFO  real book has no BOM (charCode[0]=' + bookText.charCodeAt(0) + ')');

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
try {
    const pages = paginateText(bookText);
    assert.strictEqual(pages[0], '##COVER##', 'page 1 must be the virtual cover');
    assert.strictEqual(pages.length, bookChunks.length + 1,
        'legacy totalPages must equal chunkCount + 1');
    // Migration formula proof: legacy API page K (K >= 2) === chunk[K - 2].
    for (const K of [2, 6, 7, 100, pages.length]) {
        assert.strictEqual(pages[K - 1], bookChunks[K - 2].text,
            `legacy page ${K} !== chunk[${K - 2}]`);
    }
    console.log(`  PASS  legacy parity (totalPages=${pages.length}, chunkCount=${bookChunks.length}; page K == chunk[K-2] proven for K=2,6,7,100,${pages.length})`);
    passed++;
} catch (e) {
    console.error(`  FAIL  legacy parity: ${e.message}`);
    failed++;
}

// ── Boundary markers for the known screenshot regression (offsets only) ────
try {
    const c6 = bookChunks[4]; // legacy visual page 6
    const c7 = bookChunks[5]; // legacy visual page 7
    assert.strictEqual(c6.endOffset, c7.startOffset, 'chunk 6/7 must be contiguous');
    console.log(`  PASS  screenshot boundary: chunk6=[${c6.startOffset},${c6.endOffset}) chunk7=[${c7.startOffset},${c7.endOffset}) contiguous`);
    passed++;
} catch (e) {
    console.error(`  FAIL  screenshot boundary: ${e.message}`);
    failed++;
}

console.log(`\n== RESULT: ${passed} passed, ${failed} failed ==`);
process.exit(failed === 0 ? 0 : 1);
