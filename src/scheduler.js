const cron = require('node-cron');
const { getLatePeople } = require('./logic');
const { REMINDER_MESSAGE_TEMPLATE } = require('./config');
const { appendLog } = require('./storage');
const { loadJidMappings } = require('./jidResolver');

// Track whether the WhatsApp socket is currently connected.
// The scheduler checks this before attempting to send — if the socket
// is reconnecting at the time the cron fires, reminders are queued
// and retried once the connection is restored.
let isConnected = false;
let pendingReminderJob = false;

function setConnected(status) {
  const wasDisconnected = !isConnected && status;
  isConnected = status;

  // If we just reconnected and a reminder run was missed, run it now
  if (wasDisconnected && pendingReminderJob) {
    console.log('[SCHEDULER] Socket reconnected — running missed reminder job now...');
    pendingReminderJob = false;
    // Small delay to let the socket fully stabilise before sending
    setTimeout(() => runReminderJob(currentClient), 5000);
  }
}

let currentClient = null;

async function runReminderJob(client) {
  if (!client) return;

  if (!isConnected) {
    console.log('[SCHEDULER] Socket not connected — queuing reminder job for when it reconnects...');
    pendingReminderJob = true;
    return;
  }

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
      // Resolve best name: jidMappings first (has real names), fallback to mentees.json name
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

      // Resolve JID
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
}

function setupReminderScheduler(client) {
  currentClient = client;

  // IST is UTC+5:30, so 10:00 AM IST = 04:30 AM UTC
  cron.schedule('30 4 * * *', () => {
    runReminderJob(client);
  }, {
    timezone: 'UTC'
  });

  console.log('[SCHEDULER] Reminder job scheduled for 10:00 AM IST (04:30 UTC) daily.');
}

module.exports = { setupReminderScheduler, setConnected };