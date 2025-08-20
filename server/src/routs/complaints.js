import { Router } from 'express';
import { db } from '../db.js';
import { nowISO } from '../utils.js';

const router = Router();

// create complaint
router.post('/', (req, res) => {
  const { post_id, author_cid, reason } = req.body || {};
  if (!author_cid || !reason) return res.status(400).json({ error: 'bad_request' });
  const created = nowISO();
  const stmt = `INSERT INTO complaints(post_id, author_cid, reason, created_at, status) VALUES(?,?,?,?, 'new')`;
  db.run(stmt, [post_id || null, author_cid, reason, created], function(err){
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json({ ok: true, id: this.lastID });
  });
});

// admin list/update
router.get('/', (req, res) => {
  const admin = (req.headers['x-admin-token'] === process.env.ADMIN_TOKEN || req.cookies.adm === process.env.ADMIN_TOKEN);
  if (!admin) return res.status(401).json({ error: 'unauthorized' });
  db.all(`SELECT * FROM complaints ORDER BY created_at DESC LIMIT 500`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json(rows);
  });
});

router.post('/:id/status', (req, res) => {
  const admin = (req.headers['x-admin-token'] === process.env.ADMIN_TOKEN || req.cookies.adm === process.env.ADMIN_TOKEN);
  if (!admin) return res.status(401).json({ error: 'unauthorized' });
  const id = Number(req.params.id);
  const { status, note } = req.body || {};
  db.run(`UPDATE complaints SET status=?, note=?, resolved_at = CASE WHEN ?='resolved' THEN datetime('now') ELSE resolved_at END WHERE id=?`,
    [status || 'new', note || null, status || 'new', id], (err) => {
      if (err) return res.status(500).json({ error: 'db_error' });
      res.json({ ok: true });
    });
});

export default router;
