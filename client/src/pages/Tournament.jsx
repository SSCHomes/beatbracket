import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../App.jsx';
import { rooms } from '../api.js';
import socket, { joinRoom, leaveRoom } from '../socket.js';

export default function Tournament() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();

  const [state, setState] = useState(null);
  const [activeMatchup, setActiveMatchup] = useState(0);
  const [voting, setVoting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [audio, setAudio] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  const isOrganizer = state?.room?.organizer_id === user?.id;

  useEffect(() => {
    loadState();
    joinRoom(id);

    socket.on('vote:cast', ({ matchup_id, votes }) => {
      setState(prev => prev ? { ...prev, votes } : prev);
    });
    socket.on('round:advanced', ({ state: newState }) => {
      setState(newState);
      setActiveMatchup(0);
      setShowResults(false);
      setPlaying(null);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    });
    socket.on('tournament:complete', ({ champion }) => {
      navigate(`/room/${id}/champion`);
    });

    return () => {
      leaveRoom(id);
      socket.off('vote:cast');
      socket.off('round:advanced');
      socket.off('tournament:complete');
      if (audioRef.current) audioRef.current.pause();
      clearInterval(timerRef.current);
    };
  }, [id]);

  // Timer
  useEffect(() => {
    if (!state?.room?.round_ends_at) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const left = Math.max(0, state.room.round_ends_at - Date.now());
      setTimeLeft(left);
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [state?.room?.round_ends_at]);

  async function loadState() {
    try {
      const s = await rooms.bracket(id);
      if (s.room.status === 'complete') return navigate(`/room/${id}/champion`);
      if (s.room.status === 'lobby') return navigate(`/room/${id}`);
      setState(s);
    } catch {
      navigate('/home');
    }
  }

  async function vote(matchupId, songId) {
    if (voting) return;
    setVoting(true);
    try {
      const { votes } = await rooms.vote(id, matchupId, songId);
      setState(prev => prev ? { ...prev, votes, myVotes: { ...prev.myVotes, [matchupId]: songId } } : prev);
    } catch (err) {
      console.error(err);
    }
    setVoting(false);
  }

  async function advance() {
    if (advancing) return;
    setAdvancing(true);
    try {
      await rooms.advance(id);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to advance');
    }
    setAdvancing(false);
  }

  function togglePreview(song) {
    if (playing === song.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (!song.preview_url) return;
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(song.preview_url);
    a.volume = 0.7;
    a.play();
    a.onended = () => setPlaying(null);
    audioRef.current = a;
    setPlaying(song.id);
  }

  if (!state) return <Spinner />;

  const { room, matchups, myVotes, votes, totalRounds } = state;
  const currentMatchups = matchups.filter(m => m.round === room.current_round);
  const matchup = currentMatchups[activeMatchup];
  const totalVoted = matchup ? Object.values(myVotes).filter(v => {
    const m = currentMatchups.find(m => m.id === Object.keys(myVotes).find(k => myVotes[k] === v));
    return m;
  }).length : 0;
  const myVotedCount = currentMatchups.filter(m => myVotes[m.id]).length;

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.roundBadge}>Round {room.current_round} of {totalRounds}</div>
          <div style={styles.roomName}>{room.name}</div>
        </div>
        {timeLeft !== null && (
          <div style={styles.timer}>
            <div style={styles.timerDot} />
            {formatTime(timeLeft)}
          </div>
        )}
      </div>

      {/* Matchup nav */}
      {currentMatchups.length > 1 && (
        <div style={styles.matchupNav}>
          {currentMatchups.map((m, i) => (
            <button
              key={m.id}
              style={{ ...styles.matchupDot, ...(i === activeMatchup ? styles.matchupDotActive : {}), ...(myVotes[m.id] ? styles.matchupDotVoted : {}) }}
              onClick={() => setActiveMatchup(i)}
            />
          ))}
          <span style={styles.matchupCount}>{activeMatchup + 1} / {currentMatchups.length}</span>
        </div>
      )}

      {matchup && (
        <div style={styles.arena}>
          {/* Song cards */}
          <div style={styles.matchupWrap}>
            <SongCard
              song={matchup.song1}
              voted={myVotes[matchup.id] === matchup.song1_id}
              isOtherVoted={myVotes[matchup.id] && myVotes[matchup.id] !== matchup.song1_id}
              votes={votes[matchup.id]?.[matchup.song1_id] || 0}
              totalVotes={votes[matchup.id]?.total || 0}
              showVotes={!!myVotes[matchup.id]}
              playing={playing === matchup.song1?.id}
              onVote={() => vote(matchup.id, matchup.song1_id)}
              onPreview={() => togglePreview(matchup.song1)}
            />

            <div style={styles.vs}>VS</div>

            <SongCard
              song={matchup.song2}
              voted={myVotes[matchup.id] === matchup.song2_id}
              isOtherVoted={myVotes[matchup.id] && myVotes[matchup.id] !== matchup.song2_id}
              votes={votes[matchup.id]?.[matchup.song2_id] || 0}
              totalVotes={votes[matchup.id]?.total || 0}
              showVotes={!!myVotes[matchup.id]}
              playing={playing === matchup.song2?.id}
              onVote={() => vote(matchup.id, matchup.song2_id)}
              onPreview={() => togglePreview(matchup.song2)}
            />
          </div>

          {/* Navigation */}
          <div style={styles.navRow}>
            <button
              style={{ ...styles.navBtn, opacity: activeMatchup === 0 ? 0.3 : 1 }}
              onClick={() => setActiveMatchup(i => Math.max(0, i - 1))}
              disabled={activeMatchup === 0}
            >← Prev</button>
            <span style={styles.voteStatus}>
              {myVotedCount} / {currentMatchups.length} voted
            </span>
            <button
              style={{ ...styles.navBtn, opacity: activeMatchup === currentMatchups.length - 1 ? 0.3 : 1 }}
              onClick={() => setActiveMatchup(i => Math.min(currentMatchups.length - 1, i + 1))}
              disabled={activeMatchup === currentMatchups.length - 1}
            >Next →</button>
          </div>
        </div>
      )}

      {/* Bracket overview toggle */}
      <button style={styles.bracketToggle} onClick={() => setShowResults(s => !s)}>
        {showResults ? 'Hide bracket' : 'View bracket'}
      </button>

      {showResults && <BracketOverview matchups={matchups} currentRound={room.current_round} totalRounds={totalRounds} />}

      {/* Organizer advance */}
      {isOrganizer && (
        <div style={styles.advanceSection}>
          <button style={styles.advanceBtn} onClick={advance} disabled={advancing}>
            {advancing ? 'Advancing...' : `End round & advance →`}
          </button>
          <p style={styles.advanceNote}>Tally votes and move winners to the next round.</p>
        </div>
      )}
    </div>
  );
}

function SongCard({ song, voted, isOtherVoted, votes, totalVotes, showVotes, playing, onVote, onPreview }) {
  if (!song) return null;
  const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
  const isWinning = showVotes && votes > 0 && votes >= totalVotes - votes;

  return (
    <div style={{
      ...cardStyles.card,
      ...(voted ? cardStyles.cardVoted : {}),
      ...(isOtherVoted ? cardStyles.cardDimmed : {}),
    }}>
      {song.album_art && (
        <div style={{ ...cardStyles.artWrap }}>
          <img src={song.album_art} alt="" style={cardStyles.art} />
          <div style={cardStyles.artOverlay} />
        </div>
      )}
      <div style={cardStyles.content}>
        <div style={cardStyles.meta}>
          <div style={cardStyles.title}>{song.name}</div>
          <div style={cardStyles.artist}>{song.artist}</div>
        </div>

        {song.preview_url && (
          <button style={{ ...cardStyles.previewBtn, ...(playing ? cardStyles.previewBtnActive : {}) }} onClick={onPreview}>
            {playing
              ? <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="4" height="12" rx="1"/><rect x="8" y="1" width="4" height="12" rx="1"/></svg>
              : <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path d="M3 2l9 5-9 5V2z"/></svg>
            }
            {playing ? 'Pause' : 'Preview'}
          </button>
        )}

        {showVotes ? (
          <div style={cardStyles.voteBar}>
            <div style={{ ...cardStyles.voteBarFill, width: `${pct}%`, background: voted ? 'var(--green)' : 'rgba(255,255,255,0.25)' }} />
            <span style={cardStyles.votePct}>{pct}%</span>
          </div>
        ) : (
          <button
            style={{ ...cardStyles.voteBtn, ...(voted ? cardStyles.voteBtnActive : {}) }}
            onClick={onVote}
          >
            {voted ? '✓ Voted' : 'Vote'}
          </button>
        )}
      </div>
      {voted && <div style={cardStyles.votedBadge}>Your pick</div>}
    </div>
  );
}

function BracketOverview({ matchups, currentRound, totalRounds }) {
  const rounds = [];
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push({ round: r, matchups: matchups.filter(m => m.round === r) });
  }

  return (
    <div style={bracketStyles.wrap}>
      <div style={bracketStyles.scroll}>
        {rounds.map(({ round, matchups: rMatchups }) => (
          <div key={round} style={bracketStyles.col}>
            <div style={bracketStyles.roundLabel}>
              {round === totalRounds ? 'Final' : round === totalRounds - 1 ? 'Semis' : `Round ${round}`}
            </div>
            {rMatchups.map(m => (
              <div key={m.id} style={{
                ...bracketStyles.matchup,
                ...(round === currentRound ? bracketStyles.matchupActive : {}),
                ...(m.winner_id ? bracketStyles.matchupDone : {})
              }}>
                <div style={{ ...bracketStyles.team, ...(m.winner_id === m.song1_id ? bracketStyles.winner : {}) }}>
                  {m.song1?.album_art && <img src={m.song1.album_art} alt="" style={bracketStyles.teamArt} />}
                  <span style={bracketStyles.teamName}>{m.song1?.name || '—'}</span>
                </div>
                <div style={bracketStyles.divider} />
                <div style={{ ...bracketStyles.team, ...(m.winner_id === m.song2_id ? bracketStyles.winner : {}) }}>
                  {m.song2?.album_art && <img src={m.song2.album_art} alt="" style={bracketStyles.teamArt} />}
                  <span style={bracketStyles.teamName}>{m.song2?.name || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
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
  page: { minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', paddingBottom: 40 },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', borderBottom: '1px solid var(--border)',
    background: 'rgba(10,10,11,0.9)', backdropFilter: 'blur(20px)',
    position: 'sticky', top: 0, zIndex: 100
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
  roundBadge: { fontSize: '0.68rem', fontWeight: 700, color: 'var(--green)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  roomName: { fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.01em' },
  timer: { display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text2)' },
  timerDot: { width: 6, height: 6, background: 'var(--green)', borderRadius: '50%', animation: 'pulse 2s infinite' },
  matchupNav: { display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', borderBottom: '1px solid var(--border)' },
  matchupDot: { width: 8, height: 8, borderRadius: '50%', background: 'var(--surface3)', border: 'none', cursor: 'pointer', transition: 'background 0.15s' },
  matchupDotActive: { background: 'var(--text)', width: 10, height: 10 },
  matchupDotVoted: { background: 'var(--green)' },
  matchupCount: { marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text2)', fontWeight: 600 },
  arena: { flex: 1, padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 16 },
  matchupWrap: { display: 'flex', flexDirection: 'column', gap: 10 },
  vs: { textAlign: 'center', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.2em', color: 'var(--text3)' },
  navRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' },
  navBtn: { fontSize: '0.82rem', fontWeight: 600, color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0' },
  voteStatus: { fontSize: '0.78rem', color: 'var(--text2)' },
  bracketToggle: {
    margin: '16px 16px 0', background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: 10, padding: '10px', fontSize: '0.82rem', fontWeight: 600,
    color: 'var(--text2)', cursor: 'pointer'
  },
  advanceSection: { margin: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 },
  advanceBtn: {
    background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 12,
    padding: '14px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)', cursor: 'pointer'
  },
  advanceNote: { fontSize: '0.72rem', color: 'var(--text3)', textAlign: 'center' }
};

const cardStyles = {
  card: {
    position: 'relative', borderRadius: 16, overflow: 'hidden',
    border: '1px solid var(--border)', background: 'var(--surface)',
    transition: 'transform 0.15s, border-color 0.15s', cursor: 'pointer'
  },
  cardVoted: { border: '1px solid var(--green)', boxShadow: '0 0 0 1px rgba(29,185,84,0.15)' },
  cardDimmed: { opacity: 0.5 },
  artWrap: { position: 'relative', width: '100%', paddingBottom: '40%', overflow: 'hidden' },
  art: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  artOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(10,10,11,0.95) 100%)' },
  content: { padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  meta: { display: 'flex', flexDirection: 'column', gap: 3 },
  title: { fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.01em', lineHeight: 1.3 },
  artist: { fontSize: '0.8rem', color: 'var(--text2)' },
  previewBtn: {
    display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface2)',
    border: '1px solid var(--border2)', borderRadius: 8, padding: '7px 12px',
    fontSize: '0.78rem', fontWeight: 600, color: 'var(--text2)', cursor: 'pointer',
    alignSelf: 'flex-start', transition: 'all 0.15s'
  },
  previewBtnActive: { background: 'var(--green-dim)', borderColor: 'var(--green-border)', color: 'var(--green)' },
  voteBtn: {
    background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 10,
    padding: '11px', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer',
    color: 'var(--text)', transition: 'all 0.15s'
  },
  voteBtnActive: { background: 'var(--green)', border: '1px solid var(--green)', color: 'white' },
  voteBar: {
    height: 32, background: 'var(--surface2)', borderRadius: 8, overflow: 'hidden',
    position: 'relative', display: 'flex', alignItems: 'center'
  },
  voteBarFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 8, transition: 'width 0.4s ease' },
  votePct: { position: 'relative', zIndex: 1, fontSize: '0.8rem', fontWeight: 700, marginLeft: 10 },
  votedBadge: {
    position: 'absolute', top: 10, right: 10, background: 'var(--green)', color: 'white',
    fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.04em'
  }
};

const bracketStyles = {
  wrap: { margin: '12px 16px 0', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' },
  scroll: { display: 'flex', gap: 0, overflowX: 'auto', padding: '16px' },
  col: { display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160, marginRight: 16, flexShrink: 0 },
  roundLabel: { fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 },
  matchup: { background: 'var(--surface2)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', opacity: 0.6 },
  matchupActive: { opacity: 1, border: '1px solid var(--border2)' },
  matchupDone: { opacity: 0.7 },
  team: { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px' },
  winner: { background: 'var(--green-dim)' },
  teamArt: { width: 20, height: 20, borderRadius: 4, objectFit: 'cover', flexShrink: 0 },
  teamName: { fontSize: '0.72rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 },
  divider: { height: 1, background: 'var(--border)', margin: '0 10px' }
};
