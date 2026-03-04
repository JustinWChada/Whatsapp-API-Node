const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

const { GROUP_NAME } = require('./config');
const { saveMentees } = require('./storage');
const { updateJidMapping, extractPhoneFromJid } = require('./jidResolver');

/**
 * Utility script to populate mentees.json AND jidMappings.json from a WhatsApp group.
 * Run once: node src/populateMentees.js
 *
 * This will:
 * 1. Connect to WhatsApp using the existing Baileys session
 * 2. Find the group by name
 * 3. Extract all group members
 * 4. Save them to mentees.json with their names and WhatsApp IDs
 * 5. Save their full JIDs to jidMappings.json so the scheduler can reach them
 *    even before they have ever sent a keyword message
 */

async function populateMenteesFromGroup(sock) {
  try {
    console.log('[POPULATE] Starting mentees population from WhatsApp group...');
    console.log(`[POPULATE] Looking for group: "${GROUP_NAME}"`);

    // Fetch all joined groups
    const groups = await sock.groupFetchAllParticipating();
    const groupList = Object.values(groups);
    console.log(`[POPULATE] Total groups found: ${groupList.length}`);

    // Find the target group by name
    const targetGroup = groupList.find(
      (g) => g.subject.toLowerCase() === GROUP_NAME.toLowerCase()
    );

    if (!targetGroup) {
      console.error(`[POPULATE] ❌ Group "${GROUP_NAME}" not found!`);
      console.log('[POPULATE] Available groups:');
      for (const g of groupList) {
        console.log(`  - "${g.subject}"`);
      }
      process.exit(1);
    }

    console.log(`[POPULATE] ✅ Found group: "${targetGroup.subject}"`);

    const participants = targetGroup.participants;
    console.log(`[POPULATE] Group has ${participants.length} members`);

    // Build mentees object and populate jidMappings at the same time
    const mentees = {};
    let count = 1;

    for (const participant of participants) {
      // participant.id is the full JID e.g. "263772345678@s.whatsapp.net" or "146922610385086@lid"
      const fullJid = participant.id;
      const whatsappId = extractPhoneFromJid(fullJid);
      const jidType = fullJid.includes('@lid') ? 'business' : 'personal';
      const name = `Member ${count} - ${whatsappId}`;

      // 1. Write to mentees.json
      const isBusiness = fullJid.includes('@lid') || whatsappId.length > 15;
      mentees[`mentee_${count}`] = {
        name,
        whatsapp_id: whatsappId,
        phone_number: isBusiness ? whatsappId : '+' + whatsappId,
        last_done_at: null,
      };

      // 2. Write to jidMappings.json immediately so the scheduler can always
      //    reach this person, even if they never send a keyword message.
      updateJidMapping(fullJid, whatsappId, name, jidType);

      console.log(`[POPULATE] ${count}. ${name} (${fullJid})`);
      count++;
    }

    saveMentees(mentees);
    console.log(
      `\n[POPULATE] ✅ Successfully saved ${Object.keys(mentees).length} mentees to mentees.json`
    );
    console.log('[POPULATE] ✅ JID mappings written to jidMappings.json for all members.');
    console.log('[POPULATE] Update the "name" fields in mentees.json to real names if needed.');
  } catch (err) {
    console.error(`[POPULATE] ❌ Error: ${err.message}`, err);
  } finally {
    process.exit(0);
  }
}

async function main() {
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

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('[POPULATE] Scan this QR code to log in:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('[POPULATE] ✅ WhatsApp connected!');
      await populateMenteesFromGroup(sock);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('[POPULATE] 🔒 Logged out. Delete ./session and re-run.');
        process.exit(1);
      } else {
        console.log(`[POPULATE] ⚠️  Connection closed (code ${statusCode}). Reconnecting...`);
        main();
      }
    }
  });
}

console.log('[POPULATE] Initializing WhatsApp client...');
main().catch(console.error);