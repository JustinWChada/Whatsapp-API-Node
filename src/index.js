const http = require('http');
const { initializeBot } = require('./bot');

const PORT = process.env.PORT || 3000;

// Tiny HTTP server — satisfies Render's port binding requirement
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
});

server.listen(PORT, () => {
  console.log(`🌐 Health-check server listening on port ${PORT}`);
  startSelfPing();
});

/**
 * Render free tier spins down services after ~15 minutes of inactivity.
 * Pinging ourselves every 10 minutes keeps the process alive 24/7.
 * 
 * Set the RENDER_EXTERNAL_URL env variable in your Render dashboard
 * (Render sets this automatically for Web Services).
 */
function startSelfPing() {
  const serviceUrl = process.env.RENDER_EXTERNAL_URL;

  if (!serviceUrl) {
    console.log('ℹ️  RENDER_EXTERNAL_URL not set — self-ping disabled (fine for local dev).');
    return;
  }

  setInterval(async () => {
    try {
      // Built-in fetch is available in Node 18+; use https module as fallback
      const fetch = globalThis.fetch ?? require('https').get;
      await fetch(`${serviceUrl}/`);
      console.log('[PING] Self-ping sent to keep service alive.');
    } catch (err) {
      console.warn('[PING] Self-ping failed:', err.message);
    }
  }, 10 * 60 * 1000); // every 10 minutes
}

async function main() {
  console.log('🚀 Starting WhatsApp Mentorship Bot...');
  await initializeBot();
}

main().catch(console.error);