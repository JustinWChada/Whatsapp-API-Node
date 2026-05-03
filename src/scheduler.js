const cron = require('node-cron');
const { getLatePeople } = require('./logic');
const { REMINDER_MESSAGE_TEMPLATE } = require('./config');
const { appendLog } = require('./storage');
const { loadJidMappings, updateJidMapping, extractPhoneFromJid } = require('./jidResolver');
const { updateMenteeName, updateMenteePhone } = require('./logic');

let isConnected = false;
let pendingReminderJob = false;
let currentClient = null;


function setConnected(status) {
  const wasDisconnected = !isConnected && status;
  isConnected = status;
  if (wasDisconnected && pendingReminderJob) {
    console.log('[SCHEDULER] Socket reconnected — running missed reminder job now...');
    pendingReminderJob = false;
    setTimeout(() => runReminderJob(currentClient), 10000);
  }
}

async function runReminderJob(client) {
  if (!client) return;
  if (!isConnected) {
    console.log('[SCHEDULER] Socket not connected — queuing reminder job...');
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
      // --- Resolve best name ---
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

      // --- Resolve JID to send to ---
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

      // --- Send the message ---
      // Baileys returns the sent message object — this contains the ACTUAL
      // remoteJid that WhatsApp used to deliver the message.
      // If Baileys internally resolved @lid to @s.whatsapp.net, we capture that
      // and save it back so we have the real phone number going forward.
      const sentMsg = await client.sendMessage(targetJid, { text });
      
      // Extract the actual JID Baileys used for delivery
      const actualJid = sentMsg?.key?.remoteJid || targetJid;
      
      if (actualJid && actualJid !== targetJid) {
        // Baileys used a different JID (e.g. resolved @lid -> @s.whatsapp.net)
        const actualPhone = extractPhoneFromJid(actualJid);
        const actualType = actualJid.includes('@lid') ? 'lid' : 'personal';
        console.log('[SCHEDULER] Actual JID from sent message: ' + actualJid + ' (was ' + targetJid + ')');
        
        // Save the resolved JID and real phone number to jidMappings.json
        updateJidMapping(actualJid, actualPhone, bestName, actualType);
        
        // Also update mentees.json with the real phone number
        if (actualJid.includes('@s.whatsapp.net')) {
          updateMenteeName(mentee.whatsapp_id, bestName);
          updateMenteePhone(mentee.whatsapp_id, actualPhone);
        }
      } else {
        // Same JID was used — still update lastUpdated so we know it was verified
        const existingType = targetJid.includes('@lid') ? 'lid' : 'personal';
        updateJidMapping(targetJid, mentee.whatsapp_id, bestName, existingType);
        console.log('[SCHEDULER] JID verified via successful send: ' + targetJid);
      }

      const ts = new Date().toISOString();
      appendLog({
        whatsapp_id: mentee.whatsapp_id,
        message: 'Sent late reminder to ' + bestName + ' via ' + actualJid,
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

  // IST is UTC+5:30, so 10:00 AM IST = 04:30 AM UTC: Original: 
  cron.schedule('0 10 * * *', () => {
    runReminderJob(client);
  }, { timezone: 'Asia/Kolkata' });
  // IST is UTC+5:30, so 10:00 AM IST = 04:30 AM UTC

  // // Testing: Run every 2 minutes
  // cron.schedule('*/2 * * * *', () => {
  //   runReminderJob(client);
  // });

  console.log('[SCHEDULER] Reminder job scheduled for 10:00 AM IST daily.');
}

module.exports = { setupReminderScheduler, setConnected}; // export runReminderJob