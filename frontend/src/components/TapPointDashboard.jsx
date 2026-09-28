import React, { useState, useEffect } from 'react';
import { Plus, Wifi, WifiOff, Edit2, Trash2, Save, X, Activity, Radio, Settings } from 'lucide-react';

const API = 'http://localhost:5000';

const MODE_COLORS = {
  attendance: '#2563eb',
  access:     '#7c3aed',
  exam:       '#dc2626',
  library:    '#059669',
  equipment:  '#d97706',
  event:      '#0891b2',
};

const MODE_LABELS = {
  attendance: 'Attendance',
  access:     'Access Control',
  exam:       'Exam Verification',
  library:    'Library',
  equipment:  'Equipment',
  event:      'Events',
};

const StatusBadge = ({ status }) => {
  const colors = { Online: 'var(--success)', Offline: 'var(--text-muted)', Maintenance: 'var(--warning)' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                   fontSize: '0.78rem', color: colors[status] || 'var(--text-muted)' }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%',
                     background: colors[status], display: 'inline-block',
                     boxShadow: status === 'Online' ? `0 0 8px ${colors[status]}` : 'none' }} />
      {status}
    </span>
  );
};

const TapPointDashboard = () => {
  const [tappoints, setTappoints] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ id: '', name: '', location: '', building: '', mode: 'attendance', venue_id: '', notes: '' });
  const [formError, setFormError] = useState('');

  const fetch_tappoints = async () => {
    const res = await fetch(`${API}/api/tappoints`);
    const data = await res.json();
    setTappoints(data.tappoints || []);
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/tappoints`).then(r => r.json()),
      fetch(`${API}/api/academic/venues`).then(r => r.json()),
    ]).then(([tp, v]) => {
      setTappoints(tp.tappoints || []);
      setVenues(v.venues || []);
    }).finally(() => setLoading(false));

    // Auto-refresh every 15s for Online/Offline status
    const interval = setInterval(fetch_tappoints, 15000);
    return () => clearInterval(interval);
  }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ id: '', name: '', location: '', building: '', mode: 'attendance', venue_id: '', notes: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (tp) => {
    setEditing(tp);
    setForm({ id: tp.id, name: tp.name, location: tp.location || '', building: tp.building || '',
              mode: tp.mode, venue_id: tp.venue_id || '', notes: tp.notes || '' });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.id || !form.name) { setFormError('ID and Name are required'); return; }
    const url = editing ? `${API}/api/tappoints/${editing.id}` : `${API}/api/tappoints`;
    const method = editing ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' },
                                   body: JSON.stringify(form) });
    if (res.ok) {
      setShowModal(false);
      fetch_tappoints();
    } else {
      const d = await res.json();
      setFormError(d.error || 'Failed to save');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete TapPoint ${id}?`)) return;
    await fetch(`${API}/api/tappoints/${id}`, { method: 'DELETE' });
    fetch_tappoints();
  };

  const stats = {
    total: tappoints.length,
    online: tappoints.filter(t => t.status === 'Online').length,
    offline: tappoints.filter(t => t.status === 'Offline').length,
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading TapPoints...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>TapPoint Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Register and configure NFC readers across campus</p>
        </div>
        <button className="btn btn-primary" onClick={openNew} id="add-tappoint-btn">
          <Plus size={16} /> Register TapPoint
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Devices', value: stats.total, icon: Radio, color: '#2563eb' },
          { label: 'Online', value: stats.online, icon: Wifi, color: 'var(--success)' },
          { label: 'Offline', value: stats.offline, icon: WifiOff, color: 'var(--text-muted)' },
        ].map(s => (
          <div key={s.label} className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.2rem' }}>
            <div style={{ padding: '0.75rem', borderRadius: '12px', background: `${s.color}20`, color: s.color }}>
              <s.icon size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: '700' }}>{s.value}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* TapPoint Grid */}
      {tappoints.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
          <Radio size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p>No TapPoints registered yet.</p>
          <button className="btn btn-primary" onClick={openNew} style={{ marginTop: '1rem' }}>Register First TapPoint</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {tappoints.map(tp => (
            <div key={tp.id} className="glass-panel" style={{ borderTop: `3px solid ${MODE_COLORS[tp.mode] || '#2563eb'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '1.05rem' }}>{tp.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{tp.id}</div>
                </div>
                <StatusBadge status={tp.status} />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem',
                               background: `${MODE_COLORS[tp.mode]}20`, color: MODE_COLORS[tp.mode] }}>
                  {MODE_LABELS[tp.mode]}
                </span>
                {tp.location && (
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.75rem',
                                 background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                    {tp.location}
                  </span>
                )}
              </div>

              {tp.last_seen && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Last seen: {new Date(tp.last_seen).toLocaleString()}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-outline" onClick={() => openEdit(tp)}
                  style={{ flex: 1, fontSize: '0.85rem', padding: '0.5rem' }}>
                  <Edit2 size={14} /> Edit
                </button>
                <button className="btn btn-outline" onClick={() => handleDelete(tp.id)}
                  style={{ padding: '0.5rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ESP32 Integration Note */}
      <div className="glass-panel" style={{ marginTop: '2rem', borderLeft: '3px solid #2563eb', padding: '1.25rem' }}>
        <div style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={16} color="#2563eb" /> ESP32 / Arduino Integration
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.6' }}>
          Run the bridge: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
            python arduino_terminal.py [COM_PORT] [BAUD] [TAPPOINT_ID]
          </code>
          <br />
          The ESP32 sketch should print UIDs containing 4+ hex byte pairs. The TapPoint ID links the tap to the correct mode.
          Heartbeat: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>
            POST /api/tappoints/{'{id}'}/heartbeat
          </code> every 30s to stay Online.
        </p>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '480px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>{editing ? 'Edit TapPoint' : 'Register New TapPoint'}</h2>
              <button className="btn btn-outline" onClick={() => setShowModal(false)} style={{ padding: '0.4rem' }}><X size={16} /></button>
            </div>

            {[
              { label: 'Device ID *', key: 'id', placeholder: 'e.g. LAB1-READER', disabled: !!editing },
              { label: 'Display Name *', key: 'name', placeholder: 'e.g. Computer Lab 1 Reader' },
              { label: 'Location', key: 'location', placeholder: 'e.g. Lab 1 Entrance' },
              { label: 'Building', key: 'building', placeholder: 'e.g. Computing Block' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{f.label}</label>
                <input className="input" style={{ width: '100%' }} placeholder={f.placeholder}
                  value={form[f.key]} disabled={f.disabled}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Mode</label>
              <select className="input" style={{ width: '100%' }} value={form.mode}
                onChange={e => setForm(p => ({ ...p, mode: e.target.value }))}>
                {Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Venue (optional)</label>
              <select className="input" style={{ width: '100%' }} value={form.venue_id}
                onChange={e => setForm(p => ({ ...p, venue_id: e.target.value }))}>
                <option value="">-- No specific venue --</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name} ({v.building})</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Notes</label>
              <input className="input" style={{ width: '100%' }} placeholder="Optional notes"
                value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>

            {formError && <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{formError}</div>}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }}>
                <Save size={15} /> {editing ? 'Update' : 'Register'}
              </button>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TapPointDashboard;
