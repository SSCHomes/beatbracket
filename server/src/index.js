import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import session from 'express-session';
import { initDb, getDb } from './db.js';
import { tallyRound, advanceRound, getBracketState } from './bracket.js';
import authRouter from './routes/auth.js';
import roomsRouter from './routes/rooms.js';
import searchRouter from './routes/search.js';

const app = express();
const httpServer = createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(httpServer, {
  cors: { origin: CLIENT_URL, credentials: true }
});

app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

app.set('io', io);

app.use('/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/search', searchRouter);
app.get('/api/health', (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Socket.io: join room channels for real-time updates
io.on('connection', socket => {
  socket.on('join:room', (roomId) => {
    socket.join(roomId);
  });
  socket.on('leave:room', (roomId) => {
    socket.leave(roomId);
  });
});

// Auto-advance rounds when timer expires
function checkRoundTimers() {
  try {
    const db = getDb();
    const expiredRooms = db.prepare(`
      SELECT id FROM rooms WHERE status = 'active' AND round_ends_at IS NOT NULL AND round_ends_at < ?
    `).all(Date.now());

    for (const { id } of expiredRooms) {
      try {
        tallyRound(id);
        const result = advanceRound(id);
        const state = getBracketState(id);

        if (result.complete) {
          io.to(id).emit('tournament:complete', { champion: state.songs.find(s => s.id === result.champion) });
        } else {
          io.to(id).emit('round:advanced', { ...result, state });
        }
        console.log(`Auto-advanced room ${id} (${result.complete ? 'complete' : `round ${result.round}`})`);
      } catch (err) {
        console.error(`Failed to auto-advance room ${id}:`, err.message);
      }
    }
  } catch (err) {
    // DB not ready yet
  }
}

setInterval(checkRoundTimers, 60 * 1000);

initDb();

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`BeatBracket server running on port ${PORT}`);
  console.log(`Client URL: ${CLIENT_URL}`);
});
