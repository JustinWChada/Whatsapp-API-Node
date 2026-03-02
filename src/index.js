const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { initializeBot, setupReminderScheduler } = require('./bot'); // Adjust if needed

async function main() {
  const client = new Client({
    authStrategy: new LocalAuth({ 
      clientId: "whatsapp-task-bot" 
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',  // Render/EC2 safe
        '--disable-gpu',
        '--disable-background-timer-throttling'
      ]
    },
    webVersionCache: { type: 'none' }  // Fixes webpack hangs
  });

  client.on('qr', (qr) => {
    console.log('📱 SCAN QR CODE NOW:');
    qrcode.generate(qr, { small: true });
  });

  client.on('ready', () => {
    console.log('✅ WhatsApp Client Ready!');
    setupReminderScheduler(client);
  });

  client.on('auth_failure', (msg) => {
    console.error('❌ Auth failed:', msg);
  });

  await client.initialize();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('🛑 Shutting down...');
    await client.destroy();
    process.exit(0);
  });
}

main().catch(console.error);
