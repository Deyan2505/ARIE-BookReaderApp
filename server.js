const { app } = require('./netlify/functions/api');
const express = require('express');
const path = require('path');

const PORT = process.env.PORT || 3001;

// Serve static files from public
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for read routes
app.get('/read/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Run server locally
app.listen(PORT, () => {
    console.log(`=== ARIE SECURE BOOK READER (READ-ONLY) RUNNING ===`);
    console.log(`Local fallback active: loading books from /uploads/`);
    console.log(`Server started on http://localhost:${PORT}`);
});
