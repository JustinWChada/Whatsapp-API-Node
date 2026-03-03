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
                updated = true;
                console.log(`[LOGIC] Updated mentee name: "${currentName}" → "${realName}" (${whatsappId})`);
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
        if (!mentee.last_done_at) {
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

module.exports = {
    recordDone,
    updateMenteeName,
    getLatePeople,
};