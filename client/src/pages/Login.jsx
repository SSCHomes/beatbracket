import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../App.jsx';

export default function Login() {
  const { user, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/home');
  }, [user, loading]);

  const error = new URLSearchParams(window.location.search).get('error');

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="#1DB954"/>
            <path d="M8 22C11 20 15 19 18 21C21 23 25 22 28 20" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M8 17C12 14.5 16 14 19 16C22 18 26 17 28 15" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M8 12C13 9 17 9 20 11C23 13 26 12 28 10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1 style={styles.title}>BeatBracket</h1>
        <p style={styles.tagline}>March Madness for music.<br />Compete with friends. Crown a champion.</p>

        {error && (
          <div style={styles.error}>Login failed — try again.</div>
        )}

        <a href="/auth/login" style={styles.spotifyBtn}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
            <path d="M10 0C4.477 0 0 4.477 0 10s4.477 10 10 10 10-4.477 10-10S15.523 0 10 0zm4.586 14.424c-.18.295-.563.387-.857.207-2.35-1.435-5.305-1.76-8.786-.963-.335.077-.67-.133-.746-.469-.077-.336.132-.67.469-.746 3.809-.87 7.077-.496 9.713 1.115.293.18.386.563.207.856zm1.223-2.723c-.226.367-.706.482-1.072.257-2.687-1.652-6.785-2.131-9.965-1.166-.413.127-.848-.106-.973-.517-.126-.412.107-.848.518-.973 3.632-1.102 8.147-.568 11.235 1.327.366.226.48.707.257 1.072zm.105-2.835c-3.223-1.914-8.54-2.09-11.618-1.156-.494.15-1.017-.13-1.166-.623-.149-.494.13-1.017.623-1.166 3.532-1.073 9.404-.866 13.115 1.337.445.264.59.838.327 1.282-.264.443-.838.59-1.281.326z"/>
          </svg>
          Continue with Spotify
        </a>

        <p style={styles.note}>Free Spotify account works. No premium required.</p>
      </div>

      <div style={styles.features}>
        {[
          { icon: '🎵', label: 'Pick a genre' },
          { icon: '⚔️', label: 'Song vs song' },
          { icon: '🏆', label: 'Crown the best' }
        ].map(f => (
          <div key={f.label} style={styles.feature}>
            <span style={{ fontSize: 22 }}>{f.icon}</span>
            <span style={styles.featureLabel}>{f.label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 20px',
    gap: 32,
    background: 'radial-gradient(ellipse at 50% 0%, rgba(29,185,84,0.08) 0%, var(--bg) 60%)'
  },
  card: {
    width: '100%',
    maxWidth: 380,
    textAlign: 'center',
    animation: 'fadeIn 0.5s ease'
  },
  logo: {
    display: 'inline-flex',
    marginBottom: 20
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    marginBottom: 12
  },
  tagline: {
    fontSize: '0.9rem',
    color: 'var(--text2)',
    lineHeight: 1.6,
    marginBottom: 32
  },
  spotifyBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '14px 20px',
    background: 'var(--green)',
    color: 'white',
    borderRadius: 50,
    fontWeight: 700,
    fontSize: '0.95rem',
    letterSpacing: '-0.01em',
    transition: 'opacity 0.15s',
    cursor: 'pointer'
  },
  note: {
    marginTop: 12,
    fontSize: '0.75rem',
    color: 'var(--text3)'
  },
  error: {
    background: 'rgba(232,0,29,0.12)',
    border: '1px solid rgba(232,0,29,0.25)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: '0.82rem',
    color: '#FF5252',
    marginBottom: 16
  },
  features: {
    display: 'flex',
    gap: 24
  },
  feature: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6
  },
  featureLabel: {
    fontSize: '0.75rem',
    color: 'var(--text2)',
    fontWeight: 500
  }
};
