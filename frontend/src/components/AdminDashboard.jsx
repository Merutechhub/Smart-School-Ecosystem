import React, { useState, useEffect } from 'react';
import { Search, Plus, CreditCard, Edit2, X, Save, User as UserIcon, Camera, Eye, Power, PowerOff, IdCard, Download, FileText, Users, UserCheck, UserX, ChevronDown, ChevronUp } from 'lucide-react';
import IDCard from './IDCard';
import jsPDF from 'jspdf';
import 'jspdf-autotable';


const AdminDashboard = () => {
  const [students, setStudents] = useState([]);
  const [schools, setSchools] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isIDCardModalOpen, setIsIDCardModalOpen] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null);
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcError, setNfcError] = useState('');
  const [lastTapTimestamp, setLastTapTimestamp] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '', reg_no: '', email: '', school_id: '', programme_id: '', year_of_study: 1, status: 'Active', avatar: '', nfc_card_uid: ''
  });
  const [formError, setFormError] = useState('');

  const fetchStudents = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/admin/students');
      const data = await res.json();
      setStudents(data.students || []);
    } catch (e) { console.error(e); }
  };

  const fetchAcademicStructure = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/academic/structure');
      const data = await res.json();
      setSchools(data.structure || []);
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    Promise.all([fetchStudents(), fetchAcademicStructure()]).then(() => setLoading(false));
  }, []);

  useEffect(() => {
    let interval;
    if (isModalOpen && nfcScanning) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:5000/api/latest_tap');
          if (res.ok || res.status === 404 || res.status === 400 || res.status === 403 || res.status === 409) {
            const data = await res.json();
            if (data.uid && data.timestamp !== lastTapTimestamp) {
              setLastTapTimestamp(data.timestamp);
              
              if (data.message === "Card not registered" || data.message === "No student assigned to this card") {
                setFormData(prev => ({ ...prev, nfc_card_uid: data.uid }));
                setNfcError('✅ New card detected and ready to link!');
                setTimeout(() => setNfcError(''), 3000);
              } else if (data.student) {
                if (currentStudent && currentStudent.reg_no === data.student.reg_no) {
                  setFormData(prev => ({ ...prev, nfc_card_uid: data.uid }));
                  setNfcError('✅ Card successfully verified for this student!');
                  setTimeout(() => setNfcError(''), 3000);
                } else {
                  setNfcError(`⚠️ Cannot link: Card already belongs to ${data.student.name} (${data.student.reg_no})`);
                  // Don't auto-fill the UID since it belongs to someone else
                }
              } else {
                setNfcError(`⚠️ Cannot use this card: ${data.message}`);
              }
            }
          }
        } catch (e) {
          // ignore network errors on poll
        }
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isModalOpen, nfcScanning, lastTapTimestamp, currentStudent]);

  const toggleNFCScanning = () => {
    setNfcScanning(!nfcScanning);
    setNfcError('');
  };

  const handleOpenModal = (student = null) => {
    setFormError('');
    setNfcError('');
    if (student) {
      setCurrentStudent(student);
      
      // Find which school this student's programme belongs to
      let schoolId = '';
      for (const school of schools) {
        for (const dept of school.departments) {
          if (dept.programmes.some(p => p.id === student.programme_id)) {
            schoolId = school.id;
            break;
          }
        }
        if (schoolId) break;
      }

      setFormData({
        name: student.name,
        reg_no: student.reg_no,
        email: student.email || '',
        school_id: schoolId,
        programme_id: student.programme_id || '',
        year_of_study: student.year_of_study || 1,
        status: student.status,
        avatar: student.avatar || '',
        nfc_card_uid: student.card_uid || ''
      });
      setIsModalOpen(true);
    } else {
      setCurrentStudent(null);
      setFormData({ name: '', reg_no: '', email: '', school_id: schools.length > 0 ? schools[0].id : '', programme_id: '', year_of_study: 1, status: 'Active', avatar: '', nfc_card_uid: '' });
      setIsModalOpen(true);
      // Auto-start scanning on new student creation
      setNfcScanning(true);
      setLastTapTimestamp(Date.now() / 1000); // Start looking for taps from *now*
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, avatar: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    
    if (!formData.name || !formData.reg_no) {
      setFormError('Name and Registration Number are required.');
      return;
    }

    const url = currentStudent 
      ? `http://localhost:5000/api/admin/students/${currentStudent.uid}`
      : 'http://localhost:5000/api/admin/students';
      
    const method = currentStudent ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (!res.ok) {
        setFormError(data.error || 'An error occurred.');
        return;
      }
      
      setIsModalOpen(false);
      fetchStudents();
    } catch (e) {
      setFormError('Failed to connect to the server.');
    }
  };

  const handleToggleStatus = async (student) => {
    const newStatus = student.status === 'Active' ? 'Inactive' : 'Active';
    const actionText = newStatus === 'Active' ? 'activate' : 'deactivate';
    
    if (window.confirm(`Are you sure you want to ${actionText} this student?`)) {
      try {
        await fetch(`http://localhost:5000/api/admin/students/${student.uid}`, { 
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus })
        });
        fetchStudents();
      } catch (e) { console.error(e); }
    }
  };

  const handleViewProfile = async (student) => {
    try {
      const res = await fetch(`http://localhost:5000/api/student/${student.uid}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentStudent(data);
        setIsViewModalOpen(true);
      }
    } catch(e) { console.error(e); }
  };

  const handleViewIDCard = async (student) => {
    try {
      // Fetch full profile first if needed, or just use what we have in the row
      const res = await fetch(`http://localhost:5000/api/student/${student.uid}`);
      if (res.ok) {
        const data = await res.json();
        setCurrentStudent(data);
        setIsIDCardModalOpen(true);
      }
    } catch(e) { console.error(e); }
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.reg_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.card_uid && s.card_uid.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Get available programmes based on selected school
  let availableProgrammes = [];
  if (formData.school_id) {
    const selectedSchool = schools.find(s => s.id.toString() === formData.school_id.toString());
    if (selectedSchool) {
      selectedSchool.departments.forEach(dept => {
        availableProgrammes = [...availableProgrammes, ...dept.programmes];
      });
    }
  }

  // ─── Session Export State ───────────────────────────────────────────────────
  const [showSessionExport, setShowSessionExport] = useState(false);
  const [completedSessions, setCompletedSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [sessionDataLoading, setSessionDataLoading] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');

  const fetchCompletedSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/sessions/completed');
      const data = await res.json();
      setCompletedSessions(data.sessions || []);
    } catch (e) { console.error(e); }
    finally { setSessionsLoading(false); }
  };

  const openSessionModal = async (id) => {
    setSelectedSessionId(id);
    setSessionDataLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/sessions/${id}/attendance`);
      const data = await res.json();
      setSessionData(data);
    } catch (e) { console.error(e); }
    finally { setSessionDataLoading(false); }
  };

  const exportSessionCSV = (id) => window.open(`http://localhost:5000/api/sessions/${id}/attendance?format=csv`, '_blank');

  const exportSessionPDF = () => {
    if (!sessionData) return;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text('Attendance Report', 14, 20);
    doc.setFontSize(12);
    doc.text(`Unit: ${sessionData.unit_code} — ${sessionData.unit_name}`, 14, 30);
    doc.text(`Lecturer: ${sessionData.lecturer}`, 14, 37);
    doc.text(`Date: ${new Date(sessionData.date).toLocaleDateString()}  |  Venue: ${sessionData.venue}`, 14, 44);
    doc.text(`Present: ${sessionData.present_count} / ${sessionData.total_enrolled}`, 14, 51);
    doc.autoTable({
      startY: 60,
      head: [['Reg No', 'Name', 'Year', 'Status', 'Tap Time']],
      body: sessionData.students.map(s => [s.reg_no, s.name, s.year_of_study, s.status, s.tap_time]),
      theme: 'grid', headStyles: { fillColor: [37, 99, 235] },
      didParseCell: (hd) => {
        if (hd.section === 'body' && hd.column.index === 3) {
          hd.cell.styles.textColor = hd.cell.raw === 'Present' ? [16, 185, 129] : [239, 68, 68];
          hd.cell.styles.fontStyle = 'bold';
        }
      }
    });
    doc.save(`Attendance_${sessionData.unit_code}_${sessionData.date}.pdf`);
  };

  const filteredSessions = completedSessions.filter(s =>
    s.unit_code.toLowerCase().includes(sessionSearch.toLowerCase()) ||
    s.unit_name.toLowerCase().includes(sessionSearch.toLowerCase()) ||
    s.lecturer.toLowerCase().includes(sessionSearch.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="gradient-text">Records Administration</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={() => { setShowSessionExport(!showSessionExport); if (!showSessionExport) fetchCompletedSessions(); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={16}/> Session Export {showSessionExport ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}><Plus size={16}/> Register New Student</button>
        </div>
      </div>

      {/* SESSION EXPORT PANEL */}
      {showSessionExport && (
        <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Completed Class Sessions</h3>
            <input
              className="input"
              placeholder="Search unit, lecturer..."
              value={sessionSearch}
              onChange={e => setSessionSearch(e.target.value)}
              style={{ width: '240px', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
            />
          </div>
          {sessionsLoading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>Loading sessions…</p>
          ) : filteredSessions.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem' }}>No completed sessions found.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr><th>Date</th><th>Unit</th><th>Lecturer</th><th>Venue</th><th>Attendance</th><th style={{ textAlign: 'center' }}>Export</th></tr>
                </thead>
                <tbody>
                  {filteredSessions.map(sess => (
                    <tr key={sess.session_id}>
                      <td>{new Date(sess.date).toLocaleDateString()}</td>
                      <td><strong>{sess.unit_code}</strong><br/><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sess.unit_name}</span></td>
                      <td>{sess.lecturer}</td>
                      <td>{sess.venue}</td>
                      <td>
                        <span className={`badge ${sess.attendance_pct >= 75 ? 'badge-success' : sess.attendance_pct >= 50 ? 'badge-warning' : 'badge-danger'}`}>{sess.attendance_pct}%</span>
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sess.present}/{sess.enrolled}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                          <button className="btn btn-outline" style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => openSessionModal(sess.session_id)}>
                            <Download size={12}/> PDF
                          </button>
                          <button className="btn btn-outline" style={{ padding: '0.25rem 0.6rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => exportSessionCSV(sess.session_id)}>
                            <FileText size={12}/> CSV
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="glass-panel" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={20} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search students by name, reg no, or card UID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white' }}
            />
          </div>
          <button className="btn btn-outline" disabled><CreditCard size={16}/> Bulk Manage NFC</button>
        </div>

        {loading ? (
           <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading records...</div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Registration No.</th>
                  <th>Student Name</th>
                  <th>Programme</th>
                  <th>NFC Card UID</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(student => (
                  <tr key={student.uid}>
                    <td style={{ cursor: 'pointer', color: 'var(--color-primary-light)' }} onClick={() => handleViewProfile(student)}>
                      {student.reg_no}
                    </td>
                    <td>{student.name}</td>
                    <td>{student.programme}</td>
                    <td>
                      {student.card_uid ? (
                        <code style={{ background: 'var(--bg-app)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>{student.card_uid}</code>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Not Assigned</span>
                      )}
                    </td>
                    <td>
                      {student.status === 'Active' ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-danger">{student.status}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }} onClick={() => handleViewProfile(student)}>
                          <Eye size={14}/> View
                        </button>
                        <button className="btn btn-primary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--color-primary-light)' }} onClick={() => handleViewIDCard(student)}>
                          <IdCard size={14}/> Generate ID
                        </button>
                        <button 
                          className="btn btn-outline" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', color: student.status === 'Active' ? 'var(--warning)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem', borderColor: student.status === 'Active' ? 'var(--warning)' : 'var(--success)' }} 
                          onClick={() => handleToggleStatus(student)}
                        >
                          {student.status === 'Active' ? (
                            <><PowerOff size={14}/> Deactivate</>
                          ) : (
                            <><Power size={14}/> Activate</>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No students found matching your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '2rem', position: 'relative', margin: '2rem' }}>
            <button 
              onClick={() => setIsModalOpen(false)} 
              style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1.5rem' }}>{currentStudent ? 'Edit Student Record' : 'Register New Student'}</h2>
            
            {formError && <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '1rem' }}>{formError}</div>}
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Avatar Upload */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--bg-input)', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                  {formData.avatar ? (
                    <img src={formData.avatar} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Camera size={24} color="var(--text-muted)" />
                  )}
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>Student Photo</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click the circle to upload a passport photo (Base64).</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Full Name</label>
                  <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }} required />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Registration Number</label>
                  <input type="text" value={formData.reg_no} onChange={e => setFormData({...formData, reg_no: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }} required />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Email Address</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-primary-light)' }}>KeMU School</label>
                  <select value={formData.school_id} onChange={e => setFormData({...formData, school_id: e.target.value, programme_id: ''})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }}>
                    <option value="">Select a School...</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--color-primary-light)' }}>Academic Programme</label>
                  <select value={formData.programme_id} onChange={e => setFormData({...formData, programme_id: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }} disabled={!formData.school_id}>
                    <option value="">Select a Programme...</option>
                    {availableProgrammes.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Year of Study</label>
                  <input type="number" min="1" max="6" value={formData.year_of_study} onChange={e => setFormData({...formData, year_of_study: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white' }}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div style={{ background: 'rgba(37, 99, 235, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-primary)', marginTop: '0.5rem' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                   <label style={{ display: 'block', color: 'var(--color-primary-light)', margin: 0 }}>Link NFC Card</label>
                   <button type="button" onClick={toggleNFCScanning} className={`btn ${nfcScanning ? 'btn-outline' : 'btn-primary'}`} style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem' }}>
                     {nfcScanning ? 'Stop Scanning' : 'Start Scanning'}
                   </button>
                 </div>
                 
                 {nfcError && <p style={{ color: nfcError.includes('success') ? 'var(--success)' : 'var(--warning)', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.5rem' }}>{nfcError}</p>}
                 
                 <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                   <CreditCard size={20} color={nfcScanning ? "var(--warning)" : "var(--color-primary-light)"} style={{ animation: nfcScanning ? "pulse 1.5s infinite" : "none" }} />
                   <input type="text" placeholder={nfcScanning ? "Waiting for card tap..." : "Type UID manually"} value={formData.nfc_card_uid} onChange={e => setFormData({...formData, nfc_card_uid: e.target.value})} style={{ width: '100%', padding: '0.75rem', background: 'var(--bg-app)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'white', fontFamily: 'monospace' }} />
                 </div>
                 <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>The system automatically listens for an NFC card when opened. Tap to auto-fill, or type manually as a fallback.</p>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Save size={16}/> Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW PROFILE MODAL */}
      {isViewModalOpen && currentStudent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '700px', padding: '0', position: 'relative', overflow: 'hidden', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '120px', background: 'linear-gradient(to right, var(--color-primary), var(--color-secondary))', flexShrink: 0 }}></div>
            <div style={{ position: 'absolute', right: '1.5rem', top: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleOpenModal(currentStudent);
                }} 
                className="btn btn-primary"
                style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <Edit2 size={16} /> Edit Profile
              </button>
              <button 
                onClick={() => setIsViewModalOpen(false)} 
                style={{ background: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '0.5rem', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '0 2rem 2rem 2rem', marginTop: '-50px', overflowY: 'auto' }}>
              <div style={{ width: '100px', height: '100px', background: 'var(--bg-app)', borderRadius: '50%', border: '4px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', overflow: 'hidden' }}>
                {currentStudent.avatar ? (
                   <img src={currentStudent.avatar} alt="Student Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                   <UserIcon size={50} color="var(--color-primary-light)" />
                )}
              </div>
              
              <h2 style={{ margin: '0 0 0.25rem 0' }}>{currentStudent.name}</h2>
              <p style={{ color: 'var(--color-primary-light)', fontWeight: '600', margin: '0 0 1.5rem 0' }}>{currentStudent.reg_no}</p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>Programme</p>
                  <p style={{ margin: 0, fontWeight: '500' }}>{currentStudent.programme}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>Year of Study</p>
                  <p style={{ margin: 0, fontWeight: '500' }}>Year {currentStudent.year_of_study}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>Email Address</p>
                  <p style={{ margin: 0, fontWeight: '500' }}>{currentStudent.email || 'N/A'}</p>
                </div>
                <div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>Account Status</p>
                  <span className={`badge ${currentStudent.status === 'Active' ? 'badge-success' : 'badge-danger'}`}>{currentStudent.status}</span>
                </div>
                <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 0.25rem 0' }}>NFC Card Link</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '1.1rem' }}>
                      {currentStudent.card_uid || <span style={{ color: 'var(--warning)', fontFamily: 'sans-serif', fontSize: '0.9rem' }}>No Card Linked</span>}
                    </p>
                  </div>
                </div>
              </div>

              {/* Enrolled Units Section */}
              <h3 style={{ marginBottom: '1rem' }}>Enrolled Units</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {currentStudent.units && currentStudent.units.length > 0 ? (
                  currentStudent.units.map((unit, idx) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 0.25rem 0' }}>{unit.code}</h4>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>{unit.name}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Attendance</p>
                        <span className={`badge ${unit.attendance >= 75 ? 'badge-success' : unit.attendance >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                          {unit.attendance}%
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ color: 'var(--text-muted)' }}>This student is not enrolled in any units.</p>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* GENERATE ID CARD MODAL */}
      {isIDCardModalOpen && currentStudent && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setIsIDCardModalOpen(false)} 
              style={{ position: 'absolute', right: '-40px', top: '-40px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', zIndex: 1001 }}
            >
              <X size={32} />
            </button>
            <IDCard student={currentStudent} />
          </div>
        </div>
      )}

      {/* SESSION PDF EXPORT MODAL */}
      {selectedSessionId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0 }}>Session Attendance Report</h2>
                {sessionData && <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{sessionData.unit_code} · {new Date(sessionData.date).toLocaleDateString()} · {sessionData.venue}</p>}
              </div>
              <button onClick={() => { setSelectedSessionId(null); setSessionData(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24} /></button>
            </div>
            {sessionDataLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
            ) : !sessionData || sessionData.error ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--danger)' }}>Could not load session data.</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)' }}>
                  {[
                    { label: 'Enrolled', val: sessionData.total_enrolled, color: 'var(--color-primary-light)' },
                    { label: 'Present', val: sessionData.present_count, color: 'var(--success)' },
                    { label: 'Absent', val: sessionData.total_enrolled - sessionData.present_count, color: 'var(--danger)' },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ overflowY: 'auto', flex: 1, padding: '1.5rem 2rem' }}>
                  <div className="table-container">
                    <table>
                      <thead><tr><th>Reg No</th><th>Name</th><th>Year</th><th>Status</th><th>Tap Time</th></tr></thead>
                      <tbody>
                        {sessionData.students.map((s, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 500 }}>{s.reg_no}</td>
                            <td>{s.name}</td>
                            <td>Year {s.year_of_study}</td>
                            <td><span className={`badge ${s.status === 'Present' ? 'badge-success' : 'badge-danger'}`}>{s.status}</span></td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.tap_time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.1)' }}>
                  <button className="btn btn-outline" onClick={() => exportSessionCSV(selectedSessionId)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={16}/> Export CSV
                  </button>
                  <button className="btn btn-primary" onClick={exportSessionPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Download size={16}/> Export PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>

  );
};

export default AdminDashboard;
