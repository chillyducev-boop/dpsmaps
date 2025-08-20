# DPS Map — dark/minimal map + Telegram bot (Node.js + SQLite)

> MVP that matches your spec. Tokens you provided are placed into `.env` for convenience.
> **Rotate them for production** and prefer secrets storage.

## Stack
- Backend: Node.js (Express), SQLite (WAL). Migrations auto-run on boot. Ready for PostgreSQL later.
- Frontend: HTML/CSS/JS + Leaflet.
- Bot: node-telegram-bot-api (polling). Registers users, opens WebApp, collects complaints, admin pings.
- PM2 & Nginx samples.

## Quick start (local)
```bash
# 1) API + frontend
cd server
npm i
npm run dev  # http://localhost:3000

# 2) Telegram bot
cd ../bot
npm i
npm start
```

## PM2 (optional)
```bash
cd server && pm2 start ecosystem.config.cjs
cd ../bot && pm2 start ecosystem.config.cjs
pm2 save
```

## Nginx
See `nginx/dpsmap.conf` and adjust domain.

## Admin
Send header `x-admin-token: DudkaAdm2025` or call `/api/admin/login` with `{token}` to set a short cookie.

## Notes
- Frontend stores `cid` in localStorage (set by bot deep-link or typed).
- Without registration you can only view; to add/vote/complain, register in the bot first.
- Visual aging: markers fade by time left.
- TTL rules and vote threshold (≥2 unique “Уехали”) are implemented (except permanent/system/custom).
- “Future flags” are present in UI (toggles), but some are placeholders.

Enjoy!
