import { getDb } from './db.js';
import { v4 as uuid } from 'uuid';

// Standard bracket seeding: 1 vs n, 2 vs n-1, etc.
// Recursively builds position order so top seeds stay separated
function bracketSeedOrder(n) {
  if (n === 2) return [1, 2];
  const prev = bracketSeedOrder(n / 2);
  const result = [];
  for (const s of prev) {
    result.push(s, n + 1 - s);
  }
  return result;
}

// Generate round 1 matchups from seeded song list
export function generateBracket(roomId, songs) {
  const db = getDb();
  const n = songs.length;

  // Assign seeds by popularity (higher popularity = lower seed number = better seed)
  const sorted = [...songs].sort((a, b) => b.popularity - a.popularity);
  sorted.forEach((song, i) => {
    db.prepare('UPDATE songs SET seed = ? WHERE id = ?').run(i + 1, song.id);
    song.seed = i + 1;
  });

  const seedOrder = bracketSeedOrder(n);
  const matchupCount = n / 2;
  const matchups = [];

  for (let pos = 0; pos < matchupCount; pos++) {
    const song1 = sorted[seedOrder[pos * 2] - 1];
    const song2 = sorted[seedOrder[pos * 2 + 1] - 1];

    const matchup = {
      id: uuid(),
      room_id: roomId,
      round: 1,
      position: pos,
      song1_id: song1.id,
      song2_id: song2.id,
      winner_id: null
    };

    db.prepare(`
      INSERT INTO matchups (id, room_id, round, position, song1_id, song2_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(matchup.id, roomId, 1, pos, song1.id, song2.id);

    matchups.push(matchup);
  }

  return matchups;
}

// Tally votes and determine winners for the current round
export function tallyRound(roomId) {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) throw new Error('Room not found');

  const matchups = db.prepare(
    'SELECT * FROM matchups WHERE room_id = ? AND round = ? AND winner_id IS NULL'
  ).all(roomId, room.current_round);

  if (matchups.length === 0) return null;

  const winners = [];

  for (const matchup of matchups) {
    const votes = db.prepare('SELECT song_id, COUNT(*) as count FROM votes WHERE matchup_id = ? GROUP BY song_id')
      .all(matchup.id);

    const song1Votes = votes.find(v => v.song_id === matchup.song1_id)?.count || 0;
    const song2Votes = votes.find(v => v.song_id === matchup.song2_id)?.count || 0;

    // Tiebreaker: higher seed (lower seed number = better) wins
    let winnerId;
    if (song1Votes !== song2Votes) {
      winnerId = song1Votes > song2Votes ? matchup.song1_id : matchup.song2_id;
    } else {
      const song1 = db.prepare('SELECT seed FROM songs WHERE id = ?').get(matchup.song1_id);
      const song2 = db.prepare('SELECT seed FROM songs WHERE id = ?').get(matchup.song2_id);
      winnerId = (song1?.seed || 99) <= (song2?.seed || 99) ? matchup.song1_id : matchup.song2_id;
    }

    db.prepare('UPDATE matchups SET winner_id = ? WHERE id = ?').run(winnerId, matchup.id);
    winners.push({ matchupId: matchup.id, winnerId, position: matchup.position, song1Votes, song2Votes });
  }

  return winners;
}

// Advance to next round — create new matchups from winners
export function advanceRound(roomId) {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);

  const currentMatchups = db.prepare(
    'SELECT * FROM matchups WHERE room_id = ? AND round = ? ORDER BY position'
  ).all(roomId, room.current_round);

  const winners = currentMatchups.map(m => ({
    winnerId: m.winner_id,
    position: m.position
  })).filter(w => w.winnerId);

  if (winners.length !== currentMatchups.length) {
    throw new Error('Not all matchups have winners yet');
  }

  // If only 1 winner remains, tournament is over
  if (winners.length === 1) {
    db.prepare('UPDATE rooms SET status = ?, champion_id = ? WHERE id = ?')
      .run('complete', winners[0].winnerId, roomId);
    return { complete: true, champion: winners[0].winnerId };
  }

  const nextRound = room.current_round + 1;
  const roundDurationMs = room.round_duration * 60 * 60 * 1000;
  const roundEndsAt = Date.now() + roundDurationMs;

  // Pair winners by position: pos 0 winner vs pos 1 winner, pos 2 vs pos 3, etc.
  for (let i = 0; i < winners.length; i += 2) {
    db.prepare(`
      INSERT INTO matchups (id, room_id, round, position, song1_id, song2_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(uuid(), roomId, nextRound, i / 2, winners[i].winnerId, winners[i + 1].winnerId);
  }

  db.prepare('UPDATE rooms SET current_round = ?, status = ?, round_ends_at = ? WHERE id = ?')
    .run(nextRound, 'active', roundEndsAt, roomId);

  return { complete: false, round: nextRound, endsAt: roundEndsAt };
}

// Get full bracket state for a room
export function getBracketState(roomId) {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  if (!room) return null;

  const matchups = db.prepare('SELECT * FROM matchups WHERE room_id = ? ORDER BY round, position').all(roomId);
  const songs = db.prepare('SELECT * FROM songs WHERE room_id = ?').all(roomId);
  const members = db.prepare(`
    SELECT u.id, u.display_name, u.avatar FROM room_members rm
    JOIN users u ON u.id = rm.user_id WHERE rm.room_id = ?
  `).all(roomId);

  const songMap = Object.fromEntries(songs.map(s => [s.id, s]));

  const enrichedMatchups = matchups.map(m => ({
    ...m,
    song1: songMap[m.song1_id],
    song2: songMap[m.song2_id],
    winner: m.winner_id ? songMap[m.winner_id] : null
  }));

  const totalRounds = Math.log2(songs.length);

  return { room, matchups: enrichedMatchups, songs, members, totalRounds };
}

// Get vote counts for all matchups in current round
export function getRoundVotes(roomId) {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  const matchups = db.prepare(
    'SELECT * FROM matchups WHERE room_id = ? AND round = ?'
  ).all(roomId, room.current_round);

  const result = {};
  for (const m of matchups) {
    const votes = db.prepare('SELECT song_id, COUNT(*) as count FROM votes WHERE matchup_id = ? GROUP BY song_id')
      .all(m.id);
    result[m.id] = {
      [m.song1_id]: votes.find(v => v.song_id === m.song1_id)?.count || 0,
      [m.song2_id]: votes.find(v => v.song_id === m.song2_id)?.count || 0,
      total: votes.reduce((sum, v) => sum + v.count, 0)
    };
  }
  return result;
}
