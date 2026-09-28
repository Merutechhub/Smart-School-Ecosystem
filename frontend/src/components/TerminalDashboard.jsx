import React, { useState, useEffect } from 'react';
import { Smartphone, CheckCircle, XCircle, Clock, AlertTriangle, Download, FileText, X, Users, UserCheck, UserX } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const API = 'http://localhost:5000';

// ─── Export Modal ────────────────────────────────────────────────────────────
const SessionExportModal = ({ sessionId, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`${API}/api/sessions/${sessionId}/attendance`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionId]);

  const exportCSV = () => {
    window.open(`${API}/api/sessions/${sessionId}/attendance?format=csv`, '_blank');
  };

  const exportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(`Attendance Report`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Unit: ${data.unit_code} — ${data.unit_name}`, 14, 30);
    doc.text(`Lecturer: ${data.lecturer}`, 14, 37);
    doc.text(`Date: ${new Date(data.date).toLocaleDateString()}  |  Venue: ${data.venue}`, 14, 44);
    doc.text(`Present: ${data.present_count} / ${data.total_enrolled}`, 14, 51);

    doc.autoTable({
      startY: 60,
      head: [['Reg No', 'Name', 'Year', 'Status', 'Tap Time']],
      body: data.students.map(s => [s.reg_no, s.name, s.year_of_study, s.status, s.tap_time]),
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      bodyStyles: { fontSize: 10 },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 3) {
          hookData.cell.styles.textColor = hookData.cell.raw === 'Present' ? [16, 185, 129] : [239, 68, 68];
          hookData.cell.styles.fontStyle = 'bold';
        }
      }
    });

    doc.save(`Attendance_${data.unit_code}_${data.date}.pdf`);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem'
    }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.05)' }}>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={22} color="var(--success)" /> Class Ended — Session Report
            </h2>
            {data && <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {data.unit_code} · {new Date(data.date).toLocaleDateString()} · {data.venue}
            </p>}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading session data…</div>
        ) : !data || data.error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--danger)' }}>Could not load session data.</div>
        ) : (
          <>
            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)' }}>
              {[
                { icon: <Users size={20}/>, label: 'Enrolled', val: data.total_enrolled, color: 'var(--color-primary-light)' },
                { icon: <UserCheck size={20}/>, label: 'Present', val: data.present_count, color: 'var(--success)' },
                { icon: <UserX size={20}/>, label: 'Absent', val: data.total_enrolled - data.present_count, color: 'var(--danger)' },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                  <div style={{ color: s.color, display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>{s.icon}</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Student Table */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '1.5rem 2rem' }}>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Reg No</th>
                      <th>Name</th>
                      <th>Year</th>
                      <th>Status</th>
                      <th>Tap Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((s, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{s.reg_no}</td>
                        <td>{s.name}</td>
                        <td>Year {s.year_of_study}</td>
                        <td>
                          <span className={`badge ${s.status === 'Present' ? 'badge-success' : 'badge-danger'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.tap_time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '1.25rem 2rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.1)' }}>
              <button className="btn btn-outline" onClick={exportCSV} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={16}/> Export CSV
              </button>
              <button className="btn btn-primary" onClick={exportPDF} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16}/> Export PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main Terminal Dashboard ─────────────────────────────────────────────────
const TerminalDashboard = ({ activeClass: propActiveClass, onEndSession }) => {
  const [liveRecords, setLiveRecords] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [activeClass, setActiveClass] = useState(propActiveClass || null);
  const [lastTapTimestamp, setLastTapTimestamp] = useState(0);
  const [exportSessionId, setExportSessionId] = useState(null);

  // Poll for latest tap result from hardware
  useEffect(() => {
    let timeoutId;
    const fetchLatestTap = async () => {
      try {
        const res = await fetch(`${API}/api/latest_tap`);
        if (res.ok) {
          const data = await res.json();
          const nowSeconds = Date.now() / 1000;
          if (data.timestamp > lastTapTimestamp) {
            setLastTapTimestamp(data.timestamp);
            if (nowSeconds - data.timestamp <= 10) {
              setScanResult(data);
              clearTimeout(timeoutId);
              const remainingTimeMs = 10000 - ((nowSeconds - data.timestamp) * 1000);
              timeoutId = setTimeout(() => setScanResult(null), remainingTimeMs);
            }
          }
        }
      } catch (e) { /* ignore */ }
    };
    const interval = setInterval(fetchLatestTap, 150);
    return () => { clearInterval(interval); clearTimeout(timeoutId); };
  }, [lastTapTimestamp]);

  // Poll for live attendance and active class
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch(`${API}/api/live-attendance`);
        const data = await res.json();
        setLiveRecords(data.records || []);
      } catch (e) { console.error("Failed to fetch live attendance"); }
    };

    const fetchActiveInfo = async () => {
      if (propActiveClass) { setActiveClass(propActiveClass); return; }
      try {
        const res = await fetch(`${API}/api/stats`);
        const data = await res.json();
        if (data.active_classes && data.active_classes.length > 0) {
          setActiveClass(data.active_classes[0]);
        } else {
          setActiveClass(null);
        }
      } catch (e) { console.error("Failed to fetch active class info"); }
    };

    fetchLive();
    fetchActiveInfo();
    const interval = setInterval(() => {
      fetchLive();
      if (!propActiveClass) fetchActiveInfo();
    }, 500);
    return () => clearInterval(interval);
  }, [propActiveClass]);

  // Wrap the end session to capture session ID and show export modal
  const handleEndSession = async () => {
    if (!onEndSession) return;
    try {
      const res = await fetch(`${API}/api/lecturer/sessions/end`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.ended_session_ids && data.ended_session_ids.length > 0) {
          setExportSessionId(data.ended_session_ids[0]);
        }
      }
    } catch (e) { console.error(e); }
    // Call parent callback but don't let it double-end the session
    if (typeof onEndSession === 'function') {
      // We already ended the session, just notify parent to update UI state
      onEndSession(true); // pass flag so parent skips its own fetch
    }
  };

  if (!activeClass) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center' }}>
        <Clock size={64} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
        <h2 style={{ color: 'var(--text-muted)' }}>No Active Class Session</h2>
        <p style={{ color: 'var(--text-muted)' }}>Waiting for a lecturer to start a class...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="gradient-text">NFC Attendance Scanner</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
            Class: <strong style={{ color: 'var(--text-main)' }}>{activeClass.unit_code} - {activeClass.unit_name}</strong> | Venue: <strong style={{ color: 'var(--text-main)' }}>{activeClass.venue}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></div>
            TERMINAL ACTIVE
          </div>
          {onEndSession && (
            <button className="btn btn-outline" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={handleEndSession}>
              End Session
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        
        {/* Scanner Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', textAlign: 'center', position: 'relative' }}>
          {scanResult ? (
            <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
              {scanResult.status === 'success' ? (
                <CheckCircle size={80} color="var(--success)" style={{ marginBottom: '1rem', filter: 'drop-shadow(0 0 10px rgba(16,185,129,0.5))' }} />
              ) : scanResult.status === 'warning' ? (
                <AlertTriangle size={80} color="var(--warning)" style={{ marginBottom: '1rem', filter: 'drop-shadow(0 0 10px rgba(245,158,11,0.5))' }} />
              ) : (
                <XCircle size={80} color="var(--danger)" style={{ marginBottom: '1rem', filter: 'drop-shadow(0 0 10px rgba(239,68,68,0.5))' }} />
              )}
              <h2 style={{ color: scanResult.status === 'success' ? 'var(--success)' : scanResult.status === 'warning' ? 'var(--warning)' : 'var(--danger)' }}>
                {scanResult.message}
              </h2>
              {scanResult.student && (
                <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%', maxWidth: '300px' }}>
                  <img src={scanResult.student.avatar} alt="Avatar" style={{ width: '120px', height: '120px', borderRadius: '50%', border: '4px solid ' + (scanResult.status === 'success' ? 'var(--success)' : scanResult.status === 'warning' ? 'var(--warning)' : 'var(--danger)'), objectFit: 'cover' }} />
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem' }}>{scanResult.student.name}</h3>
                    <p style={{ color: 'var(--text-muted)', margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 'bold' }}>{scanResult.student.reg_no}</p>
                    <span className="badge badge-outline" style={{ borderColor: 'var(--color-primary-light)', color: 'var(--color-primary-light)' }}>
                      Year {scanResult.student.year_of_study}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(37, 99, 235, 0.1)', border: '2px dashed var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem', animation: 'pulse 2s infinite' }}>
                <Smartphone size={50} color="var(--color-primary-light)" />
              </div>
              <h2>Ready for Scan</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Please place your NFC Card on the reader.</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-primary-light)', fontStyle: 'italic' }}>
                Hardware scanner is active and listening for taps...
              </p>
            </>
          )}
        </div>

        {/* Live Feed Panel */}
        <div className="glass-panel">
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={20} color="var(--color-primary-light)" /> Recent Activity Feed
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {liveRecords.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No recent activity.</p>
            ) : (
              liveRecords.map((record) => (
                <div key={record.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', borderLeft: `4px solid ${record.status === 'Present' ? 'var(--success)' : record.status.includes('Warning') ? 'var(--warning)' : 'var(--danger)'}` }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{record.student_name}</h4>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{record.reg_no}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${record.status === 'Present' ? 'badge-success' : record.status.includes('Warning') ? 'badge-warning' : 'badge-danger'}`}>
                      {record.status}
                    </span>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Export Modal — shown after session ends */}
      {exportSessionId && (
        <SessionExportModal
          sessionId={exportSessionId}
          onClose={() => setExportSessionId(null)}
        />
      )}

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(37, 99, 235, 0); }
          100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default TerminalDashboard;
