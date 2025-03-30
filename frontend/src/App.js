// frontend/src/App.js
import React, { useState, useEffect } from 'react'; // Add useEffect
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom'; // Add useNavigate
import ScheduleCalendar from './components/ScheduleCalendar';
import EmployeeManager from './components/EmployeeManager';
import Login from './components/Login';
import './App.css';

// *** We will modify ProtectedRoute later to use real auth state ***
// Keep it for now, but it won't work correctly until we add auth context/state
const ProtectedRoute = ({ isAllowed, children }) => {
  if (!isAllowed) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" replace />;
  }
  return children;
};

// --- Component for handling Logout ---
// We place useNavigate outside the App component itself
const LogoutButton = () => {
    const navigate = useNavigate();
    const handleLogout = () => {
        localStorage.removeItem('accessToken'); // Clear the token
        // Optionally clear user info if stored separately
        // localStorage.removeItem('user');
        navigate('/login'); // Redirect to login
        // Force a reload might be needed if App state isn't reactive enough yet
        window.location.reload(); // Consider removing this if using Context API later
    };
    return <button onClick={handleLogout} className="logout-button">Logout</button>;
};


function App() {
  // --- Real Authentication State (Simplified using localStorage for now) ---
  // We derive the initial state directly from localStorage
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('accessToken'));
  // We'll add user info/role state later, perhaps fetched from a /api/auth/me endpoint or stored during login

  // This effect could run once on mount to verify the token or fetch user data
  // For now, we just rely on the presence of the token
  useEffect(() => {
      const token = localStorage.getItem('accessToken');
      setIsAuthenticated(!!token);
      // TODO: Add logic here to verify token with backend (/api/auth/me)
      // and fetch user details if token is valid. Update state accordingly.
  }, []); // Runs once on component mount

  // Placeholder for user role - this needs to be fetched/set after login
  // For now, let's assume 'supervisor' if logged in, otherwise null.
  // THIS IS A TEMPORARY SIMPLIFICATION
  const currentUserRole = isAuthenticated ? 'supervisor' : null; // TODO: Replace with actual role from user data

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Employee Scheduling</h1>

          {/* --- Navigation --- */}
          <nav className="main-nav">
            {isAuthenticated && <Link to="/schedule">Schedule</Link>}
            {/* Show Manage Employees link only if authenticated and supervisor */}
            {isAuthenticated && currentUserRole === 'supervisor' && (
              <Link to="/admin/employees">Manage Employees</Link>
            )}
            {!isAuthenticated && <Link to="/Login">Login</Link>}
            {isAuthenticated && <LogoutButton />} {/* Add Logout Button */}
          </nav>

          {/* --- REMOVE Role Switcher --- */}
          {/*
          <div className="role-switcher">
            <span>Simulate Role:</span>
            <button onClick={() => setCurrentUserRole('supervisor')} disabled={currentUserRole === 'supervisor'} style={{ fontWeight: currentUserRole === 'supervisor' ? 'bold' : 'normal' }}> Supervisor </button>
            <button onClick={() => setCurrentUserRole('employee')} disabled={currentUserRole === 'employee'} style={{ fontWeight: currentUserRole === 'employee' ? 'bold' : 'normal' }}> Employee </button>
            <p> (Currently: <strong>{currentUserRole}</strong>) </p>
          </div>
          */}
        </header>

        <main>
          {/* --- Define Routes --- */}
          <Routes>
            {/* Login Route */}
            <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/schedule" replace />} />

            {/* Schedule Calendar Route (Protected) */}
            <Route
              path="/schedule"
              element={
                <ProtectedRoute isAllowed={isAuthenticated}>
                  {/* Pass the role if ScheduleCalendar needs it */}
                  <ScheduleCalendar userRole={currentUserRole} />
                </ProtectedRoute>
              }
            />

            {/* Employee Manager Route (Protected) */}
            <Route
              path="/admin/employees"
              element={
                <ProtectedRoute isAllowed={isAuthenticated && currentUserRole === 'supervisor'}>
                  <EmployeeManager />
                </ProtectedRoute>
              }
            />

            {/* Default Route: Redirect based on auth status */}
            <Route
              path="/"
              element={isAuthenticated ? <Navigate to="/schedule" replace /> : <Navigate to="/login" replace />}
            />

            {/* Optional: Catch-all or Not Found route */}
            <Route path="*" element={<div>404 Not Found - Page does not exist</div>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;