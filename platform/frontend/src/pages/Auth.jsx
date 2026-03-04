import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', padding: '2rem', border: '1px solid #e5e7eb', borderRadius: 12 }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Log In</h1>
      {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        {[
          { label: 'Email', key: 'email', type: 'email' },
          { label: 'Password', key: 'password', type: 'password' },
        ].map(({ label, key, type }) => (
          <div key={key} style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>{label}</label>
            <input type={type} required value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid #ddd', fontSize: '1rem', boxSizing: 'border-box' }} />
          </div>
        ))}
        <button type="submit" style={{ width: '100%', background: '#4f46e5', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: 6, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>
          Log In
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem', color: '#555' }}>
        No account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', password: '', display_name: '' });
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed');
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', padding: '2rem', border: '1px solid #e5e7eb', borderRadius: 12 }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Create Account</h1>
      {error && <div style={{ background: '#fee2e2', color: '#dc2626', padding: '0.75rem', borderRadius: 6, marginBottom: '1rem' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        {[
          { label: 'Display Name', key: 'display_name', type: 'text' },
          { label: 'Username', key: 'username', type: 'text' },
          { label: 'Email', key: 'email', type: 'email' },
          { label: 'Password (min 8 chars)', key: 'password', type: 'password' },
        ].map(({ label, key, type }) => (
          <div key={key} style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600 }}>{label}</label>
            <input type={type} required value={form[key]}
              onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
              style={{ width: '100%', padding: '0.6rem', borderRadius: 6, border: '1px solid #ddd', fontSize: '1rem', boxSizing: 'border-box' }} />
          </div>
        ))}
        <button type="submit" style={{ width: '100%', background: '#4f46e5', color: '#fff', border: 'none', padding: '0.7rem', borderRadius: 6, fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>
          Create Account
        </button>
      </form>
      <p style={{ textAlign: 'center', marginTop: '1rem', color: '#555' }}>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
