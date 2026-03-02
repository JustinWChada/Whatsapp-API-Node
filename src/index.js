const {initializeBot} = require('./bot');
const {setupReminderScheduler} = require('./scheduler');

async function main(){
    const client = initializeBot();
    //wait a bit for client to be ready; for robust code 'listen to ready' is better
    setupReminderScheduler(client);
}

main();