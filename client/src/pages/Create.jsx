import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { rooms, search } from '../api.js';

const SIZES = [
  { value: 8, label: '8 songs', desc: '3 rounds, ~15 min' },
  { value: 16, label: '16 songs', desc: '4 rounds, classic' },
  { value: 32, label: '32 songs', desc: '5 rounds, epic' }
];

const DURATIONS = [
  { value: 1, label: '1 hour' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '1 day' },
  { value: 48, label: '2 days' },
  { value: 168, label: '1 week' }
];

export default function Create() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('');
  const [songCount, setSongCount] = useState(16);
  const [roundDuration, setRoundDuration] = useState(24);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    search.genres().then(setGenres).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const room = await rooms.create({
        name: name.trim(),
        genre: genre || null,
        song_count: songCount,
        round_duration: roundDuration
      });
      navigate(`/room/${room.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create room');
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <button style={styles.back} onClick={() => navigate('/home')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <span style={styles.topbarTitle}>New Tournament</span>
        <div style={{ width: 60 }} />
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.field}>
          <label style={styles.label}>Tournament name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. 90s Hip-Hop Battle"
            style={styles.input}
            maxLength={60}
            required
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Genre <span style={{ color: 'var(--text3)' }}>(optional)</span></label>
          <select value={genre} onChange={e => setGenre(e.target.value)} style={styles.select}>
            <option value="">Any genre</option>
            {genres.map(g => (
              <option key={g} value={g}>{g.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
          <p style={styles.hint}>Used to auto-fill song suggestions in the lobby.</p>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Bracket size</label>
          <div style={styles.optionGroup}>
            {SIZES.map(s => (
              <button
                key={s.value}
                type="button"
                style={{ ...styles.option, ...(songCount === s.value ? styles.optionActive : {}) }}
                onClick={() => setSongCount(s.value)}
              >
                <span style={styles.optionLabel}>{s.label}</span>
                <span style={styles.optionDesc}>{s.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Time per round</label>
          <div style={styles.durationGroup}>
            {DURATIONS.map(d => (
              <button
                key={d.value}
                type="button"
                style={{ ...styles.durationBtn, ...(roundDuration === d.value ? styles.durationActive : {}) }}
                onClick={() => setRoundDuration(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p style={styles.hint}>When time expires, the organizer can advance the round.</p>
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <button type="submit" disabled={loading || !name.trim()} style={styles.submitBtn}>
          {loading ? 'Creating...' : 'Create Tournament'}
        </button>
      </form>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  topbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)'
  },
  back: {
    display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none',
    color: 'var(--text2)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500
  },
  topbarTitle: { fontSize: '0.9rem', fontWeight: 600 },
  form: { padding: '24px 20px 48px', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text2)', letterSpacing: '0.02em' },
  input: {
    background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 10,
    padding: '13px 16px', color: 'var(--text)', fontSize: '0.95rem', outline: 'none',
    transition: 'border-color 0.15s'
  },
  select: {
    background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 10,
    padding: '13px 16px', color: 'var(--text)', fontSize: '0.9rem', outline: 'none',
    appearance: 'none', cursor: 'pointer'
  },
  hint: { fontSize: '0.75rem', color: 'var(--text3)' },
  optionGroup: { display: 'flex', gap: 8 },
  option: {
    flex: 1, padding: '12px 10px', borderRadius: 10, border: '1px solid var(--border)',
    background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 3,
    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center'
  },
  optionActive: { border: '1px solid var(--green)', background: 'var(--green-dim)' },
  optionLabel: { fontWeight: 600, fontSize: '0.85rem' },
  optionDesc: { fontSize: '0.7rem', color: 'var(--text2)' },
  durationGroup: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  durationBtn: {
    padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text2)', fontSize: '0.8rem',
    fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
  },
  durationActive: { border: '1px solid var(--green)', background: 'var(--green-dim)', color: 'var(--green)' },
  error: { fontSize: '0.82rem', color: '#FF5252' },
  submitBtn: {
    background: 'var(--green)', color: 'white', padding: '15px', borderRadius: 12,
    fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer',
    opacity: 1, transition: 'opacity 0.15s'
  }
};
