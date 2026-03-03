const {loadMentees, saveMentees, appendLog} = require('./storage');
const { LATE_THRESHOLD_DAYS} = require('./config');

function recordDone(whatsappId, timestampIso){
    const mentees = loadMentees();
    const len = Object.keys(mentees).length;

    //find mentee by whatsapp id
    let targetId = null;

    for (const [menteeId, mentee] of Object.entries(mentees)) {
        // Exact match
        if (mentee.whatsapp_id === whatsappId){
            targetId = menteeId;
            break;
        }
        
        // Handle business accounts: try matching with @lid suffix
        if (mentee.whatsapp_id === `${whatsappId}@lid`){
            targetId = menteeId;
            break;
        }
        
        // Handle reverse: if stored ID has @lid, try matching without it
        const storedIdWithoutLid = mentee.whatsapp_id.replace(/@lid$/, '');
        if (storedIdWithoutLid === whatsappId){
            targetId = menteeId;
            break;
        }
    }

    if (!targetId){
        console.log(`[WARN] WhatsApp ID ${whatsappId} not found in mentees.json`);
        
        mentees[`mentee_${len + 1}`] = {name: `No Username - Mentee ${len + 1}`, whatsapp_id: whatsappId, last_done_at: null} 

        saveMentees(mentees)
        return;
    }

    mentees[targetId].last_done_at = timestampIso;
    saveMentees(mentees)

    appendLog({
        whatsapp_id: whatsappId,
        message: `${mentees[targetId].name} Completed the Task on ${timestampIso}`,
        timestamp: timestampIso,
        type: 'DONE'
    });

    console.log(`[LOGIC] Recorded DONE for ${mentees[targetId].name} (${whatsappId})`)

}

function getLatePeople(now = new Date(), thresholdDays = LATE_THRESHOLD_DAYS){
    const mentees = loadMentees();
    const late = [];
    const nowMs = now.getTime();
    const thresholdMs = thresholdDays * 24 * 60 * 60 * 1000;

    for (const mentee of Object.values(mentees)) {
        if(!mentee.last_done_at || mentee.last_done_at === null){
            //never done => late
            late.push(mentee);
            continue;
        }

        const last = new Date(mentee.last_done_at).getTime();
        if(nowMs - last > thresholdMs){
            late.push(mentee)
        }
    }

    return late
}

module.exports = {
    recordDone,
    getLatePeople,
};