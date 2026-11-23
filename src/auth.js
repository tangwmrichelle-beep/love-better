const crypto = require('crypto');
const config = require('./config');

// Checks that the data sent by the Telegram mini app really came from Telegram.
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
function verifyInitData(initData) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const dataCheck = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(config.botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(dataCheck).digest('hex');
  const a = Buffer.from(calc, 'hex'), b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const authDate = Number(params.get('auth_date') || 0);
  if (Date.now() / 1000 - authDate > 7 * 24 * 3600) return null; // stale
  try { return JSON.parse(params.get('user')); } catch { return null; }
}

module.exports = { verifyInitData };
