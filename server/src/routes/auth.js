import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getAuthUrl, exchangeCode } from '../spotify.js';
import { getDb } from '../db.js';

const router = Router();

router.get('/login', (req, res) => {
  const state = uuid();
  req.session.oauthState = state;
  res.redirect(getAuthUrl(state));
});

router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  if (error || state !== req.session.oauthState) {
    return res.redirect(`${clientUrl}?error=auth_failed`);
  }

  try {
    const tokens = await exchangeCode(code);
    const { access_token, refresh_token, expires_in } = tokens;

    // Get user profile
    const { default: axios } = await import('axios');
    const profile = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const { id: spotify_id, display_name, images } = profile.data;

    const db = getDb();
    const avatar = images?.[0]?.url || null;
    const tokenExpires = Date.now() + expires_in * 1000;

    let user = db.prepare('SELECT * FROM users WHERE spotify_id = ?').get(spotify_id);

    if (user) {
      db.prepare(`UPDATE users SET display_name = ?, avatar = ?, access_token = ?, refresh_token = ?, token_expires = ? WHERE id = ?`)
        .run(display_name, avatar, access_token, refresh_token, tokenExpires, user.id);
    } else {
      user = { id: uuid(), spotify_id, display_name, avatar };
      db.prepare(`INSERT INTO users (id, spotify_id, display_name, avatar, access_token, refresh_token, token_expires) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(user.id, spotify_id, display_name, avatar, access_token, refresh_token, tokenExpires);
    }

    req.session.userId = user.id;
    req.session.oauthState = null;
    res.redirect(`${clientUrl}/home`);
  } catch (err) {
    console.error('Auth callback error:', err.message);
    res.redirect(`${clientUrl}?error=auth_failed`);
  }
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const db = getDb();
  const user = db.prepare('SELECT id, spotify_id, display_name, avatar FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json(user);
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

export default router;
