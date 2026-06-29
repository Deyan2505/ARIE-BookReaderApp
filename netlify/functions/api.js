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

// Helper to split text into pages
function paginateText(text) {
    const manualSeparator = /\r?\n---\r?\n|\r?\n\[PAGE\]\r?\n/g;
    if (manualSeparator.test(text)) {
        return text.split(manualSeparator).map(p => p.trim()).filter(p => p.length > 0);
    }

    let pages = [];
    const targetLength = 1200; 
    let currentPos = 0;
    
    while (currentPos < text.length) {
        if (currentPos + targetLength >= text.length) {
            pages.push(text.substring(currentPos).trim());
            break;
        }
        
        let splitPos = currentPos + targetLength;
        let searchWindow = text.substring(splitPos - 200, splitPos + 200);
        let paraBreak = searchWindow.indexOf('\n\n');
        
        if (paraBreak !== -1) {
            splitPos = (splitPos - 200) + paraBreak + 2;
        } else {
            let sentenceBreak = searchWindow.search(/\.[\s\r\n]/);
            if (sentenceBreak !== -1) {
                splitPos = (splitPos - 200) + sentenceBreak + 2;
            } else {
                let spaceBreak = searchWindow.lastIndexOf(' ');
                if (spaceBreak !== -1 && spaceBreak > 150) {
                    splitPos = (splitPos - 200) + spaceBreak + 1;
                }
            }
        }
        
        pages.push(text.substring(currentPos, splitPos).trim());
        currentPos = splitPos;
    }
    
    pages = pages.filter(p => p.length > 0);
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
            const filePath = entry
                ? path.join(__dirname, '..', '..', entry.textFile)
                : path.join(uploadsDir, bookId);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ error: 'Книгата не е намерена локално!' });
            }
            content = fs.readFileSync(filePath, 'utf8');
            const meta = entry ? null : readBookMeta(filePath);
            title = entry ? entry.title : (meta ? meta.title : bookId.split('_').slice(1).join('_').replace(/\.[^/.]+$/, "").replace(/_/g, ' '));
            var subtitle = entry ? (entry.subtitle || '') : (meta ? (meta.subtitle || '') : '');
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
        const bookKey = getBookKey(bookId);
        
        res.json({
            id: bookId,
            title: title,
            subtitle: subtitle || '',
            totalPages: pages.length,
            meta: Buffer.from(bookKey).toString('base64')
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
            const filePath = entry
                ? path.join(__dirname, '..', '..', entry.textFile)
                : path.join(uploadsDir, bookId);
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
