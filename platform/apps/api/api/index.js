// Vercel Serverless Function Entry Point
// This file serves as the entry point for Vercel's serverless deployment
// It imports and re-exports the compiled NestJS serverless handler

const { handler } = require('../dist/serverless.js');

module.exports = handler;
module.exports.default = handler;
