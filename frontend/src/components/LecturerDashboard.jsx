import React, { useState, useEffect } from 'react';
import { UserCheck, Filter, Download, Calendar, Eye, X } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useAuth } from '../contexts/AuthContext';
import TerminalDashboard from './TerminalDashboard';

const LecturerDashboard = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [liveRecords, setLiveRecords] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [stats, setStats] = useState({ total_classes: 0, total_students: 0, avg_attendance: 100 });
  const [detailedClass, setDetailedClass] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:5000/api/lecturer/${user.id}/classes`)
      .then(res => res.json())
      .then(data => {
        setClasses(data.classes || []);
        setLoading(false);
      })
      .catch(console.error);
      
    fetch(`http://localhost:5000/api/lecturer/${user.id}/stats`)
      .then(res => res.json())
      .then(data => {
        setStats(data);
      })
      .catch(console.error);

    fetch('http://localhost:5000/api/lecturer/sessions/active')
      .then(res => res.json())
      .then(data => {
        if (data.active) setActiveSessionId(data.schedule_id);
      })
      .catch(console.error);
  }, [user]);

  // Live polling logic moved to TerminalDashboard, we just need active session here
  useEffect(() => {
    let interval;
    if (activeSessionId) {
      // Just verifying session is still active
      const checkActive = async () => {
        try {
          const res = await fetch('http://localhost:5000/api/lecturer/sessions/active');
          const data = await res.json();
          if (!data.active) setActiveSessionId(null);
        } catch (e) {}
      };
      interval = setInterval(checkActive, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSessionId]);

  const handleStartClass = async (schedule_id) => {
    try {
      const res = await fetch('http://localhost:5000/api/lecturer/sessions/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule_id })
      });
      if (res.ok) {
        setActiveSessionId(schedule_id);
        setLiveRecords([]);
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch(e) { console.error(e); }
  };

  const handleEndClass = async (alreadyEnded) => {
    if (alreadyEnded) {
      // TerminalDashboard already ended the session and showed the export modal
      setActiveSessionId(null);
      return;
    }
    if (window.confirm("Are you sure you want to end this class session?")) {
      try {
        await fetch('http://localhost:5000/api/lecturer/sessions/end', { method: 'POST' });
        setActiveSessionId(null);
      } catch(e) { console.error(e); }
    }
  };


  const handleViewDetails = async (schedule_id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/lecturer/classes/${schedule_id}/details`);
      const data = await res.json();
      if (!data.error) {
        setDetailedClass(data);
      }
    } catch (e) {
      console.error("Failed to fetch class details:", e);
    }
  };

  const generatePDF = () => {
    if (!detailedClass) return;
    const doc = new jsPDF();
    const { class_info, enrolled_students, historical_sessions } = detailedClass;
    
    // Title
    doc.setFontSize(18);
    doc.text(`Attendance Report: ${class_info.unit_code}`, 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Unit: ${class_info.unit_name}`, 14, 30);
    doc.text(`Lecturer: ${user.name}`, 14, 36);
    doc.text(`Semester: ${class_info.semester || 'N/A'} | Venue: ${class_info.venue}`, 14, 42);
    
    // Students Table
    doc.setFontSize(14);
    doc.text('Enrolled Students', 14, 55);
    
    doc.autoTable({
      startY: 60,
      head: [['Reg No', 'Name', 'Year of Study']],
      body: enrolled_students.map(s => [s.reg_no, s.name, s.year_of_study]),
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] }
    });
    
    // Historical Sessions Table
    if (historical_sessions.length > 0) {
      let finalY = doc.lastAutoTable.finalY + 15;
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }
      
      doc.setFontSize(14);
      doc.text('Attendance History', 14, finalY);
      
      doc.autoTable({
        startY: finalY + 5,
        head: [['Date', 'Present', 'Expected', 'Attendance %']],
        body: historical_sessions.map(s => {
          const pct = s.total_expected > 0 ? Math.round((s.present_count / s.total_expected) * 100) : 0;
          return [new Date(s.date).toLocaleDateString(), s.present_count, s.total_expected, `${pct}%`];
        }),
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129] }
      });
    }
    
    doc.save(`Attendance_Report_${class_info.unit_code}.pdf`);
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading schedule...</div>;

  if (activeSessionId) {
    const activeClass = classes.find(c => c.id === activeSessionId);
    return (
      <div style={{ marginTop: '2rem' }}>
         <TerminalDashboard activeClass={activeClass} onEndSession={handleEndClass} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', marginTop: '2rem' }}>
        <div>
           <h3 style={{ margin: 0 }}>My Dashboard</h3>
           <p style={{ color: 'var(--text-muted)' }}>Welcome back, {user.name}!</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
           <button className="btn btn-outline"><Filter size={16}/> Filter</button>
           <button className="btn btn-primary"><Download size={16}/> Export Reports</button>
        </div>
      </div>
      
      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '12px', color: 'var(--color-primary-light)' }}>
            <Calendar size={28} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>My Classes</p>
            <h2 style={{ margin: 0 }}>{stats.total_classes}</h2>
          </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(109, 40, 217, 0.1)', borderRadius: '12px', color: 'rgb(109, 40, 217)' }}>
            <UserCheck size={28} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Total Students</p>
            <h2 style={{ margin: 0 }}>{stats.total_students}</h2>
          </div>
        </div>
        
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', color: 'var(--success)' }}>
            <UserCheck size={28} />
          </div>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Avg. Attendance</p>
            <h2 style={{ margin: 0 }}>{stats.avg_attendance}%</h2>
          </div>
        </div>
      </div>

      <h3 style={{ marginBottom: '1.5rem' }}>Upcoming Schedule</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        {classes.map((cls, idx) => (
          <div key={idx} className="glass-panel" style={{ 
            borderTop: activeSessionId === cls.id ? '4px solid var(--success)' : '1px solid var(--border-color)',
            boxShadow: activeSessionId === cls.id ? '0 0 20px rgba(16, 185, 129, 0.2)' : 'none'
          }}>
            <h3 style={{ margin: 0 }}>{cls.unit_code}</h3>
            <p style={{ color: 'var(--text-muted)' }}>{cls.unit_name}</p>
            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}>
               <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={14}/> {cls.day} {cls.time}</span>
               <span className="badge badge-success">{cls.venue}</span>
            </div>
            
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Students Enrolled: {cls.enrolled_count}</span>
                <span>Avg. Attendance: {cls.avg_attendance}%</span>
              </div>
              <div style={{ marginTop: '0.5rem', width: '100%', background: 'var(--border-color)', height: '4px', borderRadius: '2px' }}>
                <div style={{ width: `${cls.avg_attendance}%`, background: 'var(--color-primary-light)', height: '100%', borderRadius: '2px' }}></div>
              </div>
            </div>
            
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-outline" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }} onClick={() => handleViewDetails(cls.id)}>
                <Eye size={16}/> Details
              </button>
              <button className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem' }} onClick={() => handleStartClass(cls.id)}>
                Start Class
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* DETAILED CLASS MODAL */}
      {detailedClass && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '2rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
              <div>
                <h2 style={{ margin: 0 }}>{detailedClass.class_info.unit_code} - {detailedClass.class_info.unit_name}</h2>
                <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>{detailedClass.class_info.day}s at {detailedClass.class_info.time} | Venue: {detailedClass.class_info.venue}</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={generatePDF} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Download size={16}/> Export PDF
                </button>
                <button onClick={() => setDetailedClass(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={24}/>
                </button>
              </div>
            </div>
            
            <div style={{ overflowY: 'auto', padding: '2rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                
                {/* Enrolled Students */}
                <div>
                  <h3 style={{ borderBottom: '2px solid var(--color-primary-light)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Enrolled Students ({detailedClass.enrolled_students.length})</h3>
                  {detailedClass.enrolled_students.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No students enrolled.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {detailedClass.enrolled_students.map(s => (
                        <div key={s.uid} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ display: 'block' }}>{s.name}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.reg_no}</span>
                          </div>
                          <span className="badge badge-outline">Year {s.year_of_study}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Historical Sessions */}
                <div>
                  <h3 style={{ borderBottom: '2px solid var(--success)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Attendance History</h3>
                  {detailedClass.historical_sessions.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>No past sessions recorded.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {detailedClass.historical_sessions.map(sess => {
                        const pct = sess.total_expected > 0 ? Math.round((sess.present_count / sess.total_expected) * 100) : 0;
                        return (
                          <div key={sess.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <strong>{new Date(sess.date).toLocaleDateString()}</strong>
                              <span className={`badge ${pct >= 75 ? 'badge-success' : pct >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                                {pct}%
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              {sess.present_count} / {sess.total_expected} Students Present
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LecturerDashboard;
