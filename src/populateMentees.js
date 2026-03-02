const {Client, LocalAuth} = require('whatsapp-web.js');
const {GROUP_NAME} = require('./config');
const {saveMentees} = require('./storage');

/**
 * Utility script to populate mentees.json from a WhatsApp group
 * Run once: node src/populateMentees.js
 * 
 * This will:
 * 1. Connect to WhatsApp using existing session
 * 2. Find the group by name
 * 3. Extract all group members
 * 4. Save them to mentees.json with their names and WhatsApp IDs
 */

const client = new Client({
    authStrategy: new LocalAuth({dataPath: './session'}),
});

async function populateMenteesFromGroup() {
    try {
        console.log('[POPULATE] Starting mentees population from WhatsApp group...');
        console.log(`[POPULATE] Looking for group: "${GROUP_NAME}"`);

        // Get all chats
        const chats = await client.getChats();
        console.log(`[POPULATE] Total chats found: ${chats.length}`);

        // Find the target group
        let targetGroup = null;
        for (const chat of chats) {
            if (chat.isGroup && chat.name === GROUP_NAME) {
                targetGroup = chat;
                break;
            }
        }

        if (!targetGroup) {
            console.error(`[POPULATE] ❌ Group "${GROUP_NAME}" not found!`);
            console.log('[POPULATE] Available groups:');
            for (const chat of chats) {
                if (chat.isGroup) {
                    console.log(`  - "${chat.name}"`);
                }
            }
            return;
        }

        console.log(`[POPULATE] ✅ Found group: "${targetGroup.name}"`);

        // Get group participants
        const participants = targetGroup.participants;
        console.log(`[POPULATE] Group has ${participants.length} members`);

        // Build mentees object
        const mentees = {};
        let count = 1;

        for (const participant of participants) {
            // participant.id is the JID format like "263772345678@c.us"
            // Extract just the number part
            const whatsappId = participant.id.user;
            const name = participant.name || `Member ${count}`;

            mentees[`mentee_${count}`] = {
                name: name,
                whatsapp_id: whatsappId,
                last_done_at: null
            };

            console.log(`[POPULATE] ${count}. ${name} (${whatsappId})`);
            count++;
        }

        // Save to mentees.json
        saveMentees(mentees);
        console.log(`\n[POPULATE] ✅ Successfully saved ${Object.keys(mentees).length} mentees to mentees.json`);
        console.log('[POPULATE] You can now delete the session folder and restart the main bot if needed');

    } catch (err) {
        console.error(`[POPULATE] ❌ Error: ${err.message}`, err);
    } finally {
        await client.destroy();
        process.exit(0);
    }
}

// Setup client and run
client.on('ready', () => {
    console.log('[POPULATE] Client is ready!');
    populateMenteesFromGroup();
});

client.on('qr', (qr) => {
    console.log('[POPULATE] Scan this QR code to log in:');
    const qrcode = require('qrcode-terminal');
    qrcode.generate(qr, {small: true});
});

console.log('[POPULATE] Initializing WhatsApp client...');
client.initialize();
