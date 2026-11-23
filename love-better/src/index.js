const config = require('./config');
const db = require('./db');
const { createServer } = require('./server');
const { startBot, broadcast, announceAct, webhookHandler, WEBHOOK_PATH } = require('./bot');

(async () => {
  await db.init();
  const app = createServer({ broadcast, announceAct, webhookHandler: config.useWebhook && config.botToken ? webhookHandler : null, webhookPath: WEBHOOK_PATH });
  app.listen(config.port, () => console.log(`Love Better web app on port ${config.port} ${config.webAppUrl ? `(${config.webAppUrl})` : ''}`));
  startBot().catch(e => console.error('Could not start the bot. Is BOT_TOKEN right?', e.message));
})().catch(e => { console.error('Startup failed:', e.message); process.exit(1); });
