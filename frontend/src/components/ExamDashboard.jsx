import React, { useState, useEffect } from 'react';
import { Plus, Play, CheckCircle, Users, ClipboardList, Upload, Search, X, ChevronDown, Save, AlertCircle } from 'lucide-react';

const API = 'http://localhost:5000';

const StatusBadge = ({ status }) => {
  const styles = {
    Scheduled: { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
    Active:    { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    Completed: { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
    Cleared:   { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    'Not Cleared': { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
    Pending:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
    Verified:  { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
    'Not on List': { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  };
  const s = styles[status] || { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' };
  return (
    <span style={{ padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem',
                   fontWeight: '600', color: s.color, background: s.bg }}>{status}</span>
  );
};

const ExamDashboard = () => {
  const [tab, setTab] = useState('exams');
  const [exams, setExams] = useState([]);
  const [units, setUnits] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [clearance, setClearance] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [showNewExam, setShowNewExam] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState({ name: '', unit_id: '', exam_date: '', start_time: '09:00', end_time: '12:00', venue_id: '', semester: 'Jan-Apr 2026' });

  const fetchExams = () => fetch(`${API}/api/exams`).then(r => r.json()).then(d => setExams(d.exams || []));

  useEffect(() => {
    Promise.all([
      fetchExams(),
      fetch(`${API}/api/academic/units`).then(r => r.json()),
      fetch(`${API}/api/academic/venues`).then(r => r.json()),
    ]).then(([, u, v]) => {
      setUnits(u.units || []);
      setVenues(v.venues || []);
    }).finally(() => setLoading(false));
  }, []);

  const selectExam = async (exam) => {
    setSelected(exam);
    setTab('clearance');
    const [c, a] = await Promise.all([
      fetch(`${API}/api/exams/${exam.id}/clearance`).then(r => r.json()),
      fetch(`${API}/api/exams/${exam.id}/attendance`).then(r => r.json()),
    ]);
    setClearance(c.clearance || []);
    setAttendance(a.records || []);
  };

  const createExam = async () => {
    const res = await fetch(`${API}/api/exams`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { setShowNewExam(false); fetchExams(); }
  };

  const activateExam = async (id) => {
    await fetch(`${API}/api/exams/${id}/activate`, { method: 'POST' });
    fetchExams();
    if (selected?.id === id) setSelected(p => ({ ...p, status: 'Active' }));
  };

  const completeExam = async (id) => {
    await fetch(`${API}/api/exams/${id}/complete`, { method: 'POST' });
    fetchExams();
    if (selected?.id === id) setSelected(p => ({ ...p, status: 'Completed' }));
  };

  const handleBulkImport = async () => {
    if (!selected) return;
    const reg_numbers = bulkText.split('\n').map(s => s.trim()).filter(Boolean);
    const res = await fetch(`${API}/api/exams/${selected.id}/clearance/bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reg_numbers, status: 'Cleared' }) });
    const data = await res.json();
    setBulkResult(data);
    setBulkText('');
    const c = await fetch(`${API}/api/exams/${selected.id}/clearance`).then(r => r.json());
    setClearance(c.clearance || []);
  };

  const filteredClearance = clearance.filter(c =>
    c.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.reg_no.toLowerCase().includes(searchTerm.toLowerCase()));

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Examination Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Schedule exams, manage clearance, and verify attendance</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNewExam(true)} id="create-exam-btn">
          <Plus size={16} /> New Exam
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        {['exams', ...(selected ? ['clearance', 'live'] : [])].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`}
            style={{ textTransform: 'capitalize', fontSize: '0.9rem' }}>
            {t === 'live' ? 'Live Verification' : t.charAt(0).toUpperCase() + t.slice(1)}
            {selected && t !== 'exams' && <span style={{ marginLeft: '0.5rem', opacity: 0.7, fontSize: '0.8rem' }}>
              — {selected.name.length > 20 ? selected.name.slice(0, 20) + '…' : selected.name}
            </span>}
          </button>
        ))}
      </div>

      {/* Exams List */}
      {tab === 'exams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {exams.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
              <ClipboardList size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p>No exams scheduled yet.</p>
            </div>
          ) : exams.map(exam => (
            <div key={exam.id} className="glass-panel"
              style={{ borderLeft: `3px solid ${exam.status === 'Active' ? 'var(--success)' : exam.status === 'Completed' ? 'var(--text-muted)' : '#2563eb'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                    <span style={{ fontWeight: '600', fontSize: '1.05rem' }}>{exam.name}</span>
                    <StatusBadge status={exam.status} />
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {exam.unit_code} • {exam.venue} • {exam.exam_date} • {exam.start_time}–{exam.end_time}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.3rem' }}>
                    {exam.cleared_count} cleared &nbsp;|&nbsp; {exam.attended_count} verified
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="btn btn-outline" onClick={() => selectExam(exam)}
                    style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}>
                    <Users size={14} /> Manage
                  </button>
                  {exam.status === 'Scheduled' && (
                    <button className="btn btn-primary" onClick={() => activateExam(exam.id)}
                      style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem', background: 'var(--success)' }}>
                      <Play size={14} /> Activate
                    </button>
                  )}
                  {exam.status === 'Active' && (
                    <button className="btn btn-outline" onClick={() => completeExam(exam.id)}
                      style={{ fontSize: '0.85rem', padding: '0.5rem 0.9rem' }}>
                      <CheckCircle size={14} /> Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Clearance Management */}
      {tab === 'clearance' && selected && (
        <div>
          {/* Bulk Import */}
          <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Upload size={16} color="#2563eb" /> Bulk Import Clearance List
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
              Paste registration numbers below (one per line):
            </p>
            <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
              placeholder={"KeMU/2024/001\nKeMU/2024/002\nKeMU/2024/003"}
              style={{ width: '100%', height: '100px', background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                       borderRadius: '8px', padding: '0.75rem', color: 'var(--text-main)', fontFamily: 'monospace',
                       fontSize: '0.85rem', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={handleBulkImport} disabled={!bulkText.trim()}>
                <Upload size={14} /> Import
              </button>
              {bulkResult && (
                <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                  {bulkResult.message}
                  {bulkResult.not_found?.length > 0 && <span style={{ color: 'var(--warning)' }}>
                    {' '}| Not found: {bulkResult.not_found.join(', ')}
                  </span>}
                </span>
              )}
            </div>
          </div>

          {/* Clearance List */}
          <div className="glass-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontWeight: '600' }}>Clearance List ({clearance.length} students)</div>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input className="input" placeholder="Search…" value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: '2.2rem', width: '200px' }} />
              </div>
            </div>
            {filteredClearance.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                {clearance.length === 0 ? 'No clearance records. Use bulk import above.' : 'No matches found.'}
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {['Name', 'Reg No', 'Status', 'Cleared By'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '500' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredClearance.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '0.7rem 0.5rem', fontSize: '0.9rem' }}>{c.student_name}</td>
                      <td style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.reg_no}</td>
                      <td style={{ padding: '0.7rem 0.5rem' }}><StatusBadge status={c.status} /></td>
                      <td style={{ padding: '0.7rem 0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.cleared_by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Live Verification Feed */}
      {tab === 'live' && selected && (
        <div className="glass-panel">
          <div style={{ fontWeight: '600', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} color="var(--success)" />
            Live Verification — {selected.name}
          </div>
          {attendance.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              No taps yet. Activate the exam and tap cards at the Exam Hall TapPoint.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['Student', 'Reg No', 'Result', 'Time'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '500' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attendance.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.7rem 0.5rem' }}>{r.student_name}</td>
                    <td style={{ padding: '0.7rem 0.5rem', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{r.reg_no}</td>
                    <td style={{ padding: '0.7rem 0.5rem' }}><StatusBadge status={r.result} /></td>
                    <td style={{ padding: '0.7rem 0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* New Exam Modal */}
      {showNewExam && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '480px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Schedule New Exam</h2>
              <button className="btn btn-outline" onClick={() => setShowNewExam(false)} style={{ padding: '0.4rem' }}><X size={16} /></button>
            </div>
            {[
              { label: 'Exam Name *', key: 'name', placeholder: 'e.g. CIS101 End Semester Exam' },
              { label: 'Exam Date *', key: 'exam_date', type: 'date' },
              { label: 'Start Time', key: 'start_time', type: 'time' },
              { label: 'End Time', key: 'end_time', type: 'time' },
              { label: 'Semester', key: 'semester', placeholder: 'e.g. Jan-Apr 2026' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{f.label}</label>
                <input className="input" style={{ width: '100%' }} type={f.type || 'text'}
                  placeholder={f.placeholder} value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Unit</label>
              <select className="input" style={{ width: '100%' }} value={form.unit_id}
                onChange={e => setForm(p => ({ ...p, unit_id: e.target.value }))}>
                <option value="">-- Select Unit --</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Venue</label>
              <select className="input" style={{ width: '100%' }} value={form.venue_id}
                onChange={e => setForm(p => ({ ...p, venue_id: e.target.value }))}>
                <option value="">-- Select Venue --</option>
                {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={createExam} style={{ flex: 1 }}>
                <Save size={15} /> Schedule Exam
              </button>
              <button className="btn btn-outline" onClick={() => setShowNewExam(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExamDashboard;
