const {Client, LocalAuth} = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const {GROUP_NAME, DONE_KEYWORDS} = require('./config');
const {recordDone} = require('./logic');

const client = new Client({
    authStrategy: new LocalAuth({dataPath: './session'}),
});  

async function handleMessage(msg){
    try{
        console.log(`[BOT] Message received: "${msg.body}" | isGroup: ${msg.isGroup}`);
        
        const chat = await msg.getChat();
        console.log(`[BOT] Chat type - isGroup: ${chat.isGroup}, name: "${chat.name}"`);
        
        // Check if it's a group chat
        if(!chat.isGroup) {
            console.log(`[BOT] Skipped: Not a group message`);
            return;
        }

        const groupName = chat.name;
        console.log(`[BOT] Group name: "${groupName}" (looking for: "${GROUP_NAME}")`);
        
        if(groupName !== GROUP_NAME) {
            console.log(`[BOT] Skipped: Wrong group`);
            return;
        }

        const body = (msg.body || '').toLowerCase();
        const containsDone = DONE_KEYWORDS.some((kw) => body.includes(kw));
        console.log(`[BOT] Keywords check: "${body}" contains keywords? ${containsDone}`);
        
        if (!containsDone) {
            console.log(`[BOT] Skipped: No keywords found`);
            return;
        }

        //in a group, msg.author is sender JID, msg.from us group JID
        const senderJid = msg.author || msg.from;
        const contact = await msg.getContact();
        const senderNumber = contact.number;

        const timestampIso = new Date().toISOString();
        console.log(`[BOT] ✅ RECORDING: "${body}" from ${senderNumber} in ${groupName} at ${timestampIso}`);

        recordDone(senderNumber, timestampIso);
    
    }catch (err){
        console.error(`[BOT] Error handling message: ${err.message}`, err);
    }
}

function setupClientEvents(){
    client.on('qr', (qr) => {
        console.log('Scan this QR code to log in:');
        qrcode.generate(qr, {small:true});
    });

    client.on('message', handleMessage);
}

function initializeBot(){
    setupClientEvents();
    client.initialize();
    return client;
}

module.exports = {
    initializeBot,
}