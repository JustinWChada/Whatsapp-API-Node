const cron = require('node-cron');
const {getLatePeople} = require('./logic');
const {REMINDER_MESSAGE_TEMPLATE} = require('./config');
const {appendLog} = require('./storage');
const {loadJidMappings} = require('./jidResolver');

/**
 * set up a cron job that runs periodically e.g every day at 20:00),
 * it needs the Whatsapp Client instance to send messages
*/

function setupReminderScheduler(client) {
    // every day at 20:00 server time

    cron.schedule('0 20 * * *', async () => {
        console.log('[SCHEDULER] Running late reminder job...');
        const late = getLatePeople(new Date());

        if(!late.length){
            console.log('[SCHEDULER] Everyone is on time.');
            return;
        }

        const mappings = loadJidMappings().jidMappings;

        for (const mentee of late){
            const text = REMINDER_MESSAGE_TEMPLATE(mentee.name);

            try{
                // Reverse lookup: find JID for this phone number
                let targetJid = null;
                for (const [jid, mapping] of Object.entries(mappings)) {
                    if (mapping.phone === mentee.whatsapp_id) {
                        targetJid = jid;
                        break;
                    }
                }
                
                // Fallback: construct JID if not found in mappings
                if (!targetJid) {
                    // Determine if business or personal based on length
                    if (mentee.whatsapp_id.length > 15) {
                        targetJid = mentee.whatsapp_id + '@lid';
                    } else {
                        targetJid = mentee.whatsapp_id + '@s.whatsapp.net';
                    }
                    console.log(`[SCHEDULER] JID not in mappings, using fallback: ${targetJid}`);
                }

                console.log(`[SCHEDULER] Sending reminder to ${mentee.name} via ${targetJid}`);
                await client.sendMessage(targetJid, { text: text });

                const ts = new Date().toISOString();

                appendLog({
                    whatsapp_id: mentee.whatsapp_id,
                    message: `Sent late reminder to ${mentee.name}`,
                    timestamp: ts,
                    type: 'LATE',
                });

                console.log(`[SCHEDULER] Reminder sent to ${mentee.name} (${mentee.whatsapp_id})`);
            
            }catch (err){
                console.error(`[SCHEDULER] Failed to send reminder to ${mentee.name}`, err);
            }
        }
    });
}

module.exports = {
    setupReminderScheduler,
};