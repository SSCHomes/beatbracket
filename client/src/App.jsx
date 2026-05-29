import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { auth } from './api.js';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Create from './pages/Create.jsx';
import Lobby from './pages/Lobby.jsx';
import Tournament from './pages/Tournament.jsx';
import Champion from './pages/Champion.jsx';

const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

function RequireAuth({ children }) {
  const { user, loading } = useUser();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--surface3)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auth.me()
      .then(u => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/create" element={<RequireAuth><Create /></RequireAuth>} />
          <Route path="/room/:id" element={<RequireAuth><Lobby /></RequireAuth>} />
          <Route path="/room/:id/vote" element={<RequireAuth><Tournament /></RequireAuth>} />
          <Route path="/room/:id/champion" element={<RequireAuth><Champion /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </UserContext.Provider>
  );
}
