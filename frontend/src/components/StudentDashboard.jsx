import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const StudentDashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://localhost:5000/api/student/${user.uid}`)
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(console.error);
  }, [user]);

  if (loading) return <div style={{ padding: '2rem' }}>Loading student data...</div>;
  if (data.error) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>{data.error}</div>;

  // Calculate overall attendance
  const totalAttendance = data.units.reduce((acc, unit) => acc + unit.attendance, 0);
  const overallAttendance = data.units.length > 0 ? Math.round(totalAttendance / data.units.length) : 100;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginTop: '2rem' }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="glass-panel" style={{ textAlign: 'center' }}>
            <h3 style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Overall Attendance</h3>
            <div style={{ position: 'relative', width: '150px', height: '150px', margin: '0 auto', borderRadius: '50%', background: `conic-gradient(${overallAttendance >= 75 ? 'var(--success)' : 'var(--warning)'} 0% ${overallAttendance}%, var(--border-color) ${overallAttendance}% 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <h2 style={{ fontSize: '2.5rem', margin: 0, color: overallAttendance >= 75 ? 'var(--success)' : 'var(--warning)' }}>{overallAttendance}%</h2>
              </div>
            </div>
            <p style={{ marginTop: '1rem', color: overallAttendance >= 75 ? 'var(--success)' : 'var(--warning)' }}>
              {overallAttendance >= 75 ? 'Great standing!' : 'Requires Attention'}
            </p>
          </div>

          <div className="glass-panel">
            <h3 style={{ marginBottom: '1rem' }}>NFC Card Status</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '8px' }}>
              <div style={{ width: '40px', height: '25px', background: 'var(--color-primary-light)', borderRadius: '4px' }}></div>
              <div>
                <p style={{ margin: 0, fontWeight: '600' }}>UID: {data.card_uid || 'Not Assigned'}</p>
                <span className={`badge ${data.card_status === 'Active' ? 'badge-success' : 'badge-warning'}`} style={{ padding: '0.1rem 0.5rem', fontSize: '0.7rem' }}>{data.card_status}</span>
              </div>
            </div>
            <button className="btn btn-outline" style={{ width: '100%', marginTop: '1rem', color: 'var(--warning)', borderColor: 'var(--warning)' }}>Report Lost Card</button>
          </div>
        </div>

        <div className="glass-panel">
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} color="var(--color-primary-light)" /> 
            My Units
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data.units.map(unit => (
              <div key={unit.code} style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '8px', borderLeft: `4px solid ${unit.attendance >= 75 ? 'var(--success)' : 'var(--danger)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h4>{unit.code} - {unit.name}</h4>
                  </div>
                  <h3 style={{ color: unit.attendance >= 75 ? 'var(--success)' : 'var(--danger)' }}>{unit.attendance}%</h3>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', opacity: 0.5 }}>
                  <p style={{fontSize: '0.8rem'}}>Dynamic session tracking implemented in backend.</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default StudentDashboard;
