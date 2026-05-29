import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true
});

export default api;

export const auth = {
  me: () => api.get('/auth/me', { baseURL: '' }).then(r => r.data),
  logout: () => api.post('/auth/logout', {}, { baseURL: '' }).then(r => r.data),
  loginUrl: '/auth/login'
};

export const rooms = {
  create: (data) => api.post('/rooms', data).then(r => r.data),
  join: (code) => api.post('/rooms/join', { code }).then(r => r.data),
  get: (id) => api.get(`/rooms/${id}`).then(r => r.data),
  members: (id) => api.get(`/rooms/${id}/members`).then(r => r.data),
  songs: (id) => api.get(`/rooms/${id}/songs`).then(r => r.data),
  addSong: (id, song) => api.post(`/rooms/${id}/songs`, song).then(r => r.data),
  removeSong: (id, songId) => api.delete(`/rooms/${id}/songs/${songId}`).then(r => r.data),
  start: (id) => api.post(`/rooms/${id}/start`).then(r => r.data),
  bracket: (id) => api.get(`/rooms/${id}/bracket`).then(r => r.data),
  vote: (id, matchup_id, song_id) => api.post(`/rooms/${id}/vote`, { matchup_id, song_id }).then(r => r.data),
  advance: (id) => api.post(`/rooms/${id}/advance`).then(r => r.data)
};

export const search = {
  tracks: (q) => api.get('/search/tracks', { params: { q } }).then(r => r.data),
  recommendations: (genre, limit) => api.get('/search/recommendations', { params: { genre, limit } }).then(r => r.data),
  genres: () => api.get('/search/genres').then(r => r.data)
};
