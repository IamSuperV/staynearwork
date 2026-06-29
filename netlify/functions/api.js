const serverless = require('serverless-http');
const app = require('../../server'); // Path to server.js

// We export the handler for Netlify Functions
module.exports.handler = serverless(app);
