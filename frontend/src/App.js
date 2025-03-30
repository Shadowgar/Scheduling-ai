// frontend/src/App.js
import React, { useState } from 'react';
// *** Import Router components ***
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import ScheduleCalendar from './components/ScheduleCalendar';
import EmployeeManager from './components/EmployeeManager'; // *** Import the new component ***
import './App.css';

// *** Helper component for protected routes ***
const ProtectedRoute = ({ role, allowedRoles, children }) => {
  if (!allowedRoles.includes(role)) {
    // Redirect to home page or a 'not authorized' page if role not allowed
    console.warn(`Access denied for role "${role}". Allowed: ${allowedRoles.join(', ')}`);
    return <Navigate to="/" replace />;
  }
  return children;
};


function App() {
  const [currentUserRole, setCurrentUserRole] = useState('supervisor'); // Default role

  return (
    // *** Wrap with Router ***
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Employee Scheduling</h1>

          {/* --- Navigation --- */}
          <nav className="main-nav">
            <Link to="/">Schedule</Link>
            {/* Only show Admin link to supervisors */}
            {currentUserRole === 'supervisor' && (
              <Link to="/admin/employees">Manage Employees</Link>
            )}
          </nav>

          {/* --- Role Switcher --- */}
          <div className="role-switcher">
            <span>Simulate Role:</span>
            <button onClick={() => setCurrentUserRole('supervisor')} disabled={currentUserRole === 'supervisor'} style={{ fontWeight: currentUserRole === 'supervisor' ? 'bold' : 'normal' }}> Supervisor </button>
            <button onClick={() => setCurrentUserRole('employee')} disabled={currentUserRole === 'employee'} style={{ fontWeight: currentUserRole === 'employee' ? 'bold' : 'normal' }}> Employee </button>
            <p> (Currently: <strong>{currentUserRole}</strong>) </p>
          </div>
        </header>

        <main>
          {/* --- Define Routes --- */}
          <Routes>
            {/* Schedule Calendar Route (visible to all) */}
            <Route path="/" element={<ScheduleCalendar userRole={currentUserRole} />} />

            {/* Employee Manager Route (protected) */}
            <Route
              path="/admin/employees"
              element={
                <ProtectedRoute role={currentUserRole} allowedRoles={['supervisor']}>
                  <EmployeeManager />
                </ProtectedRoute>
              }
            />

            {/* Optional: Catch-all or Not Found route */}
            {/* <Route path="*" element={<div>Page Not Found</div>} /> */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;