import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App.jsx';
import { rooms, auth } from '../api.js';

export default function Home() {
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  async function handleJoin(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setJoining(true);
    setError('');
    try {
      const room = await rooms.join(code.trim());
      navigate(`/room/${room.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Room not found');
    } finally {
      setJoining(false);
    }
  }

  async function handleLogout() {
    await auth.logout();
    setUser(null);
    navigate('/');
  }

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <div style={styles.brand}>
          <div style={styles.brandDot} />
          BeatBracket
        </div>
        <button style={styles.avatarBtn} onClick={handleLogout} title="Log out">
          {user.avatar
            ? <img src={user.avatar} alt="" style={styles.avatar} />
            : <div style={styles.avatarFallback}>{user.display_name[0]}</div>
          }
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.greeting}>
          <span style={styles.wave}>Hey,</span>
          <span style={styles.name}>{user.display_name.split(' ')[0]}</span>
        </div>
        <p style={styles.sub}>Ready to settle some music debates?</p>

        <div style={styles.actions}>
          <button style={styles.createBtn} onClick={() => navigate('/create')}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 4v12M4 10h12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            New Tournament
          </button>

          <div style={styles.divider}>
            <div style={styles.dividerLine} />
            <span style={styles.dividerText}>or join one</span>
            <div style={styles.dividerLine} />
          </div>

          <form onSubmit={handleJoin} style={styles.joinForm}>
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Enter room code"
              maxLength={8}
              style={styles.codeInput}
              spellCheck={false}
              autoComplete="off"
            />
            <button type="submit" disabled={!code.trim() || joining} style={styles.joinBtn}>
              {joining ? '...' : 'Join'}
            </button>
          </form>

          {error && <p style={styles.error}>{error}</p>}
        </div>

        <div style={styles.howSection}>
          <h2 style={styles.howTitle}>How it works</h2>
          <div style={styles.steps}>
            {[
              { n: '1', title: 'Create a bracket', desc: 'Pick a genre, set the bracket size, invite friends.' },
              { n: '2', title: 'Fill the songs', desc: 'Search Spotify to build your bracket or auto-fill by genre.' },
              { n: '3', title: 'Vote', desc: 'Songs compete head-to-head. The crowd decides.' },
              { n: '4', title: 'Champion', desc: 'One song survives. The debate is settled.' }
            ].map(s => (
              <div key={s.n} style={styles.step}>
                <div style={styles.stepN}>{s.n}</div>
                <div>
                  <div style={styles.stepTitle}>{s.title}</div>
                  <div style={styles.stepDesc}>{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' },
  topbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, background: 'rgba(10,10,11,0.85)',
    backdropFilter: 'blur(20px)', zIndex: 100
  },
  brand: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em' },
  brandDot: { width: 8, height: 8, background: 'var(--green)', borderRadius: '50%' },
  avatarBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 0 },
  avatar: { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' },
  avatarFallback: {
    width: 32, height: 32, borderRadius: '50%', background: 'var(--green)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 700, fontSize: '0.85rem'
  },
  content: { flex: 1, padding: '32px 20px 48px', maxWidth: 480, margin: '0 auto', width: '100%' },
  greeting: { display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 6 },
  wave: { fontSize: '2rem', fontWeight: 300, letterSpacing: '-0.02em', color: 'var(--text2)' },
  name: { fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em' },
  sub: { fontSize: '0.9rem', color: 'var(--text2)', marginBottom: 36 },
  actions: { display: 'flex', flexDirection: 'column', gap: 0 },
  createBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'var(--green)', color: 'white', padding: '15px 20px', borderRadius: 12,
    fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em', border: 'none', cursor: 'pointer',
    transition: 'opacity 0.15s'
  },
  divider: { display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' },
  dividerLine: { flex: 1, height: 1, background: 'var(--border)' },
  dividerText: { fontSize: '0.75rem', color: 'var(--text3)', whiteSpace: 'nowrap' },
  joinForm: { display: 'flex', gap: 8 },
  codeInput: {
    flex: 1, background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: 10, padding: '13px 16px', color: 'var(--text)',
    fontSize: '1rem', fontWeight: 600, letterSpacing: '0.1em', outline: 'none',
    textTransform: 'uppercase'
  },
  joinBtn: {
    background: 'var(--surface2)', border: '1px solid var(--border2)', color: 'var(--text)',
    padding: '13px 20px', borderRadius: 10, fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer',
    transition: 'background 0.15s', whiteSpace: 'nowrap'
  },
  error: { fontSize: '0.82rem', color: '#FF5252', marginTop: 8 },
  howSection: { marginTop: 52 },
  howTitle: {
    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--text3)', marginBottom: 16
  },
  steps: { display: 'flex', flexDirection: 'column', gap: 4 },
  step: {
    display: 'flex', gap: 14, padding: '12px 0',
    borderBottom: '1px solid var(--border)', alignItems: 'flex-start'
  },
  stepN: {
    width: 24, height: 24, borderRadius: '50%', border: '1.5px solid var(--border2)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.72rem', fontWeight: 700, color: 'var(--text2)', flexShrink: 0
  },
  stepTitle: { fontWeight: 600, fontSize: '0.88rem', marginBottom: 2 },
  stepDesc: { fontSize: '0.78rem', color: 'var(--text2)' }
};
