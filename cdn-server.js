const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3001; // A separate port for the asset server

// Enable CORS (Cross-Origin Resource Sharing).
// This is crucial as your main app (on port 3000) needs permission
// to fetch resources from this server (on port 3001).
app.use(cors());

// Serve static files from the 'cdn-assets' directory
app.use(express.static(path.join(__dirname, 'cdn-assets')));

app.listen(port, () => {
    console.log(`CDN asset server running at http://localhost:${port}`);
});