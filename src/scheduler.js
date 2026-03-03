const cron = require('node-cron');
const { getLatePeople } = require('./logic');
const { REMINDER_MESSAGE_TEMPLATE } = require('./config');
const { appendLog } = require('./storage');
const { loadJidMappings } = require('./jidResolver');

function setupReminderScheduler(client) {
  // FIX: was 50 16 (4:50 PM) — corrected to 10:00 AM every day
  cron.schedule('0 10 * * *', async () => {
    console.log('[SCHEDULER] Running late reminder job...');
    const late = getLatePeople(new Date());

    if (!late.length) {
      console.log('[SCHEDULER] Everyone is on time. No reminders needed.');
      return;
    }

    console.log('[SCHEDULER] ' + late.length + ' mentee(s) are late. Sending reminders...');
    const mappings = loadJidMappings().jidMappings;

    for (const mentee of late) {
      try {
        // Resolve best name: check jidMappings first (updated with real names on every
        // drill message), then fall back to whatever is stored in mentees.json
        let bestName = mentee.name;

        for (const [, mapping] of Object.entries(mappings)) {
          if (mapping.phone === mentee.whatsapp_id) {
            const mappedName = mapping.name || '';
            const isRealName = mappedName &&
              !mappedName.startsWith('No Username') &&
              !mappedName.startsWith('Member ');
            if (isRealName) bestName = mappedName;
            break;
          }
        }

        const text = REMINDER_MESSAGE_TEMPLATE(bestName);

        // Resolve the JID to send the DM to
        let targetJid = null;
        for (const [jid, mapping] of Object.entries(mappings)) {
          if (mapping.phone === mentee.whatsapp_id) {
            targetJid = jid;
            break;
          }
        }

        if (!targetJid) {
          targetJid = mentee.whatsapp_id.length > 15
            ? mentee.whatsapp_id + '@lid'
            : mentee.whatsapp_id + '@s.whatsapp.net';
          console.log('[SCHEDULER] JID not in mappings, using fallback: ' + targetJid);
        }

        console.log('[SCHEDULER] Sending reminder to "' + bestName + '" via ' + targetJid);
        await client.sendMessage(targetJid, { text });

        const ts = new Date().toISOString();
        appendLog({
          whatsapp_id: mentee.whatsapp_id,
          message: 'Sent late reminder to ' + bestName,
          timestamp: ts,
          type: 'LATE',
        });

        console.log('[SCHEDULER] Reminder sent to "' + bestName + '" (' + mentee.whatsapp_id + ')');
      } catch (err) {
        console.error('[SCHEDULER] Failed to send reminder to ' + mentee.name + ':', err.message);
      }
    }
  });

  console.log('[SCHEDULER] Reminder job scheduled for 10:00 AM daily.');
}

module.exports = { setupReminderScheduler };