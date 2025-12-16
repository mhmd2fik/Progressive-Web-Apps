const express = require('express');
const path = require('path');
const app = express();
const port = 8080;

// Serve all static files from the current directory
app.use(express.static(path.join(__dirname)));

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Open your browser to: http://localhost:${port}/index.html`);
    console.log(`-- You MUST use localhost for the Service Worker to function --`);
});
