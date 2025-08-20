import { Router } from 'express';
import { db } from '../db.js';
const router = Router();

// GET /api/users/me?cid=...
router.get('/me', (req, res) => {
  const cid = String(req.query.cid || '');
  if (!cid) return res.json({ registered: false });
  db.get(`SELECT * FROM users WHERE cid=?`, [cid], (err, row) => {
    if (row) {
      res.json({ registered: true, user: row });
    } else {
      res.json({ registered: false });
    }
  });
});

// POST /api/users/lastpos
router.post('/lastpos', (req, res) => {
  const { cid, lat, lng } = req.body || {};
  if (!cid) return res.status(400).json({ ok: false });
  db.run(`UPDATE users SET last_lat=?, last_lng=?, last_seen=datetime('now') WHERE cid=?`, [lat, lng, cid], (err) => {
    res.json({ ok: true });
  });
});

// Admin: list users
router.get('/', (req, res) => {
  const admin = (req.headers['x-admin-token'] === process.env.ADMIN_TOKEN || req.cookies.adm === process.env.ADMIN_TOKEN);
  if (!admin) return res.status(401).json({ error: 'unauthorized' });
  db.all(`SELECT id,tg_id,username,first_name,last_name,last_lat,last_lng,last_seen,cid,city_code FROM users ORDER BY id DESC LIMIT 500`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json(rows);
  });
});

export default router;
