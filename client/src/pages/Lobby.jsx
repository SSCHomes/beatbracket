import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../App.jsx';
import { rooms, search as searchApi } from '../api.js';
import socket, { joinRoom, leaveRoom } from '../socket.js';

export default function Lobby() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();

  const [room, setRoom] = useState(null);
  const [songs, setSongs] = useState([]);
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const searchTimer = useRef(null);

  const isOrganizer = room?.organizer_id === user?.id;
  const spotsLeft = room ? room.song_count - songs.length : 0;
  const isFull = spotsLeft === 0;

  useEffect(() => {
    async function load() {
      try {
        const [r, s, m] = await Promise.all([rooms.get(id), rooms.songs(id), rooms.members(id)]);
        setRoom(r);
        setSongs(s);
        setMembers(m);
        if (r.status === 'active' || r.status === 'between_rounds') {
          navigate(`/room/${id}/vote`);
        } else if (r.status === 'complete') {
          navigate(`/room/${id}/champion`);
        }
      } catch {
        navigate('/home');
      }
    }
    load();

    joinRoom(id);
    socket.on('song:added', song => setSongs(prev => [...prev, song]));
    socket.on('song:removed', songId => setSongs(prev => prev.filter(s => s.id !== songId)));
    socket.on('tournament:started', () => navigate(`/room/${id}/vote`));

    return () => {
      leaveRoom(id);
      socket.off('song:added');
      socket.off('song:removed');
      socket.off('tournament:started');
    };
  }, [id]);

  function handleSearch(q) {
    setQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) { setResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchApi.tracks(q);
        setResults(res);
      } catch {}
      setSearching(false);
    }, 400);
  }

  async function addSong(track) {
    if (isFull) return;
    try {
      await rooms.addSong(id, track);
      setResults([]);
      setQuery('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add song');
    }
  }

  async function removeSong(songId) {
    try {
      await rooms.removeSong(id, songId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove');
    }
  }

  async function autoFill() {
    if (!room?.genre) return;
    setAutoFilling(true);
    setError('');
    try {
      const needed = spotsLeft;
      const existing = new Set(songs.map(s => s.spotify_id));
      const recs = await searchApi.recommendations(room.genre, 50);
      const toAdd = recs.filter(r => !existing.has(r.spotify_id)).slice(0, needed);
      for (const track of toAdd) {
        try { await rooms.addSong(id, track); } catch {}
      }
    } catch {
      setError('Auto-fill failed');
    }
    setAutoFilling(false);
  }

  async function handleStart() {
    setStarting(true);
    setError('');
    try {
      await rooms.start(id);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start');
      setStarting(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(room.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!room) return <Loading />;

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <button style={styles.back} onClick={() => navigate('/home')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.roomName}>{room.name}</div>
          <div style={styles.roomMeta}>{members.length} joined · {songs.length}/{room.song_count} songs</div>
        </div>
        <button style={styles.codeChip} onClick={copyCode}>
          {copied ? '✓ Copied' : room.code}
        </button>
      </div>

      <div style={styles.content}>
        {/* Progress */}
        <div style={styles.progressSection}>
          <div style={styles.progressHeader}>
            <span style={styles.progressLabel}>Bracket</span>
            <span style={styles.progressCount}>{songs.length} / {room.song_count}</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${(songs.length / room.song_count) * 100}%` }} />
          </div>
          {isFull && <p style={styles.readyText}>Bracket is full and ready to start!</p>}
        </div>

        {/* Song search (lobby only) */}
        {!isFull && (
          <div style={styles.searchSection}>
            <div style={styles.searchRow}>
              <div style={styles.searchWrap}>
                <svg style={styles.searchIcon} width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M9.5 9.5l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  value={query}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="Search Spotify..."
                  style={styles.searchInput}
                  autoComplete="off"
                />
              </div>
              {room.genre && (
                <button style={styles.autoFillBtn} onClick={autoFill} disabled={autoFilling}>
                  {autoFilling ? '...' : 'Auto-fill'}
                </button>
              )}
            </div>

            {results.length > 0 && (
              <div style={styles.results}>
                {results.map(track => {
                  const already = songs.some(s => s.spotify_id === track.spotify_id);
                  return (
                    <div key={track.spotify_id} style={styles.result}>
                      <img src={track.album_art} alt="" style={styles.resultArt} />
                      <div style={styles.resultMeta}>
                        <div style={styles.resultName}>{track.name}</div>
                        <div style={styles.resultArtist}>{track.artist}</div>
                      </div>
                      <button
                        style={{ ...styles.addBtn, ...(already ? styles.addBtnDone : {}) }}
                        onClick={() => !already && addSong(track)}
                        disabled={already || isFull}
                      >
                        {already ? '✓' : '+'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {searching && <p style={styles.searching}>Searching...</p>}
          </div>
        )}

        {error && <p style={styles.error}>{error}</p>}

        {/* Songs in bracket */}
        <div style={styles.songsSection}>
          <div style={styles.sectionTitle}>
            In the bracket
            {spotsLeft > 0 && <span style={styles.spotsLeft}>{spotsLeft} spots left</span>}
          </div>
          {songs.length === 0
            ? <p style={styles.empty}>No songs yet — search above to add some.</p>
            : (
              <div style={styles.songList}>
                {songs.map((song, i) => (
                  <div key={song.id} style={styles.songItem}>
                    <div style={styles.songSeed}>{i + 1}</div>
                    {song.album_art && <img src={song.album_art} alt="" style={styles.songArt} />}
                    <div style={styles.songInfo}>
                      <div style={styles.songName}>{song.name}</div>
                      <div style={styles.songArtist}>{song.artist}</div>
                    </div>
                    {(isOrganizer || song.added_by === user.id) && (
                      <button style={styles.removeBtn} onClick={() => removeSong(song.id)}>×</button>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>

        {/* Members */}
        <div style={styles.membersSection}>
          <div style={styles.sectionTitle}>Players</div>
          <div style={styles.memberList}>
            {members.map(m => (
              <div key={m.id} style={styles.member}>
                {m.avatar
                  ? <img src={m.avatar} alt="" style={styles.memberAvatar} />
                  : <div style={styles.memberFallback}>{m.display_name[0]}</div>
                }
                <span style={styles.memberName}>{m.display_name.split(' ')[0]}</span>
                {m.id === room.organizer_id && <span style={styles.organizerBadge}>host</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Start button */}
        {isOrganizer && (
          <button
            style={{ ...styles.startBtn, ...(!isFull ? styles.startBtnDisabled : {}) }}
            onClick={handleStart}
            disabled={!isFull || starting}
          >
            {starting ? 'Starting...' : isFull ? 'Start Tournament' : `Need ${spotsLeft} more songs`}
          </button>
        )}
        {!isOrganizer && (
          <p style={styles.waitText}>
            Waiting for <strong>{members.find(m => m.id === room.organizer_id)?.display_name || 'the host'}</strong> to start.
          </p>
        )}
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: 28, height: 28, border: '2px solid var(--surface3)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: 'var(--bg)' },
  topbar: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
    borderBottom: '1px solid var(--border)', position: 'sticky', top: 0,
    background: 'rgba(10,10,11,0.9)', backdropFilter: 'blur(20px)', zIndex: 100
  },
  back: { color: 'var(--text2)', padding: 4, flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' },
  roomName: { fontWeight: 700, fontSize: '0.95rem', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  roomMeta: { fontSize: '0.72rem', color: 'var(--text2)', marginTop: 1 },
  codeChip: {
    background: 'var(--surface2)', border: '1px solid var(--border2)', borderRadius: 8,
    padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em',
    color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
  },
  content: { padding: '20px 16px 80px', maxWidth: 560, margin: '0 auto' },
  progressSection: { marginBottom: 24 },
  progressHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  progressLabel: { fontSize: '0.75rem', fontWeight: 600, color: 'var(--text2)' },
  progressCount: { fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' },
  progressTrack: { height: 4, background: 'var(--surface2)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--green)', borderRadius: 2, transition: 'width 0.4s ease' },
  readyText: { fontSize: '0.78rem', color: 'var(--green)', marginTop: 8, fontWeight: 600 },
  searchSection: { marginBottom: 20 },
  searchRow: { display: 'flex', gap: 8, marginBottom: 8 },
  searchWrap: { flex: 1, position: 'relative' },
  searchIcon: { position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' },
  searchInput: {
    width: '100%', background: 'var(--surface)', border: '1px solid var(--border2)',
    borderRadius: 10, padding: '11px 12px 11px 34px', color: 'var(--text)',
    fontSize: '0.88rem', outline: 'none'
  },
  autoFillBtn: {
    background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 10,
    padding: '0 14px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text2)', cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  results: {
    background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12,
    overflow: 'hidden', maxHeight: 320, overflowY: 'auto'
  },
  result: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--border)' },
  resultArt: { width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 },
  resultMeta: { flex: 1, minWidth: 0 },
  resultName: { fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resultArtist: { fontSize: '0.75rem', color: 'var(--text2)', marginTop: 1 },
  addBtn: {
    width: 28, height: 28, borderRadius: '50%', background: 'var(--green)', color: 'white',
    fontWeight: 700, fontSize: '1.1rem', border: 'none', cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s'
  },
  addBtnDone: { background: 'var(--surface3)', color: 'var(--text2)', cursor: 'default' },
  searching: { fontSize: '0.78rem', color: 'var(--text3)', padding: '8px 0' },
  error: { fontSize: '0.82rem', color: '#FF5252', marginBottom: 12 },
  songsSection: { marginBottom: 24 },
  sectionTitle: {
    fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: 'var(--text3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8
  },
  spotsLeft: { fontWeight: 600, color: 'var(--text2)', textTransform: 'none', letterSpacing: 0, fontSize: '0.7rem' },
  empty: { fontSize: '0.82rem', color: 'var(--text3)', padding: '12px 0' },
  songList: { display: 'flex', flexDirection: 'column', gap: 2 },
  songItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
    background: 'var(--surface)', borderRadius: 10
  },
  songSeed: { width: 20, fontSize: '0.7rem', color: 'var(--text3)', fontWeight: 700, flexShrink: 0, textAlign: 'center' },
  songArt: { width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 },
  songInfo: { flex: 1, minWidth: 0 },
  songName: { fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  songArtist: { fontSize: '0.72rem', color: 'var(--text2)', marginTop: 1 },
  removeBtn: { color: 'var(--text3)', fontWeight: 700, fontSize: '1.1rem', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', flexShrink: 0 },
  membersSection: { marginBottom: 28 },
  memberList: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  member: { display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface)', borderRadius: 20, padding: '5px 10px 5px 5px' },
  memberAvatar: { width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' },
  memberFallback: {
    width: 24, height: 24, borderRadius: '50%', background: 'var(--green)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.72rem', fontWeight: 700
  },
  memberName: { fontSize: '0.78rem', fontWeight: 500 },
  organizerBadge: { fontSize: '0.65rem', color: 'var(--green)', fontWeight: 600, background: 'var(--green-dim)', padding: '2px 5px', borderRadius: 4 },
  startBtn: {
    width: '100%', background: 'var(--green)', color: 'white', padding: '15px',
    borderRadius: 12, fontWeight: 700, fontSize: '0.95rem', border: 'none', cursor: 'pointer'
  },
  startBtnDisabled: { background: 'var(--surface2)', color: 'var(--text2)', cursor: 'not-allowed' },
  waitText: { fontSize: '0.85rem', color: 'var(--text2)', textAlign: 'center', padding: '16px 0' }
};
