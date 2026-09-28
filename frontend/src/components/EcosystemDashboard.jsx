import React, { useState, useEffect } from 'react';
import { Users, CreditCard, BookOpen, UserCheck, Activity } from 'lucide-react';

const EcosystemDashboard = () => {
  const [stats, setStats] = useState({ students: 0, cards: 0, lecturers: 0, units: 0 });

  useEffect(() => {
    fetch('http://localhost:5000/api/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
  }, []);

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '2rem' }}>
      <div style={{ padding: '1rem', background: `rgba(${color}, 0.1)`, borderRadius: '12px', color: `rgb(${color})` }}>
        <Icon size={32} />
      </div>
      <div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</p>
        <h2 style={{ fontSize: '2rem', margin: 0 }}>{value}</h2>
      </div>
    </div>
  );

  return (
    <div>
      <h1 className="gradient-text" style={{ marginBottom: '2rem' }}>Ecosystem Overview</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <StatCard title="Registered Students" value={stats.students || 0} icon={Users} color="37, 99, 235" />
        <StatCard title="Active NFC Cards" value={stats.cards || 0} icon={CreditCard} color="109, 40, 217" />
        <StatCard title="Active Lecturers" value={stats.lecturers || 0} icon={UserCheck} color="16, 185, 129" />
        <StatCard title="Active Units" value={stats.units || 0} icon={BookOpen} color="245, 158, 11" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
        <div className="glass-panel">
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} color="var(--color-primary-light)" /> 
            Live School Activity
          </h3>
          <p style={{ color: 'var(--text-muted)' }}>Simulated Real-Time Events Network</p>
          
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', marginTop: '1rem' }}>
             <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Global Campus Map Visualization (Placeholder)</p>
          </div>
        </div>
        
        <div className="glass-panel">
          <h3 style={{ marginBottom: '1.5rem' }}>Classes Happening Now</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
             {stats.active_classes && stats.active_classes.length > 0 ? (
               stats.active_classes.map(cls => (
                 <li key={cls.id} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                   <h4>{cls.unit_code} - {cls.unit_name}</h4>
                   <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cls.venue} • {cls.lecturer}</p>
                   <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: '0.8rem' }}>Attendance: {cls.attendance_count}/{cls.total_enrolled}</span>
                     <div style={{ width: '50%', background: 'var(--border-color)', height: '6px', borderRadius: '3px' }}>
                        <div style={{ width: `${Math.min(100, (cls.attendance_count / cls.total_enrolled) * 100)}%`, background: 'var(--success)', height: '100%', borderRadius: '3px' }}></div>
                     </div>
                   </div>
                 </li>
               ))
             ) : (
               <li style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                 No live classes happening right now.
               </li>
             )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default EcosystemDashboard;
