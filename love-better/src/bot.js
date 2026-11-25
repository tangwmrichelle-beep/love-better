const { Bot, InlineKeyboard, GrammyError, webhookCallback } = require('grammy');
const crypto = require('crypto');
const config = require('./config');
const svc = require('./service');

const bot = new Bot(config.botToken || 'missing-token');
// Long posts are saved in full; chat messages only echo the start of them (Telegram messages max out at 4096 characters).
const preview = t => { t = String(t || ''); return t.length > 700 ? t.slice(0, 700).trimEnd() + '…' : t; };
const pendingLogs = new Map(); // userId -> { text, photoId } waiting for a "who did you love?" answer

const HEART = { stranger: '💛', friend: '🩵', family: '🩷', cg: '💜' };
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const openAppKeyboard = (label = '💖 Open Love Better') =>
  config.webAppUrl ? new InlineKeyboard().webApp(label, config.webAppUrl) : undefined;
const whoKeyboard = () => new InlineKeyboard()
  .text('💛 Someone new', 'who:stranger').row()
  .text('🩵 A friend', 'who:friend').row()
  .text('🩷 A family member', 'who:family').row()
  .text('💜 Someone in the CG', 'who:cg').row()
  .text('Cancel', 'who:cancel');

function countdownText() {
  return svc.countdown().map(e => {
    if (e.ms <= 0 && e.ms > -24 * 3600 * 1000) return `${e.emoji} <b>${esc(e.title)}</b> is TODAY!`;
    if (e.ms <= 0) return `${e.emoji} <b>${esc(e.title)}</b> has passed. Thank you for loving well!`;
    return `${e.emoji} <b>${esc(e.title)}</b> (${new Date(e.date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'Asia/Singapore' })}): <b>${Math.floor(e.ms / 864e5)}</b> days, ${Math.floor(e.ms / 36e5) % 24} hrs to go`;
  }).join('\n');
}

// Every update: make sure we know this person, and check the join code if one is set.
bot.use(async (ctx, next) => {
  if (!ctx.from || ctx.from.is_bot) return;
  if (ctx.chat && ctx.chat.type !== 'private') return next(); // group chats: just commands
  const user = await svc.upsertUser(ctx.from);
  ctx.state = { user };
  if (!user.approved) {
    const text = ctx.message?.text || '';
    const code = text.startsWith('/start') ? text.split(' ')[1] : text;
    if (code && await svc.tryJoinCode(user.id, code)) {
      ctx.state.user = await svc.getUser(user.id);
      await ctx.reply('🎉 You’re in! Welcome to the family.');
      return sendWelcome(ctx);
    }
    return ctx.reply('👋 Welcome! Please type the join code your CG leader gave you.');
  }
  return next();
});

async function sendWelcome(ctx) {
  const name = svc.nameOf(ctx.state.user);
  const v = svc.verseOfTheDay();
  await ctx.reply(
    `💖 <b>Welcome to ${esc(config.appName)}, ${esc(name)}!</b>\n\n` +
    `Small acts of love can change someone’s day. Let’s spur one another on to love better, together.\n\n` +
    `<i>“${esc(v.text)}”</i> — ${esc(v.ref)}\n\n` +
    `<b>Every act of love adds a heart to your jar</b>\n💛 Someone new\n🩵 A friend\n🩷 A family member\n💜 Someone in the CG\n\n` +
    `Tap the button below to open the app, or use:\n` +
    `/log <i>what you did</i> to log quickly (or send a photo with a caption)\n/hearts to see your heart jar\n/leaderboard to see everyone’s hearts\n/countdown for the XMAS service countdown`,
    { parse_mode: 'HTML', reply_markup: openAppKeyboard() });
}

bot.command('start', sendWelcome);
bot.command('help', sendWelcome);
bot.command('app', ctx => ctx.reply('Tap to open:', { reply_markup: openAppKeyboard() }));

bot.command('log', async ctx => {
  const text = (ctx.match || '').trim();
  if (!text) return ctx.reply('Tell me what you did after /log, for example:\n/log Bought kopi for the cleaner auntie ☕', { reply_markup: openAppKeyboard('Or log in the app') });
  pendingLogs.set(ctx.from.id, { text });
  await ctx.reply(`💖 “${esc(preview(text))}”\n\nWho did you love?`, { parse_mode: 'HTML', reply_markup: whoKeyboard() });
});

bot.callbackQuery(/^who:(\w+)$/, async ctx => {
  const who = ctx.match[1];
  const pending = pendingLogs.get(ctx.from.id);
  const text = pending && pending.text;
  pendingLogs.delete(ctx.from.id);
  if (who === 'cancel' || !text) {
    await ctx.answerCallbackQuery();
    return ctx.editMessageText(text ? 'Cancelled.' : 'That one expired, please /log it again.');
  }
  await ctx.answerCallbackQuery({ text: 'Saving…' }).catch(() => {});
  let photoBuffers = [];
  if (pending.photoId) { try { photoBuffers = [await downloadPhoto(pending.photoId)]; } catch (e) { console.error('Photo download failed:', e.message); } }
  const act = await svc.logAct(ctx.from.id, { description: text, recipient: who, photoBuffers });
  const stats = await svc.userStats(ctx.from.id);
  await ctx.editMessageText(`✅ Logged! ${HEART[act.recipient]} added to your jar${photoBuffers.length ? ' 📸' : ''}\n“${esc(preview(text))}”\n\nYour jar now has <b>${stats.totalStars} heart${stats.totalStars === 1 ? '' : 's'}</b>${stats.streak > 1 ? ` and a ${stats.streak}-day streak 🔥` : ''}. Keep loving!`, { parse_mode: 'HTML' });
  announceAct(ctx.from.id, act).catch(() => {});
});

bot.command(['hearts', 'stars'], async ctx => {
  const s = await svc.userStats(ctx.from.id);
  await ctx.reply(
    `🫙 <b>Your heart jar: ${s.totalStars} heart${s.totalStars === 1 ? '' : 's'}</b>\n` +
    `This week: ${s.weekStars}\nStreak: ${s.streak} day${s.streak === 1 ? '' : 's'} 🔥\n` +
    `Rank: #${s.rank || '-'} of ${s.members}\n\n💛 ${s.byType.stranger}  🩵 ${s.byType.friend}  🩷 ${s.byType.family}  💜 ${s.byType.cg}`,
    { parse_mode: 'HTML', reply_markup: openAppKeyboard('Open my heart jar') });
});

bot.command('leaderboard', async ctx => {
  const rows = (await svc.leaderboard('all')).slice(0, 10);
  const medals = ['🥇', '🥈', '🥉'];
  const lines = rows.map((r, i) => `${medals[i] || `${i + 1}.`} ${esc(r.name)}: <b>${r.stars} ♥</b>`);
  await ctx.reply(`🏆 <b>Leaderboard</b>\n\n${lines.join('\n') || 'No one yet. Be the first!'}`, { parse_mode: 'HTML', reply_markup: openAppKeyboard('Open full leaderboard') });
});

bot.command('countdown', ctx => ctx.reply(countdownText(), { parse_mode: 'HTML' }));

bot.command('verse', ctx => { const v = svc.verseOfTheDay(); return ctx.reply(`<i>“${esc(v.text)}”</i>\n— ${esc(v.ref)}`, { parse_mode: 'HTML' }); });

bot.command('mute', async ctx => { await svc.setNotify(ctx.from.id, false); return ctx.reply('🔕 You won’t get announcements. Send /unmute to turn them back on.'); });
bot.command('unmute', async ctx => { await svc.setNotify(ctx.from.id, true); return ctx.reply('🔔 Announcements are on.'); });

// ---- Admin ----
bot.command('myid', ctx => ctx.reply(`Your Telegram user id is <code>${ctx.from.id}</code>${ctx.chat.type !== 'private' ? `\nThis chat’s id is <code>${ctx.chat.id}</code>` : ''}`, { parse_mode: 'HTML' }));

bot.command('broadcast', async ctx => {
  if (!config.isAdmin(ctx.from.id)) return ctx.reply('Only admins can send announcements.');
  const msg = (ctx.match || '').trim();
  if (!msg) return ctx.reply('Write your message after /broadcast, for example:\n/broadcast Hi everyone! 3 weeks to XMAS service. Who will you invite this week? 💖');
  const res = await broadcast(ctx.from.id, msg);
  await ctx.reply(`📣 Sent to ${res.sent} people${res.failed ? ` (${res.failed} could not be reached)` : ''}.`);
});

bot.command('members', async ctx => {
  if (!config.isAdmin(ctx.from.id)) return;
  const rows = await svc.leaderboard('all');
  await ctx.reply(`👥 ${rows.length} members\n\n` + rows.map(r => `• ${esc(r.name)} (${r.stars} ♥)`).join('\n'), { parse_mode: 'HTML' });
});

// Plain text in private chat: offer to log it.
bot.on('message:text', async ctx => {
  if (ctx.chat.type !== 'private' || ctx.message.text.startsWith('/')) return;
  pendingLogs.set(ctx.from.id, { text: ctx.message.text.trim() });
  await ctx.reply(`Want to log this as an act of love? 💖\n“${esc(ctx.message.text.trim())}”\n\nWho did you love?`, { parse_mode: 'HTML', reply_markup: whoKeyboard() });
});

// A photo sent to the bot (with a caption saying what they did) is logged with the photo.
bot.on('message:photo', async ctx => {
  if (ctx.chat.type !== 'private') return;
  const caption = (ctx.message.caption || '').trim();
  if (!caption) return ctx.reply('📸 Lovely photo! Please send it again with a caption telling us what you did, e.g. “Cooked dinner for my grandma”.');
  const sizes = ctx.message.photo; // smallest to largest; pick the biggest one under ~1.2MB
  const best = [...sizes].reverse().find(s => !s.file_size || s.file_size < 1.2e6) || sizes[0];
  pendingLogs.set(ctx.from.id, { text: caption, photoId: best.file_id });
  await ctx.reply(`📸 “${esc(preview(caption))}”\n\nWho did you love?`, { parse_mode: 'HTML', reply_markup: whoKeyboard() });
});

async function downloadPhoto(fileId) {
  const f = await bot.api.getFile(fileId);
  const res = await fetch(`https://api.telegram.org/file/bot${config.botToken}/${f.file_path}`);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return { mime: 'image/jpeg', buf: Buffer.from(await res.arrayBuffer()) };
}

bot.catch(err => console.error('Bot error:', err.error || err));

async function broadcast(senderId, message) {
  const sender = await svc.getUser(senderId);
  const header = `📣 <b>Message from ${esc(sender ? svc.nameOf(sender) : 'your CG')}</b>\n\n`;
  let sent = 0, failed = 0;
  for (const u of await svc.recipients()) {
    try {
      await bot.api.sendMessage(u.id, header + esc(message), { parse_mode: 'HTML', reply_markup: openAppKeyboard() });
      sent++;
    } catch (e) {
      failed++;
      if (e instanceof GrammyError && e.error_code === 403) await svc.setNotify(u.id, false); // blocked the bot
    }
    await new Promise(r => setTimeout(r, 60)); // stay well under Telegram limits
  }
  await svc.logBroadcast(senderId, message, sent, failed);
  return { sent, failed };
}

// A 🔔 notification from the admin, also sent as a Telegram message. Telegram allows 4096 characters,
// so a very long one is cut there and the full text stays in the app.
async function broadcastNotice(senderId, title, body) {
  if (!config.botToken) return { sent: 0, failed: 0, skipped: true };
  let text = esc(body);
  if (text.length > 3600) text = esc(body.slice(0, 3000)) + '…\n\n<i>Read the full message in the app 🔔</i>';
  const msg = `🔔 <b>${esc(title.slice(0, 200))}</b>\n\n${text}`;
  let sent = 0, failed = 0;
  for (const u of await svc.recipients()) {
    try { await bot.api.sendMessage(u.id, msg, { parse_mode: 'HTML', reply_markup: openAppKeyboard() }); sent++; }
    catch (e) { failed++; if (e instanceof GrammyError && e.error_code === 403) await svc.setNotify(u.id, false); }
    await new Promise(r => setTimeout(r, 60));
  }
  await svc.logBroadcast(senderId, title + '\n\n' + body, sent, failed);
  return { sent, failed };
}

// Optional: post each act into the CG Telegram group too.
async function announceAct(userId, act) {
  if (!config.groupChatId || !act.is_public) return;
  const u = await svc.getUser(userId);
  await bot.api.sendMessage(config.groupChatId,
    `💖 <b>${esc(svc.nameOf(u))}</b> loved ${svc.RECIPIENT_LABEL[act.recipient]} ${HEART[act.recipient]}\n“${esc(preview(act.description))}”`, { parse_mode: 'HTML' });
}

// Tell someone when a CG member leaves a note of encouragement on their post.
async function notifyNote(ownerId, fromUser, body) {
  if (!config.botToken) return;
  const owner = await svc.getUser(ownerId);
  if (!owner || owner.notify === 0 || owner.notify === false) return;
  await bot.api.sendMessage(ownerId, `💌 <b>${esc(svc.nameOf(fromUser))}</b> left you a note of encouragement:\n“${esc(preview(body))}”`, { parse_mode: 'HTML' });
}

async function startBot() {
  if (!config.botToken) { console.warn('BOT_TOKEN not set: the Telegram bot is not running (mini app still served).'); return; }
  await bot.api.setMyCommands([
    { command: 'start', description: 'Welcome and open the app' },
    { command: 'log', description: 'Log an act of love: /log what you did' },
    { command: 'hearts', description: 'My heart jar and stats' },
    { command: 'leaderboard', description: 'Top 10' },
    { command: 'countdown', description: 'Days to XMAS service and New Year' },
    { command: 'verse', description: 'Verse of the day' },
    { command: 'mute', description: 'Stop announcements' },
  ]);
  if (config.webAppUrl) {
    await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Love Better', web_app: { url: config.webAppUrl } } });
  } else console.warn('WEBAPP_URL not set: the app button will not appear in Telegram.');
  if (config.useWebhook && config.webAppUrl) {
    // Free hosts sleep when idle; with a webhook, Telegram wakes the app up for each new message.
    await bot.init();
    await bot.api.setWebhook(`${config.webAppUrl}${WEBHOOK_PATH}`, { secret_token: WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'] });
    console.log(`Bot @${bot.botInfo.username} is running (webhook)`);
  } else {
    await bot.api.deleteWebhook();
    bot.start({ onStart: me => console.log(`Bot @${me.username} is running (polling)`) });
  }
}

// Secret path + header so only Telegram can call the webhook. Derived from the token, so it never needs setting.
const WEBHOOK_SECRET = crypto.createHash('sha256').update('lb-webhook:' + config.botToken).digest('hex').slice(0, 48);
const WEBHOOK_PATH = `/telegram/${WEBHOOK_SECRET.slice(0, 16)}`;
const webhookHandler = () => webhookCallback(bot, 'express', { secretToken: WEBHOOK_SECRET, onTimeout: 'return', timeoutMilliseconds: 9000 });

module.exports = { bot, startBot, broadcast, broadcastNotice, announceAct, notifyNote, webhookHandler, WEBHOOK_PATH };
