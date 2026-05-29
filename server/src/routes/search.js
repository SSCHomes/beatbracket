import { Router } from 'express';
import { searchTracks, getRecommendations, getGenreSeeds } from '../spotify.js';

const router = Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}

router.get('/tracks', requireAuth, async (req, res) => {
  const { q, limit = 10 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });
  try {
    const tracks = await searchTracks(req.session.userId, q, parseInt(limit));
    res.json(tracks);
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

router.get('/recommendations', requireAuth, async (req, res) => {
  const { genre, limit = 32 } = req.query;
  if (!genre) return res.status(400).json({ error: 'Genre required' });
  try {
    const tracks = await getRecommendations(req.session.userId, genre, parseInt(limit));
    res.json(tracks);
  } catch (err) {
    console.error('Recommendations error:', err.message);
    res.status(500).json({ error: 'Could not load recommendations' });
  }
});

router.get('/genres', async (req, res) => {
  res.json(await getGenreSeeds());
});

export default router;
