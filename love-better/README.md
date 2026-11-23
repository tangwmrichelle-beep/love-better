# Love Better (AW2) 💖

A Telegram bot and mini app that helps a church group (CG) encourage each other to love others better in small, everyday ways.

> We love because he first loved us. (1 John 4:19)

## What it does

- **Log acts of love** in the app or straight in the chat (`/log Bought kopi for the cleaner auntie`, or just type what you did).
- **Stars:** someone you don't know +3⭐, a friend +2⭐, someone in CG +1⭐.
- **Missions** everyone can do (admin can add or remove), and **personal love goals** each person sets for themselves.
- **Together tab:** a shared feed with cheers, everyone's goals, and a weekly / all-time leaderboard.
- **Stats:** stars, acts, streaks, who you have loved, group totals, a group star goal, last 14 days.
- **Avatar maker:** boy or girl, skin, 11 hair styles, hair colour, eyes, mouth, 6 outfits and colours, 10 accessories, 5 poses, 8 backgrounds.
- **Countdown** to XMAS Service Day 1 (24 Dec) and Day 2 (25 Dec).
- **Admin announcements** to everyone, from the app (Me tab) or with `/broadcast your message`.
- Optional: a join code so only your CG can get in, and posting each act into your CG's Telegram group chat.

## Bot commands

| Command | What it does |
|---|---|
| `/start` | Welcome message and the button to open the app |
| `/log what you did` | Quick log, then pick who you loved |
| `/stars` | Your stars and stats |
| `/leaderboard` | Top 10 |
| `/countdown` | Days to the XMAS services |
| `/verse` | Verse of the day |
| `/mute`, `/unmute` | Turn announcements off or on |
| `/myid` | Shows your Telegram user id (and a group's id if used in a group) |
| `/broadcast message` | Admin only: send a message to everyone |
| `/members` | Admin only: list members and stars |

## Settings (environment variables)

| Name | Needed? | What it is |
|---|---|---|
| `BOT_TOKEN` | Yes | The token from @BotFather |
| `ADMIN_IDS` | Yes | Telegram user ids of admins, comma separated |
| `DATABASE_URL` | Yes | PostgreSQL address, for example from a free Neon database |
| `WEBAPP_URL` | Usually auto | Public https address of the app. Filled in automatically on Render |
| `JOIN_CODE` | Optional | If set, new people must type this code once to join |
| `GROUP_CHAT_ID` | Optional | Telegram group id; every shared act is also posted there (add the bot to the group, send `/myid` in it) |
| `GROUP_GOAL` | Optional | Group star goal shown on the home screen (default 500) |
| `XMAS_DAY1`, `XMAS_DAY2` | Optional | Countdown targets, default midnight 24 and 25 Dec 2026 Singapore time |

## Free hosting (Render + Neon)

1. **Neon** (neon.tech): create a free project, region Singapore. Copy the connection string (starts with `postgresql://`).
2. **GitHub**: put this folder in a repository.
3. **Render** (render.com): New → Blueprint → pick the repository. `render.yaml` sets everything up; fill in `BOT_TOKEN`, `DATABASE_URL` and `ADMIN_IDS`.
4. Optional, to stop the free plan from sleeping: at cron-job.org, call `https://<your-app>.onrender.com/health` every 10 minutes.

On Render the bot uses a webhook, so Telegram wakes the app when a message arrives. Locally (no public address) it uses polling.

## Running it yourself

Needs Node.js 20 or newer.

```bash
npm install
BOT_TOKEN=... ADMIN_IDS=... DATABASE_URL=postgresql://... npm start
```

To try the mini app in a normal browser without Telegram: `DATABASE_URL=... npm run dev`, then open `http://localhost:3000/?dev=1` (change the number to pretend to be different people). Never turn on `DEV_MODE` on the real server.

## How it is built

- `src/bot.js`: the Telegram bot (grammY, long polling, so no webhook setup is needed).
- `src/server.js`: Express server for the mini app and its API. Every request is checked against Telegram's signature.
- `src/service.js`: stars, stats, leaderboard, feed and missions logic.
- `src/db.js`: PostgreSQL database (tables are created automatically on first start).
- `public/`: the mini app (plain HTML, CSS and JS) and `avatar.js`, which draws the characters as SVG.
