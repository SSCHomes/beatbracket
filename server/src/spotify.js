import axios from 'axios';
import { getDb } from './db.js';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_ACCOUNTS = 'https://accounts.spotify.com';

export function getAuthUrl(state) {
  const scopes = ['user-read-private', 'user-read-email'].join(' ');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: scopes,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    state
  });
  return `${SPOTIFY_ACCOUNTS}/authorize?${params}`;
}

export async function exchangeCode(code) {
  const creds = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await axios.post(`${SPOTIFY_ACCOUNTS}/api/token`,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI
    }),
    { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  return res.data;
}

export async function refreshAccessToken(userId) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');

  const creds = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await axios.post(`${SPOTIFY_ACCOUNTS}/api/token`,
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: user.refresh_token }),
    { headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const expires = Date.now() + res.data.expires_in * 1000;
  db.prepare('UPDATE users SET access_token = ?, token_expires = ? WHERE id = ?')
    .run(res.data.access_token, expires, userId);

  return res.data.access_token;
}

export async function getAccessToken(userId) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) throw new Error('User not found');

  if (Date.now() < user.token_expires - 60000) {
    return user.access_token;
  }
  return refreshAccessToken(userId);
}

export async function spotifyGet(userId, path, params = {}) {
  const token = await getAccessToken(userId);
  const res = await axios.get(`${SPOTIFY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params
  });
  return res.data;
}

export async function searchTracks(userId, query, limit = 10) {
  const data = await spotifyGet(userId, '/search', { q: query, type: 'track', limit });
  return data.tracks.items.map(normalizeTrack);
}

export async function getGenreSeeds() {
  // These are Spotify's available genre seeds for recommendations
  return [
    'pop', 'hip-hop', 'rock', 'country', 'r-n-b', 'edm',
    'latin', 'alternative', 'indie', 'metal', 'classical',
    'jazz', 'blues', 'reggae', 'soul', 'punk', 'folk',
    'k-pop', 'disco', 'funk', 'gospel', 'opera'
  ];
}

export async function getRecommendations(userId, genre, limit = 32) {
  const data = await spotifyGet(userId, '/recommendations', {
    seed_genres: genre,
    limit,
    min_popularity: 40
  });
  return data.tracks.map(normalizeTrack);
}

export async function getTrack(userId, trackId) {
  const data = await spotifyGet(userId, `/tracks/${trackId}`);
  return normalizeTrack(data);
}

function normalizeTrack(track) {
  return {
    spotify_id: track.id,
    name: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    album: track.album?.name || '',
    album_art: track.album?.images?.[0]?.url || null,
    preview_url: track.preview_url || null,
    popularity: track.popularity || 50,
    spotify_url: track.external_urls?.spotify || null
  };
}
