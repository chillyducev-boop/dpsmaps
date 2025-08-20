import { Router } from 'express';
import { db } from '../db.js';
import { adminOnly, adminLogin } from '../auth.js';

const router = Router();

router.post('/login', adminLogin);

// posts table & actions
router.get('/posts', adminOnly, (req, res) => {
  db.all(`SELECT p.*,
    (SELECT COUNT(*) FROM votes v WHERE v.post_id=p.id AND v.value=+1) AS votes_yes,
    (SELECT COUNT(*) FROM votes v WHERE v.post_id=p.id AND v.value=-1) AS votes_no
    FROM posts p ORDER BY created_at DESC LIMIT 1000`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json(rows);
  });
});

router.post('/posts/:id/extend', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const add = Number(req.body?.minutes || 30);
  db.run(`UPDATE posts SET expires_at = datetime(COALESCE(expires_at, datetime('now')), '+' || ? || ' minutes') WHERE id=?`, [add, id], err=>{
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json({ ok: true });
  });
});

router.post('/posts', adminOnly, (req, res) => {
  // create custom/system post
  const { lat,lng,type='custom',name,description,ttl_minutes,icon,city_code,is_system=0 } = req.body || {};
  const created_at = new Date().toISOString();
  const expires_at = ttl_minutes ? new Date(Date.now()+ttl_minutes*60*1000).toISOString() : null;
  db.run(`INSERT INTO posts(lat,lng,type,name,description,created_at,expires_at,ttl_minutes,is_system,is_custom,icon,city_code)
          VALUES(?,?,?,?,?,?,?,?,1,1,?,?)`,
          [lat,lng,type,name,description,created_at,expires_at,ttl_minutes||null,is_system?1:0,icon||null,city_code||null], function(err){
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json({ ok: true, id: this.lastID });
  });
});

router.delete('/posts/:id', adminOnly, (req, res) => {
  db.run(`DELETE FROM posts WHERE id=?`, [req.params.id], err=>{
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json({ ok: true });
  });
});

router.get('/stats', adminOnly, (req, res) => {
  db.get(`SELECT
    (SELECT COUNT(*) FROM users) as users,
    (SELECT COUNT(*) FROM posts) as posts,
    (SELECT COUNT(*) FROM votes) as votes,
    (SELECT COUNT(*) FROM complaints) as complaints
  `, [], (err, row) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json(row);
  });
});

export default router;
