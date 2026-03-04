const http = require('http');
const fs = require('fs');
const path = require('path');
const { initializeBot } = require('./bot');

const PORT = process.env.PORT || 3000;

// Paths to data files
const menteesPath = path.join(__dirname, '..', 'data', 'mentees.json');
const logsPath = path.join(__dirname, '..', 'data', 'chatbox_logs.json');
const jidMappingsPath = path.join(__dirname, '..', 'data', 'jidMappings.json');
const docsPath = path.join(__dirname, '..', 'bot-presentation.html');

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function sendHtml(res, html) {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}

// Simple HTML table renderer for mentees
function renderMenteesHtml(mentees) {
  const rows = Object.entries(mentees).map(([id, m]) => {
    const lastDone = m.last_done_at
      ? new Date(m.last_done_at).toLocaleString()
      : '<span style="color:red">Never</span>';
    return `<tr>
      <td>${id}</td>
      <td>${m.name}</td>
      <td>${m.whatsapp_id}</td>
      <td>${lastDone}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Mentees</title>
  <style>
    body { font-family: sans-serif; padding: 20px; background: #f9f9f9; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; background: white; }
    th { background: #4CAF50; color: white; padding: 10px; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
    tr:hover { background: #f1f1f1; }
    nav a { margin-right: 15px; text-decoration: none; color: #4CAF50; font-weight: bold; }
  </style>
</head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/mentees">Mentees</a>
    <a href="/logs">Logs</a>
    <a href="/mappings">JID Mappings</a>
    <a href= "/docs">Docs</a>
  </nav>
  <h1>Mentees</h1>
  <table>
    <thead><tr><th>ID</th><th>Name</th><th>WhatsApp ID</th><th>Last Done At</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

// Simple HTML table renderer for logs
function renderLogsHtml(logs) {
  const entries = Object.entries(logs).reverse(); // newest first
  const rows = entries.map(([id, l]) => {
    const color = l.type === 'LATE' ? '#fff3cd' : '#d4edda';
    return `<tr style="background:${color}">
      <td>${l.type}</td>
      <td>${l.whatsapp_id}</td>
      <td>${l.message}</td>
      <td>${new Date(l.timestamp).toLocaleString()}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <title>Logs</title>
  <style>
    body { font-family: sans-serif; padding: 20px; background: #f9f9f9; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; background: white; }
    th { background: #333; color: white; padding: 10px; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #ddd; font-size: 0.9em; }
    nav a { margin-right: 15px; text-decoration: none; color: #4CAF50; font-weight: bold; }
  </style>
</head>
<body>
  <nav>
    <a href="/">Home</a>
    <a href="/mentees">Mentees</a>
    <a href="/logs">Logs</a>
    <a href="/mappings">JID Mappings</a>
    <a href= "/docs">Docs</a>
  </nav>
  <h1>Chatbox Logs</h1>
  <table>
    <thead><tr><th>Type</th><th>WhatsApp ID</th><th>Message</th><th>Timestamp</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = req.url;

  // ----- Home -----
  if (url === '/') {
    return sendHtml(res, `<!DOCTYPE html>
<html>
<head>
  <title>Drill Bot</title>
  <style>
    body { font-family: sans-serif; padding: 40px; background: #f9f9f9; text-align: center; }
    h1 { color: #333; }
    a { display: inline-block; margin: 10px; padding: 12px 24px; background: #4CAF50;
        color: white; text-decoration: none; border-radius: 6px; font-size: 1.1em; }
    a:hover { background: #45a049; }
    p { color: #666; }
  </style>
</head>
<body>
  <h1>Mentorship Drill Bot Dashboard</h1>
  <p>Uptime: ${Math.floor(process.uptime())}s</p>
  <a href="/mentees">Mentees</a>
  <a href="/logs">Logs</a>
  <a href="/mappings">JID Mappings</a>
  <a href= "/docs">Docs</a>
</body>
</html>`);
  }

  // ----- Mentees -----
  if (url === '/mentees') {
    const data = readJsonFile(menteesPath);
    if (!data) return sendJson(res, { error: 'mentees.json not found' }, 404);
    return sendHtml(res, renderMenteesHtml(data));
  }

  // ----- Logs -----
  if (url === '/logs') {
    const data = readJsonFile(logsPath);
    if (!data) return sendJson(res, { error: 'chatbox_logs.json not found' }, 404);
    return sendHtml(res, renderLogsHtml(data));
  }

  // ----- JID Mappings (raw JSON) -----
  if (url === '/mappings') {
    const data = readJsonFile(jidMappingsPath);
    if (!data) return sendJson(res, { error: 'jidMappings.json not found' }, 404);
    return sendJson(res, data);
  }

   // ----- JID Mappings (raw JSON) -----
  if (url === '/docs') {
    const filePath = docsPath;
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) return sendJson(res, { error: 'Documentation (bot-presentation.html) not found' }, 404);
      return sendHtml(res, data);
    });
  }

  // ----- 404 -----
  sendJson(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
  console.log(`🌐 Dashboard running on port ${PORT}`);
  startSelfPing();
});

function startSelfPing() {
  const serviceUrl = process.env.RENDER_EXTERNAL_URL;
  if (!serviceUrl) {
    console.log('ℹ️  RENDER_EXTERNAL_URL not set — self-ping disabled (fine for local dev).');
    return;
  }
  setInterval(async () => {
    try {
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