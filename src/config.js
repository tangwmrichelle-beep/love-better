// Central place for settings. Everything can be changed with environment variables.
const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RENDER_EXTERNAL_HOSTNAME;

const config = {
  botToken: process.env.BOT_TOKEN || '',
  // The https address where the mini app is served. Railway/Render fill this in automatically.
  webAppUrl: (process.env.WEBAPP_URL || (publicDomain ? `https://${publicDomain}` : '')).replace(/\/$/, ''),
  port: Number(process.env.PORT || 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  // Webhook mode is used whenever we know our public address (needed for free hosts that sleep).
  useWebhook: process.env.USE_WEBHOOK ? process.env.USE_WEBHOOK === '1' : !!(process.env.WEBAPP_URL || publicDomain),
  // Comma separated Telegram user ids who can broadcast and add missions.
  adminIds: (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean).map(Number),
  // Optional: if set, new people must type this code once before they can join.
  joinCode: (process.env.JOIN_CODE || '').trim(),
  // Optional: a Telegram group chat id where every logged act is also posted.
  groupChatId: process.env.GROUP_CHAT_ID ? Number(process.env.GROUP_CHAT_ID) : null,
  groupGoal: Number(process.env.GROUP_GOAL || 500),
  appName: process.env.APP_NAME || 'Love Better (AW2)',
  // Local testing only: lets the mini app run in a normal browser without Telegram.
  devMode: process.env.DEV_MODE === '1',
  events: [
    { key: 'day1', emoji: '🎄', title: 'XMAS Service Day 1', date: process.env.XMAS_DAY1 || '2026-12-24T00:00:00+08:00' },
    { key: 'day2', emoji: '⭐', title: 'XMAS Service Day 2', date: process.env.XMAS_DAY2 || '2026-12-25T00:00:00+08:00' },
    { key: 'newyear', emoji: '🎆', title: 'New Year 2027', date: process.env.NEW_YEAR || '2027-01-01T00:00:00+08:00' },
  ],
  stars: { stranger: 3, friend: 2, cg: 1 },
  tzOffsetMinutes: 8 * 60, // Singapore time
};

config.isAdmin = (id) => config.adminIds.includes(Number(id));

module.exports = config;
