const cron = require('node-cron');
const {getLatePeople} = require('./logic');
const {REMINDER_MESSAGE_TEMPLATE} = require('./config');
const {appendLog} = require('./storage');

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

        for (const mentee of late){
            const text = REMINDER_MESSAGE_TEMPLATE(mentee.name);

            try{
                //mentee.whatsapp_id should be like '263780736090'
                const jid = mentee.whatsapp_id + '@c.us';
                await client.sendMessage(jid, text);

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