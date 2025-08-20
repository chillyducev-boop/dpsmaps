import { Router } from 'express';
import { db } from '../db.js';
import { addMinutes } from '../utils.js';

const router = Router();

function requireCid(req, res, next) {
  const cid = req.headers['x-cid'] || req.cookies.cid || req.query.cid || req.body.cid;
  if (!cid) return res.status(401).json({ error: 'need_registration', message: 'Сначала зарегистрируйтесь в боте' });
  req.cid = String(cid);
  next();
}

// POST /api/vote {post_id, value:+1|-1}
router.post('/', requireCid, (req, res) => {
  const { post_id, value } = req.body;
  if (!post_id || ![1,-1,+1,-1].includes(Number(value))) return res.status(400).json({ error: 'bad_request' });

  const now = new Date().toISOString();
  const stmt = `INSERT INTO votes(post_id, voter, value, created_at) VALUES(?,?,?,?)`;
  db.run(stmt, [post_id, req.cid, Number(value), now], function(err){
    if (err) {
      // duplicate vote ignored
    }
    // fetch post to apply rules
    db.get(`SELECT * FROM posts WHERE id=?`, [post_id], (e, post) => {
      if (!post) return res.json({ ok: true, applied: false });

      // if vote is +1 and <=10 min left and not extended_once -> extend 10m
      if (Number(value) === 1 && post.expires_at) {
        const secLeft = (new Date(post.expires_at).getTime() - Date.now())/1000;
        if (secLeft <= 600 && !post.extended_once) {
          const newExp = addMinutes(post.expires_at, 10);
          db.run(`UPDATE posts SET expires_at=?, extended_once=1 WHERE id=?`, [newExp, post_id]);
        }
      }

      // if negative votes >=2 and post is not permanent/system/custom -> delete
      db.get(`SELECT COUNT(*) AS c FROM votes WHERE post_id=? AND value=-1`, [post_id], (e2, r) => {
        const negatives = r?.c ?? 0;
        const isPermanent = !post.expires_at || post.is_system || post.is_custom || post.type==='camera';
        if (!isPermanent && negatives >= 2) {
          db.run(`DELETE FROM posts WHERE id=?`, [post_id], err3 => {
            return res.json({ ok: true, removed: true });
          });
        } else {
          res.json({ ok: true });
        }
      });
    });
  });
});

export default router;
