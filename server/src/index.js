import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cron from 'node-cron';
import { db, runMigrations } from './db.js';
import postsRouter from './routes/posts.js';
import votesRouter from './routes/votes.js';
import complaintsRouter from './routes/complaints.js';
import usersRouter from './routes/users.js';
import adminRouter from './routes/admin.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

runMigrations();

const origins = (process.env.ORIGIN || '').split(',').filter(Boolean);
app.use(cors({
  origin: function(origin, cb){
    if(!origin) return cb(null, true);
    if(origins.length === 0 || origins.indexOf(origin) !== -1) {
      return cb(null, true);
    }
    return cb(null, true); // relax for MVP
  },
  credentials: true
}));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// API
app.use('/api/posts', postsRouter);
app.use('/api/vote', votesRouter);
app.use('/api/complaint', complaintsRouter);
app.use('/api/users', usersRouter);
app.use('/api/admin', adminRouter);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Hourly cleanup for expired posts
cron.schedule('15 * * * *', () => {
  db.run("DELETE FROM posts WHERE expires_at IS NOT NULL AND expires_at <= datetime('now')");
  console.log('[CRON] Expired posts purged');
});

app.listen(PORT, () => {
  console.log(`DPS Map server running on :${PORT}`);
});
