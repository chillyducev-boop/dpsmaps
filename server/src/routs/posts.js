import { Router } from 'express';
import { db } from '../db.js';
import { nowISO, ttlForType } from '../utils.js';

const router = Router();

function requireCid(req, res, next) {
  const cid = req.headers['x-cid'] || req.cookies.cid || req.query.cid || req.body.cid;
  if (!cid) return res.status(401).json({ error: 'need_registration', message: 'Сначала зарегистрируйтесь в боте' });
  req.cid = String(cid);
  next();
}

// GET /api/posts?types=dps,dtp&city_code=MSC&bbox=n,s,e,w
router.get('/', (req, res) => {
  const { types, city_code, bbox } = req.query;
  const typeList = types ? String(types).split(',') : null;
  let where = "(expires_at IS NULL OR expires_at > datetime('now'))";
  const params = [];

  if (typeList) {
    where += ` AND type IN (${typeList.map(_=>'?').join(',')})`;
    params.push(...typeList);
  }
  if (city_code) {
    where += ' AND (city_code = ? OR city_code IS NULL)';
    params.push(city_code);
  }
  if (bbox) {
    const [n, s, e, w] = String(bbox).split(',').map(parseFloat);
    where += ' AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?';
    params.push(Math.min(n,s), Math.max(n,s), Math.min(e,w), Math.max(e,w));
  }

  const sql = `SELECT p.*,
    (SELECT COUNT(*) FROM votes v WHERE v.post_id=p.id AND v.value=+1) AS votes_yes,
    (SELECT COUNT(*) FROM votes v WHERE v.post_id=p.id AND v.value=-1) AS votes_no
    FROM posts p WHERE ${where} ORDER BY created_at DESC LIMIT 1000`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json(rows);
  });
});

// POST /api/posts (create)
router.post('/', requireCid, (req, res) => {
  const { lat, lng, type, name, description, city_code, direction, icon, is_custom, is_system } = req.body;
  if (lat == null || lng == null || !type) return res.status(400).json({ error: 'bad_request' });

  const ttl = is_custom ? (req.body.ttl_minutes ?? null) : ttlForType(type);
  const created = nowISO();
  const expires = (ttl === null || is_system) ? null : new Date(Date.now() + ttl*60*1000).toISOString();
  const stmt = `INSERT INTO posts(lat,lng,type,direction,name,description,created_at,expires_at,ttl_minutes,owner_cid,is_system,is_custom,icon,city_code)
                VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  const params = [lat,lng,type,direction||null,name||null,description||null,created,expires,ttl,req.cid,is_system?1:0,is_custom?1:0,icon||null,city_code||null];
  db.run(stmt, params, function(err){
    if (err) return res.status(500).json({ error: 'db_error' });
    db.get(`SELECT *,0 as votes_yes,0 as votes_no FROM posts WHERE id=?`, [this.lastID], (e,row)=>{
      if (e) return res.json({ id: this.lastID });
      res.json(row);
    });
  });
});

// DELETE /api/posts/:id (owner or admin)
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'bad_id' });
  const admin = (req.headers['x-admin-token'] === process.env.ADMIN_TOKEN);
  const cid = req.headers['x-cid'] || req.cookies.cid || req.query.cid || req.body?.cid;

  if (admin) {
    return db.run(`DELETE FROM posts WHERE id=?`, [id], err=>{
      if (err) return res.status(500).json({ error: 'db_error' });
      res.json({ ok: true });
    });
  }
  if (!cid) return res.status(401).json({ error: 'need_registration' });

  db.run(`DELETE FROM posts WHERE id=? AND owner_cid=?`, [id, String(cid)], err=>{
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json({ ok: true });
  });
});

export default router;
