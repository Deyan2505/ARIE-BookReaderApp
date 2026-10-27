const express = require('express');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const serverless = require('serverless-http');

const app = express();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Check if we should use local files fallback (e.g. during local testing without Supabase)
const useLocalFallback = !supabaseUrl || !supabaseKey;

const supabase = !useLocalFallback 
    ? createClient(supabaseUrl, supabaseKey)
    : null;

// Local uploads directory fallback path (relative to netlify/functions/ folder)
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

const catalogPath = path.join(__dirname, '..', '..', 'data', 'catalog.json');

function loadCatalog() {
    try {
        return JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    } catch(e) {
        return null;
    }
}

function findInCatalog(id) {
    const catalog = loadCatalog();
    if (!catalog) return null;
    return (catalog.books || []).find(b => b.id === id) || null;
}

// Encryption Configuration
const ENCRYPTION_SALT = "ARIE_GOLDEN_SECRET_SALT_2026";

// Helper to encrypt text using byte-level XOR and Base64
function encryptText(text, key) {
    const textBuffer = Buffer.from(text, 'utf8');
    const keyBuffer = Buffer.from(key, 'utf8');
    const encryptedBuffer = Buffer.alloc(textBuffer.length);
    
    for (let i = 0; i < textBuffer.length; i++) {
        encryptedBuffer[i] = textBuffer[i] ^ keyBuffer[i % keyBuffer.length];
    }
    
    return encryptedBuffer.toString('base64');
}

// Generate a unique key for each book
function getBookKey(filename) {
    return filename + "_" + ENCRYPTION_SALT;
}

// Read optional sidecar meta JSON for a book file
function readBookMeta(filePath) {
    const metaPath = filePath.replace(/\.txt$/, '.json');
    try {
        if (fs.existsSync(metaPath)) return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch(e) {}
    return null;
}

// Build a clean human-readable title from a stored filename
// e.g. "1_Paradoksat-na-bolkata.txt" -> "Paradoksat na bolkata"
function titleFromFilename(file) {
    const base = path.parse(file).name;        // drop .txt
    const noId = base.replace(/^\d+_/, '');     // drop leading "<uploadId>_"
    return noId.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// A real title must contain at least one letter — rejects "1", "____", "" etc.
function hasLetters(str) {
    return /\p{L}/u.test(str || '');
}

// ── Phase 0A: lossless logical chunking ─────────────────────────────────────
// Splits reader-ready text into contiguous chunks with exact character offsets.
// Invariant (enforced by tests/pagination-conservation.test.js):
//   chunks.map(c => c.text).join('') === originalText   (byte-exact, UTF-8)
// No normalization is performed: whitespace, blank lines, \n / \r\n line
// endings, punctuation and Unicode are preserved. A leading BOM, if present,
// is treated as content and preserved at offset 0.
const CHUNK_TARGET_LENGTH = 1200;
const CHUNK_BATCH_MAX = 64;

function isLowSurrogate(code) {
    return code >= 0xDC00 && code <= 0xDFFF;
}

// Pick a friendly split position near target (paragraph > sentence > space).
// Purely cosmetic for legacy /page rendering — every candidate keeps the text
// contiguous, so losslessness never depends on this choice.
function pickChunkSplit(text, target) {
    const winStart = target - 200;
    const searchWindow = text.substring(winStart, target + 200);
    const paraCrlf = searchWindow.indexOf('\r\n\r\n');
    if (paraCrlf !== -1) return winStart + paraCrlf + 4;
    const paraLf = searchWindow.indexOf('\n\n');
    if (paraLf !== -1) return winStart + paraLf + 2;
    const sentenceBreak = searchWindow.search(/\.[\s\r\n]/);
    if (sentenceBreak !== -1) return winStart + sentenceBreak + 2;
    const spaceBreak = searchWindow.lastIndexOf(' ');
    if (spaceBreak !== -1 && spaceBreak > 150) return winStart + spaceBreak + 1;
    return target;
}

function buildChunks(text) {
    const chunks = [];
    let currentPos = 0;
    while (currentPos < text.length) {
        let splitPos = (currentPos + CHUNK_TARGET_LENGTH >= text.length)
            ? text.length
            : pickChunkSplit(text, currentPos + CHUNK_TARGET_LENGTH);
        // Never split a UTF-16 surrogate pair.
        if (splitPos < text.length && isLowSurrogate(text.charCodeAt(splitPos))) {
            splitPos--;
        }
        // Guard: always make forward progress.
        if (splitPos <= currentPos) {
            splitPos = Math.min(text.length, currentPos + 1);
            if (splitPos < text.length && isLowSurrogate(text.charCodeAt(splitPos))) splitPos++;
        }
        chunks.push({
            index: chunks.length,
            startOffset: currentPos,
            endOffset: splitPos,
            text: text.substring(currentPos, splitPos)
        });
        currentPos = splitPos;
    }
    return chunks;
}

// Legacy page view: virtual cover + raw chunk texts (Phase 0A: former trim()
// and empty-filter removed — pages are now exact contiguous substrings).
// Manual ---/[PAGE] separator mode is kept as-is for compatibility, but is not
// offset-addressable; no current book uses it (documented limitation).
function paginateText(text) {
    const manualSeparator = /\r?\n---\r?\n|\r?\n\[PAGE\]\r?\n/;
    if (manualSeparator.test(text)) {
        const parts = text.split(/\r?\n---\r?\n|\r?\n\[PAGE\]\r?\n/g)
            .map(p => p.trim()).filter(p => p.length > 0);
        parts.unshift('##COVER##');
        return parts;
    }
    const pages = buildChunks(text).map(c => c.text);
    pages.unshift('##COVER##'); // cover is always page 1
    return pages;
}

app.use(express.json());

// API Routes (Read-Only)

// 1. Get list of all books
app.get('/api/books', async (req, res) => {
    try {
        if (useLocalFallback) {
            const catalog = loadCatalog();
            if (catalog) {
                const books = (catalog.books || [])
                    .filter(b => b.status === 'published')
                    .map(b => ({
                        id: b.id,
                        title: b.title,
                        subtitle: b.subtitle || '',
                        author: b.author || '',
                        cover: b.cover || null,
                        seriesId: b.seriesId || null,
                        seriesTitle: b.seriesTitle || null,
                        seriesOrder: b.seriesOrder || null,
                        category: b.category || null,
                        language: b.language || null,
                        bookVersion: b.bookVersion || 1,
                        publishedAt: b.publishedAt || null
                    }));
                return res.json(books);
            }
            // Catalog missing or malformed — fall back to filesystem scan
            if (!fs.existsSync(uploadsDir)) return res.json([]);
            const files = fs.readdirSync(uploadsDir)
                .filter(f => f.endsWith('.txt') && !f.startsWith('.'));
            const books = files.map(file => {
                const filePath = path.join(uploadsDir, file);
                const stats = fs.statSync(filePath);
                const meta = readBookMeta(filePath);
                const metaTitle = meta && meta.title ? String(meta.title).trim() : '';
                return {
                    id: file,
                    title: metaTitle || titleFromFilename(file),
                    author: meta && meta.author ? meta.author : '',
                    subtitle: meta && meta.subtitle ? meta.subtitle : '',
                    sizeBytes: stats.size,
                    uploadedAt: stats.mtime
                };
            })
            .filter(b => b.sizeBytes > 0 && hasLetters(b.title))
            .sort((a, b) => b.uploadedAt - a.uploadedAt);
            return res.json(books);
        }

        // Supabase Database Active
        const { data, error } = await supabase
            .from('books')
            .select('id, title, size_bytes, uploaded_at')
            .order('uploaded_at', { ascending: false });
            
        if (error) throw error;
        
        const books = data.map(book => ({
            id: book.id,
            title: book.title,
            sizeBytes: book.size_bytes,
            uploadedAt: book.uploaded_at
        }));
        
        res.json(books);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Get a book content (encrypted & paginated)
app.get('/api/books/:id/read', async (req, res) => {
    try {
        const bookId = req.params.id;
        let content = '';
        let title = '';

        if (useLocalFallback) {
            const entry = findInCatalog(bookId);
            // Legacy no-catalog fallback: path.basename strips any directory
            // components from the id (directory traversal hardening, Phase 0A).
            const filePath = entry
                ? path.join(__dirname, '..', '..', entry.textFile)
                : path.join(uploadsDir, path.basename(bookId));
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Книгата не е намерена локално!' });
            }
            content = fs.readFileSync(filePath, 'utf8');
            const meta = entry ? null : readBookMeta(filePath);
            title = entry ? entry.title : (meta ? meta.title : bookId.split('_').slice(1).join('_').replace(/\.[^/.]+$/, "").replace(/_/g, ' '));
            var subtitle = entry ? (entry.subtitle || '') : (meta ? (meta.subtitle || '') : '');
            var bookVersion = entry ? (entry.bookVersion || 1) : 1;
        } else {
            // Supabase Active
            const { data, error } = await supabase
                .from('books')
                .select('content, title')
                .eq('id', bookId)
                .single();
                
            if (error || !data) {
                return res.status(404).json({ error: 'Книгата не е намерена в базата данни!' });
            }
            content = data.content;
            title = data.title;
        }
        
        const pages = paginateText(content);
        const chunks = buildChunks(content);
        const bookKey = getBookKey(bookId);

        res.json({
            id: bookId,
            title: title,
            subtitle: subtitle || '',
            bookVersion: bookVersion || 1,     // bump in catalog.json when the text is replaced
            totalPages: pages.length,          // legacy: cover + logical chunks
            totalChars: content.length,        // Phase 0A: exact reader-ready length
            chunkCount: chunks.length,         // Phase 0A: logical chunk count (no cover)
            // Compact ranges: element i is chunk i's endOffset;
            // startOffset(i) = i === 0 ? 0 : chunkRanges[i - 1]. Enables exact
            // v1 progress migration (legacy page K maps to chunk K - 2).
            chunkRanges: chunks.map(c => c.endOffset),
            meta: Buffer.from(bookKey).toString('base64')
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2b. Phase 0A: batch of encrypted logical chunks with exact offsets.
// bookId is resolved ONLY through the catalog (local mode) or the books table
// (Supabase mode) — never used as a filesystem path (no directory traversal).
app.get('/api/books/:id/chunks', async (req, res) => {
    try {
        const bookId = req.params.id;
        if (!/^\d+$/.test(req.query.from || '') || !/^\d+$/.test(req.query.to || '')) {
            return res.status(400).json({ error: 'Параметрите from и to трябва да са цели числа!' });
        }
        const from = parseInt(req.query.from, 10);
        const to = parseInt(req.query.to, 10);
        if (to < from) {
            return res.status(400).json({ error: 'Невалиден диапазон: to е преди from!' });
        }
        if (to - from + 1 > CHUNK_BATCH_MAX) {
            return res.status(400).json({ error: 'Максимален размер на batch заявка: ' + CHUNK_BATCH_MAX + ' chunks!' });
        }

        let content = '';
        if (useLocalFallback) {
            const entry = findInCatalog(bookId);
            if (!entry) {
                return res.status(404).json({ error: 'Книгата не е намерена локално!' });
            }
            const filePath = path.join(__dirname, '..', '..', entry.textFile);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Книгата не е намерена локално!' });
            }
            content = fs.readFileSync(filePath, 'utf8');
        } else {
            const { data, error } = await supabase
                .from('books')
                .select('content')
                .eq('id', bookId)
                .single();
            if (error || !data) {
                return res.status(404).json({ error: 'Книгата не е намерена в базата данни!' });
            }
            content = data.content;
        }

        const chunks = buildChunks(content);
        if (from >= chunks.length || to >= chunks.length) {
            return res.status(400).json({ error: 'Извън границите: книгата има ' + chunks.length + ' chunks!' });
        }

        const bookKey = getBookKey(bookId);
        res.json({
            bookId: bookId,
            from: from,
            to: to,
            chunks: chunks.slice(from, to + 1).map(c => ({
                index: c.index,
                startOffset: c.startOffset,
                endOffset: c.endOffset,
                content: encryptText(c.text, bookKey)
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Stream a single encrypted page
app.get('/api/books/:id/page/:num', async (req, res) => {
    try {
        const bookId = req.params.id;
        const pageNum = parseInt(req.params.num, 10);
        let content = '';

        if (useLocalFallback) {
            const entry = findInCatalog(bookId);
            // Legacy no-catalog fallback with traversal hardening (Phase 0A).
            const filePath = entry
                ? path.join(__dirname, '..', '..', entry.textFile)
                : path.join(uploadsDir, path.basename(bookId));
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Книгата не е намерена локално!' });
            }
            content = fs.readFileSync(filePath, 'utf8');
        } else {
            // Supabase Active
            const { data, error } = await supabase
                .from('books')
                .select('content')
                .eq('id', bookId)
                .single();
                
            if (error || !data) {
                return res.status(404).json({ error: 'Книгата не е намерена в базата данни!' });
            }
            content = data.content;
        }
        
        const pages = paginateText(content);
        
        if (pageNum < 1 || pageNum > pages.length) {
            return res.status(400).json({ error: 'Невалиден номер на страница!' });
        }
        
        const pageContent = pages[pageNum - 1];
        const bookKey = getBookKey(bookId);
        const encryptedPageContent = encryptText(pageContent, bookKey);
        
        res.json({
            pageNumber: pageNum,
            content: encryptedPageContent
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Netlify serverless handler wrapper
module.exports.app = app;
module.exports.handler = serverless(app);
// Phase 0A: exported for tests/pagination-conservation.test.js (no runtime effect)
module.exports.buildChunks = buildChunks;
module.exports.paginateText = paginateText;
