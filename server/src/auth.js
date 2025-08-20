import dotenv from 'dotenv';
dotenv.config();

export function adminOnly(req, res, next) {
  const token = req.headers['x-admin-token'] || req.cookies.adm;
  if (token && token === process.env.ADMIN_TOKEN) {
    return next();
  }
  return res.status(401).json({ error: 'unauthorized' });
}

export function adminLogin(req, res) {
  const token = req.body?.token;
  if (token === process.env.ADMIN_TOKEN) {
    res.cookie('adm', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 30
    });
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false });
}
