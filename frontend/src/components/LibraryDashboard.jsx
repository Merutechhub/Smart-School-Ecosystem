import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Users, RefreshCw, X, Save, Search } from 'lucide-react';

const API = 'http://localhost:5000';

const LibraryDashboard = () => {
  const [tab, setTab] = useState('members');
  const [members, setMembers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [regUid, setRegUid] = useState('');
  const [regError, setRegError] = useState('');
  const [showBorrow, setShowBorrow] = useState(false);
  const [borrowForm, setBorrowForm] = useState({ student_uid: '', item_name: '', isbn: '' });

  const fetchAll = () => Promise.all([
    fetch(`${API}/api/library/members`).then(r => r.json()),
    fetch(`${API}/api/library/transactions`).then(r => r.json()),
    fetch(`${API}/api/admin/students`).then(r => r.json()),
  ]).then(([m, t, s]) => {
    setMembers(m.members || []);
    setTransactions(t.transactions || []);
    setStudents(s.students || []);
  }).finally(() => setLoading(false));

  useEffect(() => { fetchAll(); }, []);

  const registerMember = async () => {
    if (!regUid) { setRegError('Select a student'); return; }
    const res = await fetch(`${API}/api/library/members`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_uid: regUid }) });
    if (res.ok) { setShowRegister(false); setRegUid(''); fetchAll(); }
    else { const d = await res.json(); setRegError(d.error); }
  };

  const recordBorrow = async () => {
    const res = await fetch(`${API}/api/library/borrow`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(borrowForm) });
    if (res.ok) { setShowBorrow(false); setBorrowForm({ student_uid: '', item_name: '', isbn: '' }); fetchAll(); }
  };

  const recordReturn = async (txId) => {
    await fetch(`${API}/api/library/return/${txId}`, { method: 'POST' });
    fetchAll();
  };

  const updateStatus = async (student_uid, status) => {
    await fetch(`${API}/api/library/members/${student_uid}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }) });
    fetchAll();
  };

  const filteredMembers = members.filter(m =>
    m.student_name.toLowerCase().includes(search.toLowerCase()) ||
    m.reg_no.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading Library data...</div>;

  const stats = { total: members.length, active: members.filter(m => m.status === 'Active').length,
                  borrowed: transactions.filter(t => !t.returned_at && t.action === 'Borrow').length };

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Library Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Member registration, borrowing, and NFC-gated entry</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={() => setShowBorrow(true)}>
            <BookOpen size={15} /> Record Borrow
          </button>
          <button className="btn btn-primary" onClick={() => setShowRegister(true)} id="register-member-btn">
            <Plus size={15} /> Register Member
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Members', value: stats.total, color: '#2563eb' },
          { label: 'Active Members', value: stats.active, color: '#10b981' },
          { label: 'Items On Loan', value: stats.borrowed, color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="glass-panel" style={{ textAlign: 'center', padding: '1.2rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['members', 'transactions'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`}
            style={{ textTransform: 'capitalize' }}>
            {t === 'members' ? <Users size={14} /> : <RefreshCw size={14} />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="input" placeholder="Search members..." value={search}
                onChange={e => setSearch(e.target.value)} style={{ paddingLeft: '2.2rem', width: '220px' }} />
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Student', 'Reg No', 'Status', 'Expires', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{m.student_name}</td>
                  <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{m.reg_no}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem',
                                   color: m.status === 'Active' ? 'var(--success)' : 'var(--danger)',
                                   background: m.status === 'Active' ? 'var(--success-bg)' : 'var(--danger-bg)' }}>
                      {m.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{m.expiry_date || '—'}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {m.status === 'Active'
                      ? <button className="btn btn-outline" onClick={() => updateStatus(m.student_uid, 'Suspended')}
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}>Suspend</button>
                      : <button className="btn btn-outline" onClick={() => updateStatus(m.student_uid, 'Active')}
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem' }}>Activate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions Tab */}
      {tab === 'transactions' && (
        <div className="glass-panel">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Student', 'Item', 'Action', 'Date', 'Due', 'Returned', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 50).map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.7rem 0.5rem', fontSize: '0.9rem' }}>{t.student_name}</td>
                  <td style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem' }}>{t.item_name}</td>
                  <td style={{ padding: '0.7rem 0.5rem' }}>
                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem',
                                   color: t.action === 'Borrow' ? '#f59e0b' : 'var(--success)',
                                   background: t.action === 'Borrow' ? 'rgba(245,158,11,0.15)' : 'var(--success-bg)' }}>
                      {t.action}
                    </span>
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date(t.timestamp).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem', fontSize: '0.8rem', color: t.due_date && !t.returned_at ? 'var(--warning)' : 'var(--text-muted)' }}>
                    {t.due_date || '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {t.returned_at ? new Date(t.returned_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ padding: '0.7rem 0.5rem' }}>
                    {t.action === 'Borrow' && !t.returned_at && (
                      <button className="btn btn-outline" onClick={() => recordReturn(t.id)}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}>Return</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Register Member Modal */}
      {showRegister && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Register Library Member</h2>
              <button className="btn btn-outline" onClick={() => setShowRegister(false)} style={{ padding: '0.4rem' }}><X size={16} /></button>
            </div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Select Student</label>
            <select className="input" style={{ width: '100%', marginBottom: '1rem' }} value={regUid}
              onChange={e => { setRegUid(e.target.value); setRegError(''); }}>
              <option value="">-- Select Student --</option>
              {students.filter(s => !members.find(m => m.student_uid === s.uid)).map(s => (
                <option key={s.uid} value={s.uid}>{s.name} ({s.reg_no})</option>
              ))}
            </select>
            {regError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{regError}</p>}
            <button className="btn btn-primary" onClick={registerMember} style={{ width: '100%' }}>
              <Save size={15} /> Register
            </button>
          </div>
        </div>
      )}

      {/* Borrow Modal */}
      {showBorrow && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Record Borrowing</h2>
              <button className="btn btn-outline" onClick={() => setShowBorrow(false)} style={{ padding: '0.4rem' }}><X size={16} /></button>
            </div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Student</label>
            <select className="input" style={{ width: '100%', marginBottom: '1rem' }} value={borrowForm.student_uid}
              onChange={e => setBorrowForm(p => ({ ...p, student_uid: e.target.value }))}>
              <option value="">-- Select Student --</option>
              {members.filter(m => m.status === 'Active').map(m => (
                <option key={m.student_uid} value={m.student_uid}>{m.student_name} ({m.reg_no})</option>
              ))}
            </select>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Item Name</label>
            <input className="input" style={{ width: '100%', marginBottom: '1rem' }}
              placeholder="Book / Journal title" value={borrowForm.item_name}
              onChange={e => setBorrowForm(p => ({ ...p, item_name: e.target.value }))} />
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ISBN (optional)</label>
            <input className="input" style={{ width: '100%', marginBottom: '1.5rem' }}
              placeholder="978-..." value={borrowForm.isbn}
              onChange={e => setBorrowForm(p => ({ ...p, isbn: e.target.value }))} />
            <button className="btn btn-primary" onClick={recordBorrow} style={{ width: '100%' }}>
              <Save size={15} /> Record Borrow
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LibraryDashboard;
