import React, { useState, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { AlertTriangle, TrendingDown, UploadCloud, Download, CheckCircle, XCircle, Clock, Calendar as CalendarIcon, Filter, FileText, Users, UserCheck, UserX, X } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement);

const API = 'http://localhost:5000';

// ─── Reusable Session Export Modal ──────────────────────────────────────────
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

  const exportCSV = () => window.open(`${API}/api/sessions/${sessionId}/attendance?format=csv`, '_blank');

  const exportPDF = () => {
    if (!data) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Attendance Report', 14, 20);
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
      didParseCell: (hd) => {
        if (hd.section === 'body' && hd.column.index === 3) {
          hd.cell.styles.textColor = hd.cell.raw === 'Present' ? [16, 185, 129] : [239, 68, 68];
          hd.cell.styles.fontStyle = 'bold';
        }
      }
    });
    doc.save(`Attendance_${data.unit_code}_${data.date}.pdf`);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '1rem' }}>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Session Attendance Report</h2>
            {data && <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {data.unit_code} · {new Date(data.date).toLocaleDateString()} · {data.venue}
            </p>}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24} /></button>
        </div>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : !data || data.error ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--danger)' }}>Could not load session data.</div>
        ) : (
          <>
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
            <div style={{ overflowY: 'auto', flex: 1, padding: '1.5rem 2rem' }}>
              <div className="table-container">
                <table>
                  <thead><tr><th>Reg No</th><th>Name</th><th>Year</th><th>Status</th><th>Tap Time</th></tr></thead>
                  <tbody>
                    {data.students.map((s, i) => (
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

// ─── QA Dashboard ────────────────────────────────────────────────────────────
const QADashboard = () => {
  const [activeTab, setActiveTab] = useState('compliance');
  
  const [untaughtClasses, setUntaughtClasses] = useState([]);
  const [reportsData, setReportsData] = useState(null);
  const [reportPeriod, setReportPeriod] = useState('weekly');
  
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Sessions tab state
  const [completedSessions, setCompletedSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionSearch, setSessionSearch] = useState('');

  useEffect(() => {
    if (activeTab === 'compliance') fetchUntaughtClasses();
    if (activeTab === 'reports') fetchReports(reportPeriod);
    if (activeTab === 'sessions') fetchCompletedSessions();
  }, [activeTab, reportPeriod]);

  const fetchUntaughtClasses = async () => {
    try {
      const res = await fetch(`${API}/api/qa/untaught_classes`);
      const data = await res.json();
      setUntaughtClasses(data.untaught || []);
    } catch (e) { console.error(e); }
  };

  const fetchReports = async (period) => {
    try {
      const res = await fetch(`${API}/api/qa/reports?period=${period}`);
      const data = await res.json();
      setReportsData(data);
    } catch (e) { console.error(e); }
  };

  const fetchCompletedSessions = async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch(`${API}/api/sessions/completed`);
      const data = await res.json();
      setCompletedSessions(data.sessions || []);
    } catch (e) { console.error(e); }
    finally { setSessionsLoading(false); }
  };

  const handleFileUpload = async () => {
    if (!uploadFile) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    try {
      const res = await fetch(`${API}/api/qa/timetable/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      setUploadResult(data);
    } catch (e) {
      setUploadResult({ error: 'Failed to upload timetable' });
    } finally {
      setIsUploading(false);
      setUploadFile(null);
    }
  };

  const exportReportCSV = () => {
    if (!reportsData) return;
    const { summary } = reportsData;
    const csvContent = "data:text/csv;charset=utf-8,"
      + "Metric,Value\n"
      + `Period,${reportPeriod}\n`
      + `Total Scheduled,${summary.total_scheduled}\n`
      + `Total Taught,${summary.total_taught}\n`
      + `Classes Untaught,${summary.total_untaught}\n`
      + `Avg Attendance %,${summary.avg_attendance}\n`;
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `qa_report_${reportPeriod}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredSessions = completedSessions.filter(s =>
    s.unit_code.toLowerCase().includes(sessionSearch.toLowerCase()) ||
    s.unit_name.toLowerCase().includes(sessionSearch.toLowerCase()) ||
    s.lecturer.toLowerCase().includes(sessionSearch.toLowerCase())
  );

  const TabButton = ({ id, label }) => (
    <button
      className={`btn ${activeTab === id ? 'btn-primary' : 'btn-outline'}`}
      onClick={() => setActiveTab(id)}
      style={{ padding: '0.6rem 1.2rem' }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="gradient-text">Quality Assurance &amp; Analytics</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <TabButton id="compliance" label="Untaught Classes" />
          <TabButton id="reports" label="Reports &amp; Analytics" />
          <TabButton id="sessions" label="Session Export" />
          <TabButton id="timetable" label="Timetable Upload" />
        </div>
      </div>

      {/* COMPLIANCE TAB */}
      {activeTab === 'compliance' && (
        <div>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ flex: 1, background: 'var(--danger-bg)', border: '1px solid var(--danger)', padding: '1.5rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <AlertTriangle size={30} color="var(--danger)" />
                <div>
                  <h3 style={{ color: 'var(--danger)', margin: 0, fontSize: '1.8rem' }}>{untaughtClasses.length}</h3>
                  <p style={{ margin: 0, color: 'var(--text-main)', opacity: 0.9 }}>Classes flagged as untaught</p>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, background: 'var(--warning-bg)', border: '1px solid var(--warning)', padding: '1.5rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Clock size={30} color="var(--warning)" />
                <div>
                  <h3 style={{ color: 'var(--warning)', margin: 0, fontSize: '1.8rem' }}>0</h3>
                  <p style={{ margin: 0, color: 'var(--text-main)', opacity: 0.9 }}>Classes starting late</p>
                </div>
              </div>
            </div>
          </div>
          <div className="glass-panel">
            <h3 style={{ marginBottom: '1rem' }}>Missing Sessions / Untaught Classes</h3>
            {untaughtClasses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No untaught classes found. Excellent compliance!</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Unit Code</th><th>Unit Name</th><th>Lecturer</th><th>Venue</th><th>Day &amp; Time</th><th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {untaughtClasses.map(cls => (
                      <tr key={cls.id}>
                        <td style={{ fontWeight: '500' }}>{cls.unit_code}</td>
                        <td>{cls.unit_name}</td>
                        <td>{cls.lecturer}</td>
                        <td>{cls.venue}</td>
                        <td>{cls.day_of_week} ({cls.time})</td>
                        <td>
                          <button className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--warning)', color: 'var(--warning)' }}>
                            Notify Lecturer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && reportsData && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Filter size={18} color="var(--text-muted)" />
              <select className="input" value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)} style={{ padding: '0.5rem 1rem' }}>
                <option value="daily">Daily Report</option>
                <option value="weekly">Weekly Report</option>
                <option value="monthly">Monthly Report</option>
                <option value="trimester">Trimester Report</option>
                <option value="yearly">Yearly Report</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={exportReportCSV}>
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            {[{label: 'Scheduled', val: reportsData.summary.total_scheduled, color: 'var(--color-primary-light)'},
              {label: 'Taught', val: reportsData.summary.total_taught, color: 'var(--success)'},
              {label: 'Untaught', val: reportsData.summary.total_untaught, color: 'var(--danger)'},
              {label: 'Avg Attendance', val: `${reportsData.summary.avg_attendance}%`, color: 'var(--warning)'}].map((stat, i) => (
              <div key={i} className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
                <h4 style={{ color: 'var(--text-muted)', marginBottom: '0.5rem', fontSize: '0.85rem', textTransform: 'uppercase' }}>{stat.label}</h4>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: stat.color }}>{stat.val}</div>
              </div>
            ))}
          </div>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Attendance Trend ({reportPeriod})</h3>
            <div style={{ height: '300px' }}>
              <Line
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { color: '#94a3b8', callback: (val) => val + '%' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#94a3b8' }, grid: { display: false } } } }}
                data={{ labels: reportsData.chart.labels, datasets: [{ label: 'Attendance %', data: reportsData.chart.data, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', tension: 0.3, fill: true }] }}
              />
            </div>
          </div>
        </div>
      )}

      {/* SESSIONS EXPORT TAB */}
      {activeTab === 'sessions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>Completed Class Sessions</h2>
            <input
              className="input"
              placeholder="Search by unit, lecturer..."
              value={sessionSearch}
              onChange={e => setSessionSearch(e.target.value)}
              style={{ width: '280px', padding: '0.5rem 1rem' }}
            />
          </div>

          {sessionsLoading ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem' }}>Loading sessions…</p>
          ) : filteredSessions.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
              <Clock size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
              <p style={{ color: 'var(--text-muted)' }}>No completed sessions found.</p>
            </div>
          ) : (
            <div className="table-container glass-panel" style={{ padding: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Unit Code</th>
                    <th>Unit Name</th>
                    <th>Lecturer</th>
                    <th>Venue</th>
                    <th>Attendance</th>
                    <th style={{ textAlign: 'center' }}>Export</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map(sess => (
                    <tr key={sess.session_id}>
                      <td>{new Date(sess.date).toLocaleDateString()}</td>
                      <td style={{ fontWeight: 600 }}>{sess.unit_code}</td>
                      <td>{sess.unit_name}</td>
                      <td>{sess.lecturer}</td>
                      <td>{sess.venue}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className={`badge ${sess.attendance_pct >= 75 ? 'badge-success' : sess.attendance_pct >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                            {sess.attendance_pct}%
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sess.present}/{sess.enrolled}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            onClick={() => setSelectedSessionId(sess.session_id)}
                          >
                            <Download size={13}/> Export
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ padding: '0.3rem 0.75rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                            onClick={() => window.open(`${API}/api/sessions/${sess.session_id}/attendance?format=csv`, '_blank')}
                          >
                            <FileText size={13}/> CSV
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

      {/* TIMETABLE TAB */}
      {activeTab === 'timetable' && (
        <div className="glass-panel" style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Upload Master Timetable</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem', lineHeight: 1.6 }}>
            Upload an Excel, CSV, or PDF file to automatically populate class schedules. Ensure your document has a table with the following headers in order:
            <br />
            <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'inline-block', marginTop: '0.5rem' }}>
              UnitCode, LecturerEmail, VenueName, DayOfWeek, StartTime, EndTime, Semester
            </code>
          </p>
          <div style={{ border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '3rem 2rem', textAlign: 'center', marginBottom: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
            <UploadCloud size={48} color="var(--color-primary-light)" style={{ marginBottom: '1rem' }} />
            <h4 style={{ marginBottom: '0.5rem' }}>Select Excel, CSV, or PDF File</h4>
            <input type="file" accept=".csv, .pdf, .xlsx, .xls" onChange={(e) => setUploadFile(e.target.files[0])} style={{ display: 'block', margin: '0 auto' }} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleFileUpload} disabled={!uploadFile || isUploading}>
            {isUploading ? 'Uploading & Parsing...' : 'Import Timetable'}
          </button>
          {uploadResult && (
            <div style={{ marginTop: '2rem', padding: '1rem', borderRadius: '8px', background: uploadResult.error ? 'var(--danger-bg)' : 'var(--success-bg)', border: `1px solid ${uploadResult.error ? 'var(--danger)' : 'var(--success)'}` }}>
              {uploadResult.error ? (
                <div style={{ color: 'var(--danger)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}><XCircle size={18} /> {uploadResult.error}</div>
              ) : (
                <div>
                  <div style={{ color: 'var(--success)', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', fontWeight: 'bold' }}><CheckCircle size={18} /> {uploadResult.message}</div>
                  {uploadResult.errors && uploadResult.errors.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <p style={{ color: 'var(--warning)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>The following rows had issues and were skipped:</p>
                      <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--warning)', fontSize: '0.8rem' }}>
                        {uploadResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Session Export Modal */}
      {selectedSessionId && (
        <SessionExportModal sessionId={selectedSessionId} onClose={() => setSelectedSessionId(null)} />
      )}
    </div>
  );
};

export default QADashboard;