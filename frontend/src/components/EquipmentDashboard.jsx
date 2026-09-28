import React, { useState, useEffect } from 'react';
import { Package, Plus, RotateCcw, AlertTriangle, X, Save, Settings } from 'lucide-react';

const API = 'http://localhost:5000';

const StatusBadge = ({ status }) => {
  const colors = {
    Available: { color: 'var(--success)', bg: 'var(--success-bg)' },
    Borrowed:  { color: 'var(--warning)', bg: 'var(--warning-bg)' },
    Maintenance: { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
    Lost:      { color: 'var(--danger)', bg: 'var(--danger-bg)' },
  };
  const s = colors[status] || { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' };
  return (
    <span style={{ padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem',
                   fontWeight: '600', color: s.color, background: s.bg }}>{status}</span>
  );
};

const EquipmentDashboard = () => {
  const [tab, setTab] = useState('catalogue');
  const [equipment, setEquipment] = useState([]);
  const [borrowings, setBorrowings] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showBorrow, setShowBorrow] = useState(false);
  const [selectedEq, setSelectedEq] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', serial_no: '', description: '' });
  const [borrowForm, setBorrowForm] = useState({ student_uid: '', days: 3 });
  const [formError, setFormError] = useState('');

  const fetchAll = () => Promise.all([
    fetch(`${API}/api/equipment`).then(r => r.json()),
    fetch(`${API}/api/equipment/borrowings`).then(r => r.json()),
    fetch(`${API}/api/admin/students`).then(r => r.json()),
  ]).then(([e, b, s]) => {
    setEquipment(e.equipment || []);
    setBorrowings(b.borrowings || []);
    setStudents(s.students || []);
  }).finally(() => setLoading(false));

  useEffect(() => { fetchAll(); }, []);

  const addEquipment = async () => {
    if (!form.name) { setFormError('Name is required'); return; }
    const res = await fetch(`${API}/api/equipment`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { setShowAdd(false); setForm({ name: '', category: '', serial_no: '', description: '' }); fetchAll(); }
    else { const d = await res.json(); setFormError(d.error); }
  };

  const borrowEquipment = async () => {
    if (!borrowForm.student_uid) { setFormError('Select a student'); return; }
    const res = await fetch(`${API}/api/equipment/${selectedEq.id}/borrow`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(borrowForm) });
    if (res.ok) { setShowBorrow(false); fetchAll(); }
    else { const d = await res.json(); setFormError(d.error); }
  };

  const returnEquipment = async (borrowingId) => {
    await fetch(`${API}/api/equipment/borrowings/${borrowingId}/return`, { method: 'POST' });
    fetchAll();
  };

  const updateStatus = async (id, status) => {
    await fetch(`${API}/api/equipment/${id}`, { method: 'PUT',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    fetchAll();
  };

  const stats = {
    total: equipment.length,
    available: equipment.filter(e => e.status === 'Available').length,
    borrowed: equipment.filter(e => e.status === 'Borrowed').length,
    maintenance: equipment.filter(e => e.status === 'Maintenance').length,
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Equipment Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track equipment borrowing, returns, and maintenance</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowAdd(true); setFormError(''); }} id="add-equipment-btn">
          <Plus size={15} /> Add Equipment
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Items', value: stats.total, color: '#2563eb' },
          { label: 'Available', value: stats.available, color: 'var(--success)' },
          { label: 'On Loan', value: stats.borrowed, color: 'var(--warning)' },
          { label: 'Maintenance', value: stats.maintenance, color: '#60a5fa' },
        ].map(s => (
          <div key={s.label} className="glass-panel" style={{ textAlign: 'center', padding: '1.2rem' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['catalogue', 'borrowings'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`}
            style={{ textTransform: 'capitalize' }}>
            {t === 'catalogue' ? <Package size={14} /> : <RotateCcw size={14} />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Catalogue */}
      {tab === 'catalogue' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.25rem' }}>
          {equipment.map(eq => (
            <div key={eq.id} className="glass-panel"
              style={{ borderTop: `3px solid ${eq.status === 'Available' ? 'var(--success)' : eq.status === 'Borrowed' ? 'var(--warning)' : '#60a5fa'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{eq.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{eq.category}</div>
                </div>
                <StatusBadge status={eq.status} />
              </div>
              {eq.serial_no && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '0.75rem' }}>
                  S/N: {eq.serial_no}
                </div>
              )}
              {eq.current_borrower && (
                <div style={{ background: 'var(--warning-bg)', borderRadius: '8px', padding: '0.6rem', fontSize: '0.82rem', marginBottom: '0.75rem', color: 'var(--warning)' }}>
                  Borrowed by: {eq.current_borrower.name} | Due: {eq.current_borrower.due || 'N/A'}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {eq.status === 'Available' && (
                  <button className="btn btn-primary" onClick={() => { setSelectedEq(eq); setBorrowForm({ student_uid: '', days: 3 }); setFormError(''); setShowBorrow(true); }}
                    style={{ flex: 1, fontSize: '0.82rem', padding: '0.5rem' }}>
                    <Package size={13} /> Lend Out
                  </button>
                )}
                {eq.status !== 'Maintenance' && (
                  <button className="btn btn-outline" onClick={() => updateStatus(eq.id, eq.status === 'Maintenance' ? 'Available' : 'Maintenance')}
                    style={{ fontSize: '0.82rem', padding: '0.5rem' }}>
                    <Settings size={13} />
                  </button>
                )}
                {eq.status === 'Maintenance' && (
                  <button className="btn btn-outline" onClick={() => updateStatus(eq.id, 'Available')}
                    style={{ fontSize: '0.82rem', padding: '0.5rem' }}>
                    Mark Available
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Borrowings */}
      {tab === 'borrowings' && (
        <div className="glass-panel">
          {borrowings.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No active borrowings</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Equipment', 'Borrower', 'Borrowed', 'Due Date', 'Status', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {borrowings.map(b => {
                  const isOverdue = b.expected_return && new Date(b.expected_return) < new Date();
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{b.equipment_name}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontSize: '0.9rem' }}>{b.student_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{b.reg_no}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {new Date(b.borrowed_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.85rem', color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {b.expected_return || '—'}
                        {isOverdue && <AlertTriangle size={12} style={{ marginLeft: '4px' }} />}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <StatusBadge status={isOverdue ? 'Lost' : b.status} />
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <button className="btn btn-outline" onClick={() => returnEquipment(b.id)}
                          style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>
                          <RotateCcw size={12} /> Return
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Equipment Modal */}
      {showAdd && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '420px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Add Equipment</h2>
              <button className="btn btn-outline" onClick={() => setShowAdd(false)} style={{ padding: '0.4rem' }}><X size={16} /></button>
            </div>
            {[
              { label: 'Name *', key: 'name', placeholder: 'e.g. Canon EOS Camera' },
              { label: 'Category', key: 'category', placeholder: 'e.g. Camera, Laptop, Lab Equipment' },
              { label: 'Serial Number', key: 'serial_no', placeholder: 'e.g. CAM-001' },
              { label: 'Description', key: 'description', placeholder: 'Optional' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{f.label}</label>
                <input className="input" style={{ width: '100%' }} placeholder={f.placeholder}
                  value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            {formError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{formError}</p>}
            <button className="btn btn-primary" onClick={addEquipment} style={{ width: '100%' }}>
              <Save size={15} /> Add to Catalogue
            </button>
          </div>
        </div>
      )}

      {/* Borrow Modal */}
      {showBorrow && selectedEq && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '400px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Lend: {selectedEq.name}</h2>
              <button className="btn btn-outline" onClick={() => setShowBorrow(false)} style={{ padding: '0.4rem' }}><X size={16} /></button>
            </div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Student *</label>
            <select className="input" style={{ width: '100%', marginBottom: '1rem' }}
              value={borrowForm.student_uid} onChange={e => setBorrowForm(p => ({ ...p, student_uid: e.target.value }))}>
              <option value="">-- Select Student --</option>
              {students.map(s => <option key={s.uid} value={s.uid}>{s.name} ({s.reg_no})</option>)}
            </select>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Loan Duration (days)</label>
            <input type="number" className="input" style={{ width: '100%', marginBottom: '1.5rem' }}
              min="1" max="30" value={borrowForm.days}
              onChange={e => setBorrowForm(p => ({ ...p, days: parseInt(e.target.value) || 3 }))} />
            {formError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{formError}</p>}
            <button className="btn btn-primary" onClick={borrowEquipment} style={{ width: '100%' }}>
              <Save size={15} /> Confirm Lending
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentDashboard;
