import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Users, BookOpen, Activity, LogOut, Radio, ClipboardList, BookMarked, Package, Calendar } from 'lucide-react';

const SidebarItem = ({ to, icon: Icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link 
      to={to} 
      style={{
        display: 'flex', alignItems: 'center', gap: '0.9rem', padding: '0.8rem 1rem',
        textDecoration: 'none', color: isActive ? 'white' : 'var(--text-muted)',
        background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
        borderRadius: '8px', transition: 'all 0.2s', marginBottom: '0.25rem',
        fontSize: '0.9rem'
      }}
    >
      <Icon size={18} color={isActive ? 'var(--color-primary-light)' : 'inherit'} />
      <span style={{ fontWeight: isActive ? '600' : '400' }}>{label}</span>
    </Link>
  );
};

const SidebarSection = ({ label }) => (
  <div style={{ fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.08em',
                color: 'var(--text-muted)', opacity: 0.6, padding: '1rem 1rem 0.4rem',
                textTransform: 'uppercase' }}>
    {label}
  </div>
);

export const AdminLayout = ({ children }) => {
  const { logout, user } = useAuth();
  return (
    <div className="app-container">
      <aside className="sidebar" style={{ overflowY: 'auto' }}>
        <div style={{ marginBottom: '1.5rem', padding: '0 1rem' }}>
          <h2 className="gradient-text" style={{ fontSize: '1.1rem' }}>KeMU Admin</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{user?.name}</p>
        </div>
        <nav style={{ flex: 1 }}>
          <SidebarSection label="Overview" />
          <SidebarItem to="/" icon={Activity} label="Ecosystem Overview" />
          
          <SidebarSection label="Identity" />
          <SidebarItem to="/students" icon={Users} label="Student Records" />
          <SidebarItem to="/tappoints" icon={Radio} label="TapPoint Devices" />
          
          <SidebarSection label="Academic" />
          <SidebarItem to="/academic" icon={BookOpen} label="Academic Structure" />
          <SidebarItem to="/exams" icon={ClipboardList} label="Examinations" />
          
          <SidebarSection label="Services" />
          <SidebarItem to="/library" icon={BookMarked} label="Library" />
          <SidebarItem to="/equipment" icon={Package} label="Equipment" />
          <SidebarItem to="/events" icon={Calendar} label="Events" />
          
          <SidebarSection label="Quality" />
          <SidebarItem to="/qa" icon={LayoutDashboard} label="Quality Assurance" />
        </nav>
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <button onClick={logout} className="btn"
            style={{ width: '100%', color: 'var(--text-muted)', background: 'transparent', justifyContent: 'center' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export const QALayout = ({ children }) => {
  const { logout, user } = useAuth();
  return (
    <div className="app-container">
      <aside className="sidebar" style={{ overflowY: 'auto' }}>
        <div style={{ marginBottom: '1.5rem', padding: '0 1rem' }}>
          <h2 className="gradient-text" style={{ fontSize: '1.1rem' }}>QA Portal</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{user?.name}</p>
        </div>
        <nav style={{ flex: 1 }}>
          <SidebarSection label="Quality" />
          <SidebarItem to="/qa" icon={LayoutDashboard} label="Quality Assurance" />
        </nav>
        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <button onClick={logout} className="btn"
            style={{ width: '100%', color: 'var(--text-muted)', background: 'transparent', justifyContent: 'center' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export const LecturerLayout = ({ children }) => {
  const { logout, user } = useAuth();
  return (
    <div className="app-container" style={{ flexDirection: 'column' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 2rem',
                       background: 'rgba(2,6,23,0.8)', borderBottom: '1px solid var(--border-color)' }}>
        <h2 className="gradient-text">Lecturer Portal</h2>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>Welcome, {user?.name}</span>
          <button onClick={logout} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>
      <main className="main-content" style={{ maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  );
};

export const StudentLayout = ({ children }) => {
  const { logout, user } = useAuth();
  return (
    <div className="app-container" style={{ flexDirection: 'column' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 2rem',
                       background: 'rgba(2,6,23,0.8)', borderBottom: '1px solid var(--border-color)' }}>
        <h2 className="gradient-text">Student Portal</h2>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>{user?.name} ({user?.reg_no})</span>
          <button onClick={logout} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>
      <main className="main-content" style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  );
};

export const TerminalLayout = ({ children }) => (
  <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center', background: 'black' }}>
    <main style={{ width: '100%', maxWidth: '900px' }}>
      {children}
    </main>
  </div>
);
