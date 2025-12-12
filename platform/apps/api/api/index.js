// Vercel Serverless Function Entry Point
// This file is executed by Vercel as a serverless function

const path = require('path');

// Try to load the compiled serverless handler
let handler;

try {
    // In Vercel, the dist folder should be at the project root after build
    handler = require('../dist/serverless.js').handler || require('../dist/serverless.js').default;
} catch (e) {
    console.error('Failed to load serverless handler:', e);
    // Fallback error handler
    handler = async (req, res) => {
        res.status(500).json({
            error: 'Failed to initialize the API server',
            details: e.message,
            cwd: process.cwd(),
            dirname: __dirname
        });
    };
}

module.exports = handler;
module.exports.default = handler;

