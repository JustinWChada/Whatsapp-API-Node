const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

const { recordDone, updateMenteeName } = require('./logic');
const { setupReminderScheduler, setConnected } = require('./scheduler');
const { GROUP_NAME, DONE_KEYWORDS } = require('./config');
const {
  resolveJidToPhoneWithName,
  updateJidMapping,
  extractPhoneFromJid,
} = require('./jidResolver');

const groupNameCache = new Map();

/**
 * contactsCache — populated from the contacts.upsert event which Baileys fires
 * when your contact list syncs on connection. Maps JID -> saved contact name
 * (the name YOU saved in your phone for that number).
 */
const contactsCache = new Map();

async function initializeBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./session');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on('creds.update', saveCreds);

  // --- Contacts sync ---
  // Baileys fires contacts.upsert when your phone contact list syncs on startup
  // and whenever a contact's info updates.
  // contact.name   = name YOU saved in your phone contacts
  // contact.notify = the contact's own WhatsApp display name (push name)
  sock.ev.on('contacts.upsert', (contacts) => {
    for (const contact of contacts) {
      if (!contact.id) continue;
      const resolvedName = contact.name || contact.notify || null;
      if (resolvedName) {
        contactsCache.set(contact.id, resolvedName);
        console.log(`[CONTACTS] Cached name for ${contact.id}: "${resolvedName}"`);
      }
    }
  });

  // --- Connection lifecycle ---
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('SCAN QR CODE NOW:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('WhatsApp Client Ready!');
      setConnected(true);
      setupReminderScheduler(sock);
    }

    if (connection === 'close') {
      setConnected(false);
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      if (loggedOut) {
        console.log('Logged out. Delete ./session folder and restart to re-login.');
      } else {
        console.log('Connection closed. Reconnecting in 5s...');
        setTimeout(() => initializeBot(), 5000);
      }
    }
  });

  // --- Incoming message handler ---
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        const jid = msg.key.remoteJid;

        // Groups only
        if (!jid?.endsWith('@g.us')) continue;

        // Skip our own messages
        if (msg.key.fromMe) continue;

        // Extract message text
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

        // Check group name
        const groupName = await getGroupName(sock, jid);
        if (!groupName?.toLowerCase().includes(GROUP_NAME.toLowerCase())) continue;

        const senderJid = msg.key.participant || jid;

        // msg.pushName is the sender's own WhatsApp display name.
        // Available on every message - reliable real-time name source.
        const pushName = msg.pushName || null;

        // If sender not in jidMappings yet, create initial mapping now
        let jidInfo = resolveJidToPhoneWithName(senderJid, contactsCache, pushName);
        if (!jidInfo) {
          const plainId = extractPhoneFromJid(senderJid);
          const accountType = senderJid.includes('@lid') ? 'business' : 'personal';
          updateJidMapping(senderJid, plainId, pushName || `No Username - ${plainId}`, accountType);
          console.log(`[BOT] New JID mapping created for ${senderJid}`);
          jidInfo = resolveJidToPhoneWithName(senderJid, contactsCache, pushName);
        }

        const whatsappId = jidInfo?.phone || extractPhoneFromJid(senderJid);
        const displayName = jidInfo?.name || `No Username - ${whatsappId}`;
        const nameSource = jidInfo?.nameSource || 'unknown';

        console.log(
          `[DEBUG] Sender: ${senderJid} -> Phone: ${whatsappId} | Name: "${displayName}" (source: ${nameSource})`
        );

        // Sync real name back to mentees.json so late reminders use the real name
        const isRealName = displayName &&
          !displayName.startsWith('No Username') &&
          !displayName.startsWith('Member ');

        if (isRealName) {
          updateMenteeName(whatsappId, displayName);
        }

        const timestamp = new Date(
          (msg.messageTimestamp ?? Date.now() / 1000) * 1000
        ).toISOString();

        console.log(`Drill detected from "${displayName}" (${whatsappId}) at ${timestamp}`);
        await recordDone(whatsappId, timestamp);

      } catch (err) {
        console.error('Error processing message:', err.message);
      }
    }
  });

  process.on('SIGINT', async () => {
    console.log('Shutting down...');
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