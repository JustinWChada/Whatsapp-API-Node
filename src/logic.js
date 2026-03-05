const { loadMentees, saveMentees, appendLog } = require('./storage');
const { LATE_THRESHOLD_DAYS } = require('./config');

function recordDone(whatsappId, timestampIso) {
    const mentees = loadMentees();
    const len = Object.keys(mentees).length;

    let targetId = null;

    for (const [menteeId, mentee] of Object.entries(mentees)) {
        if (mentee.whatsapp_id === whatsappId) {
            targetId = menteeId;
            break;
        }
        if (mentee.whatsapp_id === `${whatsappId}@lid`) {
            targetId = menteeId;
            break;
        }
        const storedIdWithoutLid = mentee.whatsapp_id.replace(/@lid$/, '');
        if (storedIdWithoutLid === whatsappId) {
            targetId = menteeId;
            break;
        }
    }

    if (!targetId) {
        console.log(`[WARN] WhatsApp ID ${whatsappId} not found in mentees.json — adding as new mentee`);
        mentees[`mentee_${len + 1}`] = {
            name: `No Username - Mentee ${len + 1}`,
            whatsapp_id: whatsappId,
            last_done_at: null,
        };
        saveMentees(mentees);
        return;
    }

    mentees[targetId].last_done_at = timestampIso;
    saveMentees(mentees);

    appendLog({
        whatsapp_id: whatsappId,
        message: `${mentees[targetId].name} completed the drill on ${timestampIso}`,
        timestamp: timestampIso,
        type: 'DONE',
    });

    console.log(`[LOGIC] Recorded DONE for ${mentees[targetId].name} (${whatsappId})`);
}

/**
 * Update a mentee's display name in mentees.json when a real name is resolved.
 * Only updates if the current stored name is still a placeholder.
 *
 * @param {string} whatsappId - The plain phone/ID stored in mentees.json
 * @param {string} realName   - The resolved real name (saved contact or push name)
 */
function updateMenteeName(whatsappId, realName) {
    if (!realName || realName.startsWith('No Username') || realName.startsWith('Member ')) return;

    const mentees = loadMentees();
    let updated = false;

    for (const [menteeId, mentee] of Object.entries(mentees)) {
        const idMatch =
            mentee.whatsapp_id === whatsappId ||
            mentee.whatsapp_id === `${whatsappId}@lid` ||
            mentee.whatsapp_id.replace(/@lid$/, '') === whatsappId;

        if (idMatch) {
            const currentName = mentee.name || '';
            const isPlaceholder =
                currentName.startsWith('No Username') ||
                currentName.startsWith('Member ');

            if (isPlaceholder) {
                mentees[menteeId].name = realName;
                // phone_number is only meaningful for @s.whatsapp.net contacts.
                // @lid IDs are internal WhatsApp IDs — not real phone numbers.
                // The real phone_number gets populated via contacts.upsert in bot.js.
                // Here we only set it if the whatsappId looks like a real phone number
                // (i.e. it was resolved from an @s.whatsapp.net JID, typically 7-15 digits).
                const isRealPhone = /^\d{7,15}$/.test(whatsappId) && whatsappId.length <= 15;
                if (isRealPhone) {
                  mentees[menteeId].phone_number = '+' + whatsappId;
                }
                updated = true;
                console.log(`[LOGIC] Updated mentee name: "${currentName}" → "${realName}" | phone: ${mentees[menteeId].phone_number} (${whatsappId})`);
            }
            break;
        }
    }

    if (updated) saveMentees(mentees);
}

function getLatePeople(now = new Date(), thresholdDays = LATE_THRESHOLD_DAYS) {
    const mentees = loadMentees();
    const late = [];
    const nowMs = now.getTime();
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    for (const mentee of Object.values(mentees)) {
        if (!mentee.last_done_at || mentee.last_done_at === null) {
            late.push(mentee);
            continue;
        }
        const last = new Date(mentee.last_done_at).getTime();
        if (nowMs - last > thresholdMs) {
            late.push(mentee);
        }
    }

    return late;
}


/**
 * Update a mentee's real phone number in mentees.json.
 * Called by the scheduler when sendMessage returns an @s.whatsapp.net JID,
 * meaning we now know the actual dialable phone number for this mentee.
 *
 * @param {string} whatsappId  - The @lid plain ID stored in mentees.json
 * @param {string} realPhone   - The real phone number extracted from @s.whatsapp.net JID
 */
function updateMenteePhone(whatsappId, realPhone) {
    const mentees = loadMentees();
    let updated = false;

    for (const [menteeId, mentee] of Object.entries(mentees)) {
        const idMatch =
            mentee.whatsapp_id === whatsappId ||
            mentee.whatsapp_id.replace(/@lid$/, '') === whatsappId;

        if (idMatch) {
            if (!mentee.phone_number || mentee.phone_number === null) {
                mentees[menteeId].phone_number = '+' + realPhone;
                updated = true;
                console.log('[LOGIC] Updated real phone for ' + (mentee.name || whatsappId) + ': +' + realPhone);
            }
            break;
        }
    }

    if (updated) saveMentees(mentees);
}
module.exports = {
    recordDone,
    updateMenteeName,
    getLatePeople,
    updateMenteePhone,
};