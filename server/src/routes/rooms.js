import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db.js';
import { generateBracket, tallyRound, advanceRound, getBracketState, getRoundVotes } from '../bracket.js';

const router = Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Create room
router.post('/', requireAuth, (req, res) => {
  const { name, genre, song_count, round_duration } = req.body;
  if (!name) return res.status(400).json({ error: 'Room name required' });

  const songCount = [8, 16, 32].includes(parseInt(song_count)) ? parseInt(song_count) : 16;
  const roundDuration = Math.max(1, Math.min(168, parseInt(round_duration) || 24));

  const db = getDb();
  const id = uuid();
  let code = generateCode();
  while (db.prepare('SELECT id FROM rooms WHERE code = ?').get(code)) {
    code = generateCode();
  }

  db.prepare(`
    INSERT INTO rooms (id, code, name, genre, song_count, round_duration, organizer_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, code, name, genre || null, songCount, roundDuration, req.session.userId);

  // Organizer auto-joins
  db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').run(id, req.session.userId);

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
  res.status(201).json(room);
});

// Join by code
router.post('/join', requireAuth, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });

  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(code.toUpperCase().trim());
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.status !== 'lobby') return res.status(400).json({ error: 'Tournament already started' });

  const existing = db.prepare('SELECT * FROM room_members WHERE room_id = ? AND user_id = ?')
    .get(room.id, req.session.userId);
  if (!existing) {
    db.prepare('INSERT INTO room_members (room_id, user_id) VALUES (?, ?)').run(room.id, req.session.userId);
  }

  res.json(room);
});

// Get room
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  res.json(room);
});

// Get room members
router.get('/:id/members', requireAuth, (req, res) => {
  const db = getDb();
  const members = db.prepare(`
    SELECT u.id, u.display_name, u.avatar FROM room_members rm
    JOIN users u ON u.id = rm.user_id WHERE rm.room_id = ?
  `).all(req.params.id);
  res.json(members);
});

// Get songs in room
router.get('/:id/songs', requireAuth, (req, res) => {
  const db = getDb();
  const songs = db.prepare('SELECT * FROM songs WHERE room_id = ? ORDER BY created_at').all(req.params.id);
  res.json(songs);
});

// Add song to room
router.post('/:id/songs', requireAuth, (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.status !== 'lobby') return res.status(400).json({ error: 'Cannot add songs after tournament starts' });

  const currentCount = db.prepare('SELECT COUNT(*) as count FROM songs WHERE room_id = ?').get(req.params.id);
  if (currentCount.count >= room.song_count) {
    return res.status(400).json({ error: `Bracket is full (${room.song_count} songs)` });
  }

  const { spotify_id, name, artist, album, album_art, preview_url, popularity } = req.body;
  if (!spotify_id || !name || !artist) return res.status(400).json({ error: 'Missing song data' });

  const existing = db.prepare('SELECT id FROM songs WHERE room_id = ? AND spotify_id = ?').get(req.params.id, spotify_id);
  if (existing) return res.status(400).json({ error: 'Song already in bracket' });

  const id = uuid();
  db.prepare(`
    INSERT INTO songs (id, room_id, spotify_id, name, artist, album, album_art, preview_url, popularity, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, spotify_id, name, artist, album || null, album_art || null, preview_url || null, popularity || 50, req.session.userId);

  const song = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);

  // Notify via socket
  const io = req.app.get('io');
  io.to(req.params.id).emit('song:added', song);

  res.status(201).json(song);
});

// Remove song
router.delete('/:id/songs/:songId', requireAuth, (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.status !== 'lobby') return res.status(400).json({ error: 'Cannot remove songs after start' });

  const song = db.prepare('SELECT * FROM songs WHERE id = ? AND room_id = ?').get(req.params.songId, req.params.id);
  if (!song) return res.status(404).json({ error: 'Song not found' });

  // Only organizer or the person who added it can remove
  if (room.organizer_id !== req.session.userId && song.added_by !== req.session.userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.songId);

  const io = req.app.get('io');
  io.to(req.params.id).emit('song:removed', req.params.songId);

  res.json({ ok: true });
});

// Start tournament (organizer only)
router.post('/:id/start', requireAuth, (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.organizer_id !== req.session.userId) return res.status(403).json({ error: 'Only organizer can start' });
  if (room.status !== 'lobby') return res.status(400).json({ error: 'Already started' });

  const songs = db.prepare('SELECT * FROM songs WHERE room_id = ?').all(req.params.id);
  if (songs.length !== room.song_count) {
    return res.status(400).json({ error: `Need exactly ${room.song_count} songs (have ${songs.length})` });
  }

  const roundEndsAt = Date.now() + room.round_duration * 60 * 60 * 1000;
  db.prepare('UPDATE rooms SET status = ?, current_round = 1, round_ends_at = ? WHERE id = ?')
    .run('active', roundEndsAt, room.id);

  const matchups = generateBracket(room.id, songs);
  const state = getBracketState(room.id);

  const io = req.app.get('io');
  io.to(req.params.id).emit('tournament:started', state);

  res.json(state);
});

// Get bracket state
router.get('/:id/bracket', requireAuth, (req, res) => {
  const state = getBracketState(req.params.id);
  if (!state) return res.status(404).json({ error: 'Room not found' });

  const votes = state.room.status === 'active' ? getRoundVotes(req.params.id) : {};
  const myVotes = {};

  if (req.session.userId && state.room.status === 'active') {
    const db = getDb();
    const userVotes = db.prepare(`
      SELECT v.matchup_id, v.song_id FROM votes v
      JOIN matchups m ON m.id = v.matchup_id
      WHERE m.room_id = ? AND m.round = ? AND v.user_id = ?
    `).all(req.params.id, state.room.current_round, req.session.userId);
    userVotes.forEach(v => { myVotes[v.matchup_id] = v.song_id; });
  }

  res.json({ ...state, votes, myVotes });
});

// Submit vote
router.post('/:id/vote', requireAuth, (req, res) => {
  const { matchup_id, song_id } = req.body;
  if (!matchup_id || !song_id) return res.status(400).json({ error: 'matchup_id and song_id required' });

  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room || room.status !== 'active') return res.status(400).json({ error: 'Voting not active' });

  const matchup = db.prepare('SELECT * FROM matchups WHERE id = ? AND room_id = ? AND round = ?')
    .get(matchup_id, req.params.id, room.current_round);
  if (!matchup) return res.status(404).json({ error: 'Matchup not found' });
  if (matchup.winner_id) return res.status(400).json({ error: 'This matchup is closed' });
  if (song_id !== matchup.song1_id && song_id !== matchup.song2_id) {
    return res.status(400).json({ error: 'Invalid song for this matchup' });
  }

  try {
    db.prepare('INSERT INTO votes (id, matchup_id, user_id, song_id) VALUES (?, ?, ?, ?)')
      .run(uuid(), matchup_id, req.session.userId, song_id);
  } catch {
    // Update existing vote
    db.prepare('UPDATE votes SET song_id = ? WHERE matchup_id = ? AND user_id = ?')
      .run(song_id, matchup_id, req.session.userId);
  }

  const votes = getRoundVotes(req.params.id);

  const io = req.app.get('io');
  io.to(req.params.id).emit('vote:cast', { matchup_id, votes });

  res.json({ ok: true, votes });
});

// Advance round (organizer only)
router.post('/:id/advance', requireAuth, (req, res) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.organizer_id !== req.session.userId) return res.status(403).json({ error: 'Only organizer can advance' });
  if (room.status !== 'active') return res.status(400).json({ error: 'Tournament not active' });

  try {
    const winners = tallyRound(req.params.id);
    const result = advanceRound(req.params.id);
    const state = getBracketState(req.params.id);

    const io = req.app.get('io');
    if (result.complete) {
      io.to(req.params.id).emit('tournament:complete', { champion: state.songs.find(s => s.id === result.champion) });
    } else {
      io.to(req.params.id).emit('round:advanced', { ...result, state });
    }

    res.json({ ...result, state });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
