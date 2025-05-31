const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs'); // Import fs for additional checks if needed

const app = express();
const port = 3001; // A separate port for the asset server

// Enable CORS (Cross-Origin Resource Sharing).
app.use(cors());

// --- Security Middleware to explicitly block path traversal attempts ---
// This is an extra layer of caution. express.static already handles this
// for paths trying to go *outside* the defined static root.
app.use((req, res, next) => {
    // Decode the URL to catch encoded traversal attempts (e.g., %2E%2E%2F)
    const decodedPath = decodeURIComponent(req.path);
    if (decodedPath.includes('..')) {
        console.warn(`Blocked path traversal attempt: ${req.path}`);
        return res.status(403).send('Forbidden: Path traversal attempt detected.');
    }
    next();
});

// --- Serve static files from the 'cdn-assets' directory ---
// path.join is used to create an absolute path to your cdn-assets directory.
const staticAssetsPath = path.join(__dirname, 'cdn-assets');

// express.static will only serve files from within this 'staticAssetsPath'.
// It will automatically handle mapping URL paths to file system paths.
// For example, a request to '/images/myimage.jpg' will look for
// a file at path.join(staticAssetsPath, 'images', 'myimage.jpg').
// It prevents access to files outside of 'staticAssetsPath'.
app.use(express.static(staticAssetsPath, {
    // Optional: You can configure more options here if needed.
    // For example, to set cache control headers:
    // setHeaders: (res, filePath) => {
    //   if (path.extname(filePath) === '.css' || path.extname(filePath) === '.js') {
    //     res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    //   } else if (/\.(jpe?g|png|gif|svg|webp)$/i.test(filePath)) {
    //     res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    //   }
    // }
}));

// --- Optional: Add a catch-all for 404s if a file is not found by express.static ---
// This ensures that if express.static doesn't find a file, a proper 404 is sent.
// This is generally handled by express.static by default, but explicit is often better.
app.use((req, res) => {
    res.status(404).send('Asset not found.');
});

app.listen(port, () => {
    console.log(`CDN asset server running at http://localhost:${port}`);
    console.log(`Serving assets from: ${staticAssetsPath}`);
});
