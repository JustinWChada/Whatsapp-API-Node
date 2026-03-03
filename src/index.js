const { initializeBot } = require('./bot');

async function main() {
  console.log('🚀 Starting WhatsApp Mentorship Bot...');
  // initializeBot() returns the socket and internally sets up the scheduler
  await initializeBot();
}

main().catch(console.error);