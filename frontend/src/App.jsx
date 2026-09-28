import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminLayout, QALayout, LecturerLayout, StudentLayout, TerminalLayout } from './components/Layouts';

import Login from './components/Login';
import EcosystemDashboard from './components/EcosystemDashboard';
import AdminDashboard from './components/AdminDashboard';
import LecturerDashboard from './components/LecturerDashboard';
import StudentDashboard from './components/StudentDashboard';
import QADashboard from './components/QADashboard';
import TerminalDashboard from './components/TerminalDashboard';
import AcademicDashboard from './components/AcademicDashboard';
import TapPointDashboard from './components/TapPointDashboard';
import ExamDashboard from './components/ExamDashboard';
import LibraryDashboard from './components/LibraryDashboard';
import EquipmentDashboard from './components/EquipmentDashboard';
import EventsDashboard from './components/EventsDashboard';

const Spinner = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: '40px', height: '40px', border: '3px solid rgba(37,99,235,0.3)',
                  borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const ProtectedRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;

  if (!user) {
    return (
      <Routes>
        <Route path="/terminal" element={<TerminalLayout><TerminalDashboard /></TerminalLayout>} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const role = user.role?.toLowerCase();

  if (role === 'admin') {
    return (
      <AdminLayout>
        <Routes>
          <Route path="/" element={<EcosystemDashboard />} />
          <Route path="/students" element={<AdminDashboard />} />
          <Route path="/academic" element={<AcademicDashboard />} />
          <Route path="/tappoints" element={<TapPointDashboard />} />
          <Route path="/exams" element={<ExamDashboard />} />
          <Route path="/library" element={<LibraryDashboard />} />
          <Route path="/equipment" element={<EquipmentDashboard />} />
          <Route path="/events" element={<EventsDashboard />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AdminLayout>
    );
  }

  if (role === 'qa') {
    return (
      <QALayout>
        <Routes>
          <Route path="/qa" element={<QADashboard />} />
          <Route path="*" element={<Navigate to="/qa" />} />
        </Routes>
      </QALayout>
    );
  }

  if (role === 'lecturer') {
    return (
      <LecturerLayout>
        <Routes>
          <Route path="/" element={<LecturerDashboard />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </LecturerLayout>
    );
  }

  if (role === 'student') {
    return (
      <StudentLayout>
        <Routes>
          <Route path="/" element={<StudentDashboard />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </StudentLayout>
    );
  }

  return <Navigate to="/" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <ProtectedRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
