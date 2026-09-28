import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Play, Users, CheckCircle, X, Save, MapPin } from 'lucide-react';

const API = 'http://localhost:5000';

const StatusBadge = ({ status }) => {
  const s = {
    Upcoming:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
    Active:    { color: 'var(--success)', bg: 'var(--success-bg)' },
    Completed: { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' },
    Cancelled: { color: 'var(--danger)', bg: 'var(--danger-bg)' },
  }[status] || { color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' };
  return (
    <span style={{ padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem',
                   fontWeight: '600', color: s.color, background: s.bg }}>{status}</span>
  );
};

const EventsDashboard = () => {
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', event_date: '', start_time: '09:00',
                                     end_time: '17:00', venue_id: '', organizer: '', capacity: '' });
  const [manualUid, setManualUid] = useState('');

  const fetchEvents = () => fetch(`${API}/api/events`).then(r => r.json()).then(d => setEvents(d.events || []));

  useEffect(() => {
    Promise.all([
      fetchEvents(),
      fetch(`${API}/api/academic/venues`).then(r => r.json()),
      fetch(`${API}/api/admin/students`).then(r => r.json()),
    ]).then(([, v, s]) => {
      setVenues(v.venues || []);
      setStudents(s.students || []);
    }).finally(() => setLoading(false));
  }, []);

  const selectEvent = async (ev) => {
    setSelected(ev);
    const data = await fetch(`${API}/api/events/${ev.id}/participants`).then(r => r.json());
    setParticipants(data.participants || []);
  };

  const createEvent = async () => {
    const res = await fetch(`${API}/api/events`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { setShowNew(false); fetchEvents(); }
  };

  const activateEvent = async (id) => {
    await fetch(`${API}/api/events/${id}/activate`, { method: 'POST' });
    fetchEvents();
    if (selected?.id === id) setSelected(p => ({ ...p, status: 'Active' }));
  };

  const completeEvent = async (id) => {
    await fetch(`${API}/api/events/${id}`, { method: 'PUT',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Completed' }) });
    fetchEvents();
  };

  const addManualParticipant = async () => {
    if (!selected || !manualUid) return;
    await fetch(`${API}/api/events/${selected.id}/participants`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_uid: manualUid }) });
    setManualUid('');
    const data = await fetch(`${API}/api/events/${selected.id}/participants`).then(r => r.json());
    setParticipants(data.participants || []);
    fetchEvents();
  };

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>;

  const totalParticipants = events.reduce((sum, e) => sum + e.participant_count, 0);
  const activeEvent = events.find(e => e.status === 'Active');

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem' }}>Events Management</h1>
          <p style={{ color: 'var(--text-muted)' }}>Schedule events and track NFC-based participation</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)} id="create-event-btn">
          <Plus size={15} /> Create Event
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[
          { label: 'Total Events', value: events.length, color: '#2563eb' },
          { label: 'Active Now', value: events.filter(e => e.status === 'Active').length, color: 'var(--success)' },
          { label: 'Total Participants', value: totalParticipants, color: '#7c3aed' },
        ].map(s => (
          <div key={s.label} className="glass-panel" style={{ textAlign: 'center', padding: '1.2rem' }}>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: '2rem' }}>
        {/* Events List */}
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {events.map(ev => (
              <div key={ev.id} className="glass-panel"
                style={{ borderLeft: `3px solid ${ev.status === 'Active' ? 'var(--success)' : ev.status === 'Completed' ? 'var(--text-muted)' : '#2563eb'}`,
                         cursor: 'pointer', transition: 'border-color 0.2s' }}
                onClick={() => selectEvent(ev)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '600' }}>{ev.name}</span>
                      <StatusBadge status={ev.status} />
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span><Calendar size={12} style={{ marginRight: '3px', verticalAlign: 'middle' }} />{ev.event_date}</span>
                      <span>{ev.start_time}{ev.end_time && ` – ${ev.end_time}`}</span>
                      <span><MapPin size={12} style={{ marginRight: '3px', verticalAlign: 'middle' }} />{ev.venue}</span>
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                      {ev.participant_count} participant{ev.participant_count !== 1 ? 's' : ''}
                      {ev.capacity && ` of ${ev.capacity}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {ev.status === 'Upcoming' && (
                      <button className="btn btn-primary" onClick={e => { e.stopPropagation(); activateEvent(ev.id); }}
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', background: 'var(--success)' }}>
                        <Play size={12} /> Start
                      </button>
                    )}
                    {ev.status === 'Active' && (
                      <button className="btn btn-outline" onClick={e => { e.stopPropagation(); completeEvent(ev.id); }}
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                        <CheckCircle size={12} /> End
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {events.length === 0 && (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                <Calendar size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <p>No events yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Participants Panel */}
        {selected && (
          <div>
            <div className="glass-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{selected.name}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{participants.length} participants</div>
                </div>
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={16} />
                </button>
              </div>

              {/* Manual Add */}
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <select className="input" style={{ flex: 1 }} value={manualUid} onChange={e => setManualUid(e.target.value)}>
                  <option value="">Add participant manually...</option>
                  {students.filter(s => !participants.find(p => p.student_uid === s.uid)).map(s => (
                    <option key={s.uid} value={s.uid}>{s.name} ({s.reg_no})</option>
                  ))}
                </select>
                <button className="btn btn-primary" onClick={addManualParticipant} disabled={!manualUid}>
                  <Plus size={14} />
                </button>
              </div>

              {/* Participants List */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {participants.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: '0.9rem' }}>
                    No participants yet. Activate the event and tap NFC cards at the Events TapPoint.
                  </p>
                ) : participants.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                           padding: '0.7rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{p.student_name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{p.reg_no}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {new Date(p.timestamp).toLocaleTimeString()}
                      </div>
                      <span style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem', borderRadius: '10px',
                                     background: p.method === 'Tap' ? 'rgba(37,99,235,0.15)' : 'rgba(255,255,255,0.06)',
                                     color: p.method === 'Tap' ? '#60a5fa' : 'var(--text-muted)' }}>
                        {p.method}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showNew && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '500px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>Create Event</h2>
              <button className="btn btn-outline" onClick={() => setShowNew(false)} style={{ padding: '0.4rem' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Event Name *</label>
                <input className="input" style={{ width: '100%' }} placeholder="e.g. KeMU Tech Expo 2026"
                  value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Description</label>
                <input className="input" style={{ width: '100%' }} placeholder="Brief description"
                  value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              {[
                { label: 'Date *', key: 'event_date', type: 'date' },
                { label: 'Start Time', key: 'start_time', type: 'time' },
                { label: 'End Time', key: 'end_time', type: 'time' },
                { label: 'Capacity', key: 'capacity', type: 'number', placeholder: 'Max attendees' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{f.label}</label>
                  <input className="input" style={{ width: '100%' }} type={f.type || 'text'}
                    placeholder={f.placeholder} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Organizer</label>
                <input className="input" style={{ width: '100%' }} placeholder="Dept / Club name"
                  value={form.organizer} onChange={e => setForm(p => ({ ...p, organizer: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Venue</label>
                <select className="input" style={{ width: '100%' }} value={form.venue_id}
                  onChange={e => setForm(p => ({ ...p, venue_id: e.target.value }))}>
                  <option value="">-- Select Venue --</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" onClick={createEvent} style={{ flex: 1 }}>
                <Save size={15} /> Create Event
              </button>
              <button className="btn btn-outline" onClick={() => setShowNew(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventsDashboard;
