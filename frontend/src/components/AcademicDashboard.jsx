import React, { useState, useEffect } from 'react';
import { Layers, Calendar, Shield, Clock, MapPin, User, ChevronRight, Plus, Edit2, Trash2, X, Save, Users } from 'lucide-react';

const API = 'http://localhost:5000';

const AcademicDashboard = () => {
  const [activeTab, setActiveTab] = useState('schedules');
  
  const [structure, setStructure] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [venues, setVenues] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Enrollment tab state
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [enrollments, setEnrollments] = useState([]);
  const [enrollUnitInfo, setEnrollUnitInfo] = useState(null);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [enrollRegNo, setEnrollRegNo] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [enrollSuccess, setEnrollSuccess] = useState('');
  const [bulkRegNos, setBulkRegNos] = useState('');
  const [bulkResult, setBulkResult] = useState(null);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const [scheduleFormData, setScheduleFormData] = useState({
    unit_id: '', lecturer_id: '', venue_id: '', day_of_week: 'Monday', start_time: '08:00', end_time: '10:00', semester: 'Sem 1'
  });
  const [formError, setFormError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [structRes, schedRes, auditRes, lecRes, venRes, unitRes] = await Promise.all([
        fetch('http://localhost:5000/api/academic/structure'),
        fetch('http://localhost:5000/api/academic/schedules'),
        fetch('http://localhost:5000/api/admin/audit'),
        fetch('http://localhost:5000/api/academic/lecturers'),
        fetch('http://localhost:5000/api/academic/venues'),
        fetch('http://localhost:5000/api/academic/units')
      ]);
      
      const structData = await structRes.json();
      const schedData = await schedRes.json();
      const auditData = await auditRes.json();
      const lecData = await lecRes.json();
      const venData = await venRes.json();
      const unitData = await unitRes.json();
      
      setStructure(structData.structure || []);
      setSchedules(schedData.schedules || []);
      setAuditLogs(auditData.logs || []);
      setLecturers(lecData.lecturers || []);
      setVenues(venData.venues || []);
      setUnits(unitData.units || []);
    } catch (e) {
      console.error("Failed to load academic data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenScheduleModal = (schedule = null) => {
    setFormError('');
    if (schedule) {
      setCurrentSchedule(schedule);
      setScheduleFormData({
        unit_id: schedule.unit_id || '',
        lecturer_id: schedule.lecturer_id || '',
        venue_id: schedule.venue_id || '',
        day_of_week: schedule.day || 'Monday',
        start_time: schedule.start_time || '08:00',
        end_time: schedule.end_time || '10:00',
        semester: schedule.semester || 'Sem 1'
      });
    } else {
      setCurrentSchedule(null);
      setScheduleFormData({
        unit_id: units.length > 0 ? units[0].id : '',
        lecturer_id: lecturers.length > 0 ? lecturers[0].id : '',
        venue_id: venues.length > 0 ? venues[0].id : '',
        day_of_week: 'Monday',
        start_time: '08:00',
        end_time: '10:00',
        semester: 'Sem 1'
      });
    }
    setIsScheduleModalOpen(true);
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!scheduleFormData.unit_id || !scheduleFormData.lecturer_id || !scheduleFormData.venue_id) {
      setFormError('Please select a unit, lecturer, and venue.');
      return;
    }

    const url = currentSchedule 
      ? `http://localhost:5000/api/academic/schedules/${currentSchedule.id}`
      : 'http://localhost:5000/api/academic/schedules';
    const method = currentSchedule ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scheduleFormData)
      });
      if (res.ok) {
        setIsScheduleModalOpen(false);
        fetchData();
      } else {
        const data = await res.json();
        setFormError(data.error || 'Failed to save schedule');
      }
    } catch (e) {
      setFormError('Failed to connect to the server');
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      try {
        await fetch(`http://localhost:5000/api/academic/schedules/${id}`, { method: 'DELETE' });
        fetchData();
      } catch (e) { console.error(e); }
    }
  };

  const fetchEnrollments = async (unitId) => {
    if (!unitId) return;
    setEnrollLoading(true);
    setEnrollError('');
    try {
      const res = await fetch(`${API}/api/academic/units/${unitId}/enrollments`);
      const data = await res.json();
      setEnrollments(data.enrollments || []);
      setEnrollUnitInfo(data.unit);
    } catch { setEnrollError('Failed to load enrollments'); }
    finally { setEnrollLoading(false); }
  };

  const handleEnrollSingle = async () => {
    if (!enrollRegNo.trim() || !selectedUnitId) return;
    setEnrollError(''); setEnrollSuccess('');
    const res = await fetch(`${API}/api/academic/units/${selectedUnitId}/enroll`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reg_no: enrollRegNo.trim() })
    });
    const data = await res.json();
    if (res.ok) { setEnrollSuccess('Student enrolled!'); setEnrollRegNo(''); fetchEnrollments(selectedUnitId); }
    else setEnrollError(data.error || 'Enrollment failed');
  };

  const handleUnenroll = async (student_uid) => {
    if (!window.confirm('Remove this student from the unit?')) return;
    await fetch(`${API}/api/academic/units/${selectedUnitId}/enroll/${student_uid}`, { method: 'DELETE' });
    fetchEnrollments(selectedUnitId);
  };

  const handleBulkEnroll = async () => {
    const reg_numbers = bulkRegNos.split('\n').map(s => s.trim()).filter(Boolean);
    if (!reg_numbers.length || !selectedUnitId) return;
    const res = await fetch(`${API}/api/academic/units/${selectedUnitId}/enroll/bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reg_numbers })
    });
    const data = await res.json();
    setBulkResult(data);
    setBulkRegNos('');
    fetchEnrollments(selectedUnitId);
  };

  const TabButton = ({ id, icon: Icon, label }) => (
    <button 
      className={`btn ${activeTab === id ? 'btn-primary' : 'btn-outline'}`}
      onClick={() => setActiveTab(id)}
      style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="gradient-text">Academic Administration</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <TabButton id="schedules" icon={Calendar} label="Class Schedules" />
          <TabButton id="structure" icon={Layers} label="Academic Structure" />
          <TabButton id="enrollments" icon={Users} label="Enrollments" />
          <TabButton id="audit" icon={Shield} label="System Audit Trail" />
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading academic data...</div>
      ) : (
        <div className="glass-panel">
          
          {/* STRUCTURE TAB */}
          {activeTab === 'structure' && (
            <div>
              <h2 style={{ marginBottom: '1.5rem' }}>Schools & Departments</h2>
              {structure.map(school => (
                <div key={school.id} style={{ marginBottom: '2rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ color: 'var(--color-primary-light)', marginBottom: '1rem' }}>{school.name}</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {school.departments.map(dept => (
                      <div key={dept.id} style={{ background: 'var(--bg-app)', padding: '1.5rem', borderRadius: '8px' }}>
                        <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ChevronRight size={16} /> {dept.name}</h4>
                        
                        <div style={{ marginBottom: '1rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Programmes</span>
                          <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0' }}>
                            {dept.programmes.map(p => (
                              <li key={p.id} style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>• {p.name}</li>
                            ))}
                          </ul>
                        </div>
                        
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Offered Units</span>
                          <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0' }}>
                            {dept.units.map(u => (
                              <li key={u.id} style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                                <code style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px', marginRight: '0.5rem' }}>{u.code}</code>
                                {u.name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SCHEDULES TAB */}
          {activeTab === 'schedules' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>Active Class Schedules</h2>
                <button className="btn btn-primary" onClick={() => handleOpenScheduleModal()}><Plus size={16}/> Create Schedule</button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem' }}>
                {schedules.map(schedule => (
                  <div key={schedule.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.5rem', position: 'relative' }}>
                    
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handleOpenScheduleModal(schedule)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Edit2 size={16} /></button>
                      <button onClick={() => handleDeleteSchedule(schedule.id)} style={{ background: 'none', border: 'none', color: 'var(--warning)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </div>

                    <h3 style={{ marginBottom: '1rem', color: 'var(--color-primary-light)', paddingRight: '3rem' }}>{schedule.unit}</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                        <User size={16} /> <span>{schedule.lecturer}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                        <MapPin size={16} /> <span>{schedule.venue}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
                        <Clock size={16} /> <span>{schedule.day} • {schedule.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AUDIT LOG TAB */}
          {activeTab === 'audit' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0 }}>System Audit Trail</h2>
                <button className="btn btn-outline" onClick={() => fetch('http://localhost:5000/api/admin/audit').then(r=>r.json()).then(d=>setAuditLogs(d.logs))}>Refresh Logs</button>
              </div>
              
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>No audit logs found. Try tapping an NFC card!</td></tr>
                    ) : (
                      auditLogs.map(log => {
                        const parsedDetails = JSON.parse(log.details || '{}');
                        return (
                          <tr key={log.id}>
                            <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                              {new Date(log.timestamp).toLocaleString()}
                            </td>
                            <td>
                              <span className={`badge ${log.action.includes('Rejected') ? 'badge-danger' : 'badge-success'}`}>
                                {log.action}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                {Object.entries(parsedDetails).map(([key, value]) => (
                                  <span key={key} style={{ fontSize: '0.85rem' }}>
                                    <strong style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key}:</strong> {value}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {isScheduleModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2>{currentSchedule ? 'Edit Class Schedule' : 'Create Class Schedule'}</h2>
              <button className="btn btn-outline" onClick={() => setIsScheduleModalOpen(false)} style={{ padding: '0.5rem' }}><X size={16} /></button>
            </div>
            
            {formError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--warning)', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
                {formError}
              </div>
            )}
            
            <form onSubmit={handleScheduleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Unit</label>
                <select 
                  value={scheduleFormData.unit_id} 
                  onChange={e => setScheduleFormData({...scheduleFormData, unit_id: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }}
                >
                  <option value="">Select a Unit</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Lecturer</label>
                <select 
                  value={scheduleFormData.lecturer_id} 
                  onChange={e => setScheduleFormData({...scheduleFormData, lecturer_id: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }}
                >
                  <option value="">Select a Lecturer</option>
                  {lecturers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Venue</label>
                <select 
                  value={scheduleFormData.venue_id} 
                  onChange={e => setScheduleFormData({...scheduleFormData, venue_id: e.target.value})}
                  style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }}
                >
                  <option value="">Select a Venue</option>
                  {venues.map(v => <option key={v.id} value={v.id}>{v.name} ({v.capacity} capacity)</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Day</label>
                  <select 
                    value={scheduleFormData.day_of_week} 
                    onChange={e => setScheduleFormData({...scheduleFormData, day_of_week: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }}
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Semester</label>
                  <input 
                    type="text" 
                    value={scheduleFormData.semester} 
                    onChange={e => setScheduleFormData({...scheduleFormData, semester: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>Start Time</label>
                  <input 
                    type="time" 
                    value={scheduleFormData.start_time} 
                    onChange={e => setScheduleFormData({...scheduleFormData, start_time: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>End Time</label>
                  <input 
                    type="time" 
                    value={scheduleFormData.end_time} 
                    onChange={e => setScheduleFormData({...scheduleFormData, end_time: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }}
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsScheduleModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Save size={16}/> {currentSchedule ? 'Save Changes' : 'Create Schedule'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ENROLLMENTS TAB */}
      {activeTab === 'enrollments' && (
        <div style={{ padding: '1.5rem' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Unit Enrollment Management</h2>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Select Unit</label>
            <select className="input" style={{ width: '100%', maxWidth: '400px' }}
              value={selectedUnitId}
              onChange={e => { setSelectedUnitId(e.target.value); fetchEnrollments(e.target.value); setBulkResult(null); setEnrollError(''); setEnrollSuccess(''); }}>
              <option value="">-- Select a Unit --</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
            </select>
          </div>

          {selectedUnitId && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', alignItems: 'start' }}>
              {/* Left: Enrolled students */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem' }}>Enrolled Students ({enrollments.length})</h3>
                </div>
                {enrollLoading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> :
                  enrollments.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No students enrolled in this unit yet.</p>
                  ) : (
                    <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                      {enrollments.map(e => (
                        <div key={e.enrollment_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            padding: '0.65rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: '500' }}>{e.name}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{e.reg_no}</div>
                          </div>
                          <button className="btn btn-outline" onClick={() => handleUnenroll(e.student_uid)}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.3)' }}>
                            <X size={12} /> Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              {/* Right: Add students */}
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Add Students</h3>

                {/* Single */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>By Registration Number</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input className="input" style={{ flex: 1 }} placeholder="e.g. KeMU/2024/001"
                      value={enrollRegNo} onChange={e => { setEnrollRegNo(e.target.value); setEnrollError(''); setEnrollSuccess(''); }} />
                    <button className="btn btn-primary" onClick={handleEnrollSingle} disabled={!enrollRegNo.trim()}>
                      <Plus size={14} />
                    </button>
                  </div>
                  {enrollError && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginTop: '0.4rem' }}>{enrollError}</p>}
                  {enrollSuccess && <p style={{ color: 'var(--success)', fontSize: '0.82rem', marginTop: '0.4rem' }}>{enrollSuccess}</p>}
                </div>

                {/* Bulk */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Bulk Enroll (one reg per line)</label>
                  <textarea value={bulkRegNos} onChange={e => setBulkRegNos(e.target.value)}
                    placeholder={"KeMU/2024/001\nKeMU/2024/002\nKeMU/2024/003"}
                    style={{ width: '100%', height: '110px', background: 'var(--bg-input)', border: '1px solid var(--border-color)',
                             borderRadius: '8px', padding: '0.75rem', color: 'var(--text-main)', fontFamily: 'monospace',
                             fontSize: '0.82rem', resize: 'vertical' }} />
                  <button className="btn btn-outline" onClick={handleBulkEnroll} disabled={!bulkRegNos.trim()}
                    style={{ marginTop: '0.5rem', width: '100%' }}>
                    <Plus size={14} /> Bulk Enroll
                  </button>
                  {bulkResult && (
                    <div style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--success)' }}>{bulkResult.message}</span>
                      {bulkResult.not_found?.length > 0 && <span style={{ color: 'var(--warning)' }}> | Not found: {bulkResult.not_found.join(', ')}</span>}
                      {bulkResult.already_enrolled?.length > 0 && <span style={{ color: 'var(--text-muted)' }}> | Already enrolled: {bulkResult.already_enrolled.join(', ')}</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default AcademicDashboard;
