const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

const { recordDone } = require('./logic');
const { setupReminderScheduler } = require('./scheduler');
const { GROUP_NAME, DONE_KEYWORDS } = require('./config');
const { resolveJidToPhone, resolveJidToPhoneWithName, updateJidMapping, extractPhoneFromJid } = require('./jidResolver');

// Cache group name lookups to avoid hammering WhatsApp with metadata requests
const groupNameCache = new Map();

async function initializeBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    // Silent logger — swap 'silent' to 'info' if you need to debug connection issues
    logger: pino({ level: 'silent' }),
    // These keep memory low:
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
  });

  // Persist session credentials whenever they update
  sock.ev.on('creds.update', saveCreds);

  // --- Connection lifecycle ---
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('📱 SCAN QR CODE NOW:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp Client Ready!');
      setupReminderScheduler(sock);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.log('🔒 Logged out. Delete ./session folder and restart to re-login.');
      } else {
        console.log(`⚠️  Connection closed (code ${statusCode}). Reconnecting in 5s...`);
        setTimeout(() => initializeBot(), 5000);
      }
    }
  });

  // --- Incoming message handler ---
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // 'notify' = new messages pushed to us in real time
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        const jid = msg.key.remoteJid;

        // Groups only
        if (!jid?.endsWith('@g.us')) continue;

        // Skip our own messages
        if (msg.key.fromMe) continue;

        // Extract message text (handles plain text and quoted/extended messages)
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          '';

        if (!text) continue;

        const lowerText = text.toLowerCase();
        const hasKeyword = DONE_KEYWORDS.some((k) =>
          lowerText.includes(k.toLowerCase())
        );
        if (!hasKeyword) continue;

        // Check group name (cached to avoid repeated API calls)
        const groupName = await getGroupName(sock, jid);
        if (!groupName?.toLowerCase().includes(GROUP_NAME.toLowerCase())) continue;

        // participant = sender's JID in a group message
        const senderJid = msg.key.participant || jid;
        
        // Resolve JID with enhanced name resolution (saved contact > mapped > fallback)
        let jidInfo = await resolveJidToPhoneWithName(sock, senderJid);
        
        if (!jidInfo) {
          // Unknown JID - extract plain ID and create initial mapping
          const plainId = extractPhoneFromJid(senderJid);
          const type = senderJid.includes('@lid') ? 'business' : 'personal';
          updateJidMapping(senderJid, plainId, `No Username - ${plainId}`, type);
          console.log(`[BOT] New JID mapping created for ${senderJid}`);
          
          // Re-resolve to get the mapping we just created
          jidInfo = await resolveJidToPhoneWithName(sock, senderJid);
        }
        
        const whatsappId = jidInfo?.phone || extractPhoneFromJid(senderJid);
        const displayName = jidInfo?.name || `No Username - ${whatsappId}`;
        const nameSource = jidInfo?.nameSource || 'unknown';
        
        console.log(`[DEBUG] Sender JID: ${senderJid} → Phone: ${whatsappId} | Name: "${displayName}" (source: ${nameSource})`);
        
        const timestamp = new Date((msg.messageTimestamp ?? Date.now() / 1000) * 1000).toISOString();

        console.log(`✅ Keyword detected from ${displayName} (${whatsappId}) at ${timestamp}`);
        await recordDone(whatsappId, timestamp);
      } catch (err) {
        console.error('❌ Error processing message:', err.message);
      }
    }
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down...');
    await sock.logout().catch(() => {});
    process.exit(0);
  });

  return sock;
}

async function getGroupName(sock, jid) {
  if (groupNameCache.has(jid)) return groupNameCache.get(jid);
  try {
    const meta = await sock.groupMetadata(jid);
    groupNameCache.set(jid, meta.subject);
    return meta.subject;
  } catch {
    return null;
  }
}

module.exports = { initializeBot };