import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shield, UserCheck, Users, Eye, EyeOff, LogIn, Wifi, GraduationCap } from 'lucide-react';

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (cred_email, cred_password) => {
    setEmail(cred_email);
    setPassword(cred_password);
    setError('');
    setLoading(true);
    try {
      await login(cred_email, cred_password);
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const quick = [
    { label: 'Admin', email: 'admin@kemu.ac.ke', password: 'admin123', icon: Shield, color: '#2563eb' },
    { label: 'Lecturer', email: 'jdoe@kemu.ac.ke', password: 'lecturer123', icon: UserCheck, color: '#7c3aed' },
    { label: 'QA Officer', email: 'qa@kemu.ac.ke', password: 'qa123', icon: Users, color: '#059669' },
    { label: 'Student', email: 'alice@student.kemu.ac.ke', password: 'student123', icon: GraduationCap, color: '#e11d48' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '460px' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: '72px', height: '72px', borderRadius: '20px', marginBottom: '1.5rem',
                        background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                        boxShadow: '0 0 40px rgba(37,99,235,0.4)' }}>
            <Wifi size={36} color="white" />
          </div>
          <h1 className="gradient-text" style={{ fontSize: '2.2rem', marginBottom: '0.5rem' }}>
            KeMU Smart Ecosystem
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
            One Card. One Identity. A Connected Campus.
          </p>
        </div>

        {/* Login Form */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.25rem' }}>Sign in to your portal</h2>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Email Address
              </label>
              <input
                type="email"
                className="input"
                placeholder="you@kemu.ac.ke"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ width: '100%' }}
                id="login-email"
                autoComplete="email"
              />
            </div>
            <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Password
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                className="input"
                placeholder="Your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', paddingRight: '3rem' }}
                id="login-password"
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{ position: 'absolute', right: '1rem', top: '2.3rem',
                         background: 'none', border: 'none', cursor: 'pointer',
                         color: 'var(--text-muted)' }}>
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)',
                            border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px',
                            padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" id="login-submit"
              style={{ width: '100%', justifyContent: 'center', gap: '0.5rem' }}
              disabled={loading}>
              {loading ? (
                <span style={{ display: 'inline-block', width: '16px', height: '16px',
                               border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                               borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : <LogIn size={16} />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Quick access */}
          <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textAlign: 'center' }}>
              Quick Access (Demo)
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {quick.map(q => (
                <button key={q.label} onClick={() => quickLogin(q.email, q.password)}
                  className="btn btn-outline"
                  style={{ flex: 1, fontSize: '0.78rem', padding: '0.6rem 0.5rem',
                           display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                  disabled={loading}>
                  <q.icon size={14} color={q.color} />
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '1.5rem' }}>
          Kenya Methodist University · NFC Identity Platform
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Login;
