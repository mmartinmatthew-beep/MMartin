import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Home from './pages/Home';
import CreatorProfile from './pages/CreatorProfile';
import Dashboard from './pages/Dashboard';
import ContentPolicy from './pages/ContentPolicy';
import { Login, Register } from './pages/Auth';

function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', gap: '1.5rem',
      padding: '0.75rem 1.5rem', borderBottom: '1px solid #e5e7eb',
      background: '#fff', position: 'sticky', top: 0, zIndex: 100,
    }}>
      <Link to="/" style={{ textDecoration: 'none', color: '#4f46e5', fontWeight: 700, fontSize: '1.2rem' }}>
        CreatorHub
      </Link>
      <div style={{ flex: 1 }} />
      <Link to="/policy" style={{ textDecoration: 'none', color: '#555', fontSize: '0.9rem' }}>Content Policy</Link>
      {user ? (
        <>
          <Link to="/dashboard" style={{ textDecoration: 'none', color: '#374151' }}>
            {user.display_name || user.username}
          </Link>
          <button onClick={logout} style={{ border: '1px solid #e5e7eb', background: '#fff', padding: '0.35rem 0.75rem', borderRadius: 6, cursor: 'pointer', color: '#555' }}>
            Log Out
          </button>
        </>
      ) : (
        <>
          <Link to="/login" style={{ textDecoration: 'none', color: '#374151' }}>Log In</Link>
          <Link to="/register" style={{ background: '#4f46e5', color: '#fff', padding: '0.4rem 1rem', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>
            Sign Up
          </Link>
        </>
      )}
    </nav>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/creator/:username" element={<CreatorProfile />} />
          <Route path="/policy" element={<ContentPolicy />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
