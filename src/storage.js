const fs = require('fs');
const path = require('path');

const menteesPath = path.join(__dirname, '..',  'data', 'mentees.json');
const logsPath = path.join(__dirname, '..', 'data', 'chatbox_logs.json');

function loadMentees(){
    if (!fs.existsSync(menteesPath)) {
        return {};
    }

    const raw = fs.readFileSync(menteesPath, 'utf8');

    if(!raw.trim()) return {};

    return JSON.parse(raw); // { mentee_id: {name, whatsapp_id, last_done_at}}

}

function saveMentees(mentees){
    fs.writeFileSync(menteesPath, JSON.stringify(mentees, null, 2));
}

function appendLog(entry){
    //entry {whatsapp_id, message, timestamp, type}

    let logs = {};

    if(fs.existsSync(logsPath)){
        const raw = fs.readFileSync(logsPath, 'utf8');
        if(raw.trim()) logs = JSON.parse(raw);
    }

    // Generate a unique ID for this log entry
    const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    logs[logId] = entry;
    
    fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2));
}

module.exports = {
    loadMentees,
    saveMentees,
    appendLog,
};