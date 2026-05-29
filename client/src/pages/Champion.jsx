import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { rooms } from '../api.js';

export default function Champion() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState(null);

  useEffect(() => {
    rooms.bracket(id).then(setState).catch(() => navigate('/home'));
  }, [id]);

  if (!state) return <Spinner />;

  const champion = state.songs.find(s => s.id === state.room.champion_id);
  if (!champion) return <Spinner />;

  return (
    <div style={styles.page}>
      <div style={styles.glow} />

      <div style={styles.content}>
        <div style={styles.crown}>🏆</div>
        <div style={styles.eyebrow}>{state.room.name} · Champion</div>

        <div style={styles.card}>
          {champion.album_art && (
            <div style={styles.artWrap}>
              <img src={champion.album_art} alt="" style={styles.art} />
              <div style={styles.artOverlay} />
            </div>
          )}
          <div style={styles.cardContent}>
            <div style={styles.songName}>{champion.name}</div>
            <div style={styles.songArtist}>{champion.artist}</div>
            {champion.album && <div style={styles.songAlbum}>{champion.album}</div>}

            <a
              href={`https://open.spotify.com/track/${champion.spotify_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.spotifyLink}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                <path d="M8 0C3.582 0 0 3.582 0 8s3.582 8 8 8 8-3.582 8-8S12.418 0 8 0zm3.672 11.539c-.143.238-.449.313-.687.17-1.882-1.149-4.243-1.41-7.027-.771-.268.062-.536-.106-.598-.374s.106-.536.374-.598c3.048-.695 5.657-.397 7.768.893.238.143.313.449.17.68zm.979-2.177c-.181.292-.564.385-.857.204-2.15-1.322-5.428-1.706-7.974-.934-.33.1-.678-.085-.778-.415s.085-.678.415-.778c2.907-.882 6.52-.455 8.99 1.067.293.181.385.564.204.856zm.084-2.269c-2.58-1.531-6.836-1.673-9.299-.926-.395.12-.814-.104-.933-.499s.104-.814.499-.933c2.83-.859 7.531-.693 10.498 1.068.356.212.473.671.261 1.027s-.671.473-1.026.263z"/>
              </svg>
              Open in Spotify
            </a>
          </div>
        </div>

        {/* Final bracket summary */}
        <div style={styles.summarySection}>
          <div style={styles.summaryTitle}>The bracket</div>
          <div style={styles.bracketSummary}>
            {Array.from(new Set(state.matchups.map(m => m.round))).sort().map(round => {
              const rMatchups = state.matchups.filter(m => m.round === round);
              const totalRounds = Math.max(...state.matchups.map(m => m.round));
              return (
                <div key={round} style={styles.summaryRound}>
                  <div style={styles.summaryRoundLabel}>
                    {round === totalRounds ? 'Final' : round === totalRounds - 1 ? 'Semis' : `R${round}`}
                  </div>
                  {rMatchups.map(m => (
                    <div key={m.id} style={styles.summaryMatchup}>
                      <span style={{ ...styles.summaryTeam, ...(m.winner_id === m.song1_id ? styles.summaryWinner : styles.summaryLoser) }}>
                        {m.song1?.name}
                      </span>
                      <span style={styles.summaryVs}>v</span>
                      <span style={{ ...styles.summaryTeam, ...(m.winner_id === m.song2_id ? styles.summaryWinner : styles.summaryLoser) }}>
                        {m.song2?.name}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div style={styles.actions}>
          <button style={styles.homeBtn} onClick={() => navigate('/home')}>
            Back to home
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes crownBounce { 0%,100% { transform: scale(1) rotate(-5deg); } 50% { transform: scale(1.15) rotate(5deg); } }
      `}</style>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: 28, height: 28, border: '2px solid var(--surface3)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column',
    position: 'relative', overflow: 'hidden'
  },
  glow: {
    position: 'fixed', top: '-20vh', left: '50%', transform: 'translateX(-50%)',
    width: '80vw', height: '60vh',
    background: 'radial-gradient(ellipse, rgba(29,185,84,0.15) 0%, transparent 70%)',
    pointerEvents: 'none', zIndex: 0
  },
  content: {
    position: 'relative', zIndex: 1, maxWidth: 480, margin: '0 auto',
    padding: '40px 20px 60px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 20, animation: 'fadeUp 0.6s ease'
  },
  crown: { fontSize: '3rem', animation: 'crownBounce 2s ease infinite', marginBottom: 4 },
  eyebrow: { fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--green)' },
  card: {
    width: '100%', background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: 20, overflow: 'hidden', boxShadow: '0 0 60px rgba(29,185,84,0.1)'
  },
  artWrap: { position: 'relative', width: '100%', paddingBottom: '55%' },
  art: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  artOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(10,10,11,0.98) 100%)' },
  cardContent: { padding: '20px', display: 'flex', flexDirection: 'column', gap: 6 },
  songName: { fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2 },
  songArtist: { fontSize: '0.95rem', color: 'var(--text2)', fontWeight: 500 },
  songAlbum: { fontSize: '0.8rem', color: 'var(--text3)', marginTop: 2 },
  spotifyLink: {
    display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12,
    background: 'var(--green)', color: 'white', padding: '10px 16px',
    borderRadius: 50, fontWeight: 700, fontSize: '0.82rem', alignSelf: 'flex-start'
  },
  summarySection: { width: '100%' },
  summaryTitle: { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 12 },
  bracketSummary: { display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 4 },
  summaryRound: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 120, flexShrink: 0 },
  summaryRoundLabel: { fontSize: '0.65rem', fontWeight: 700, color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  summaryMatchup: { background: 'var(--surface)', borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 3 },
  summaryTeam: { fontSize: '0.72rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  summaryWinner: { color: 'var(--text)', fontWeight: 700 },
  summaryLoser: { color: 'var(--text3)', textDecoration: 'line-through' },
  summaryVs: { fontSize: '0.6rem', color: 'var(--text3)' },
  actions: { width: '100%', display: 'flex', gap: 10 },
  homeBtn: {
    flex: 1, background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: 12, padding: '13px', fontWeight: 600, fontSize: '0.9rem',
    color: 'var(--text)', cursor: 'pointer'
  }
};
