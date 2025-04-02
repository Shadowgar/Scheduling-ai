import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import ScheduleCalendar from './components/ScheduleCalendar';
import EmployeeManager from './components/EmployeeManager';
import Login from './components/Login';
import Navbar from './components/Navbar';
import './App.css';
import OllamaAssistant from './components/OllamaAssistant';

// ProtectedRoute remains the same conceptually
const ProtectedRoute = ({ isAllowed, children, redirectTo = "/login" }) => {
    if (!isAllowed) {
        return <Navigate to={redirectTo} replace />;
    }
    return children;
};

// --- Main App Component ---
function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const AppContent = () => {
        const navigate = useNavigate();
        console.log('AppContent rendering...');

        const handleLoginSuccess = useCallback((data) => {
            console.log('App.js: handleLoginSuccess called with data:', data);
            // Expecting access_role from backend
            if (data && data.access_token && data.user && data.user.access_role) {
                const tokenToStore = data.access_token;
                localStorage.setItem('accessToken', tokenToStore);
                setCurrentUser(data.user); // Set user state (includes job_title, access_role)
                setIsLoading(false);
                console.log('App.js: User state set:', data.user);
                console.log('App.js: Navigating to /schedule');
                navigate('/schedule');
            } else {
                console.error('App.js: handleLoginSuccess received invalid data (missing token, user, or access_role):', data);
                setIsLoading(false);
            }
        }, [navigate]);

        const handleLogout = useCallback(() => {
            console.log('App.js: handleLogout called');
            localStorage.removeItem('accessToken');
            setCurrentUser(null);
            setIsLoading(false);
            navigate('/login');
        }, [navigate]);

        // --- Effect for Initial Authentication Check ---
        useEffect(() => {
            console.log('App.js: Auth check effect logic running...');
            const token = localStorage.getItem('accessToken');

            if (token && currentUser === null) {
                console.log('App.js: Token found AND currentUser is null, fetching /api/auth/me');
                const headers = { 'Authorization': `Bearer ${token}` };

                if (!isLoading) setIsLoading(true);

                fetch('/api/auth/me', { headers: headers })
                .then(response => {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error(`Invalid or expired token (status: ${response.status})`);
                })
                .then(data => {
                    // Expecting access_role from backend
                    if (data && data.user && data.user.access_role) {
                        console.log('App.js: User data fetched successfully, setting state.');
                        setCurrentUser(data.user); // Set user state (includes job_title, access_role)
                    } else {
                         console.error('App.js: /api/auth/me response OK but missing user or access_role data:', data);
                         handleLogout(); // Treat as invalid session
                    }
                })
                .catch(error => {
                    console.error('App.js: Error validating token or fetching user:', error.message);
                    handleLogout();
                })
                .finally(() => {
                    console.log('App.js: Initial auth fetch finished.');
                    setIsLoading(false);
                });
            } else if (!token) {
                 console.log('App.js: No token found, ensuring user is null.');
                 if (currentUser !== null) setCurrentUser(null);
                 if (isLoading) setIsLoading(false);
            } else {
                 console.log('App.js: Token found and currentUser exists, skipping fetch.');
                 if (isLoading) setIsLoading(false);
            }
        }, [handleLogout, currentUser, isLoading]);


        if (isLoading) {
            return <div className="loading-container">Loading application...</div>;
        }

        // --- Render Main Application UI ---
        const isAuthenticated = !!currentUser;
        // Get access_role value (e.g., 'supervisor', 'member')
        const userAccessRole = currentUser?.access_role;

        console.log('[App.js] Rendering Routes. isAuthenticated:', isAuthenticated, 'userAccessRole:', userAccessRole);


        return (
            <div className="App">
                {/* Navbar expects currentUser with job_title/access_role */}
                <Navbar currentUser={currentUser} onLogout={handleLogout} />
                <header className="App-header">
                    <h1>Employee Scheduling</h1>
                </header>
                <main>
                    <Routes>
                        <Route
                            path="/login"
                            element={!isAuthenticated ? <Login onLoginSuccess={handleLoginSuccess} /> : <Navigate to="/schedule" replace />}
                        />
                        <Route
                            path="/schedule"
                            // ScheduleCalendar expects currentUser with job_title/access_role
                            element={<ScheduleCalendar currentUser={currentUser} />}
                        />
                        <Route
                            path="/admin/employees"
                            element={
                                <ProtectedRoute
                                    // Check against lowercase 'supervisor'
                                    isAllowed={isAuthenticated && userAccessRole === 'supervisor'}
                                    redirectTo="/schedule"
                                >
                                    {/* EmployeeManager expects job_title/access_role */}
                                    <EmployeeManager />
                                </ProtectedRoute>
                            }
                        />
                        <Route
    path="/assistant"
    element={
        <ProtectedRoute
            isAllowed={isAuthenticated}
            redirectTo="/login"
        >
            <OllamaAssistant />
        </ProtectedRoute>
    }
/>
                        <Route
                            path="/"
                            element={<Navigate to={isAuthenticated ? "/schedule" : "/login"} replace />}
                        />
                        <Route path="*" element={<div style={{ padding: '20px' }}><h2>404 Not Found</h2><p>Page does not exist.</p></div>} />
                    </Routes>
                </main>
            </div>
        );
    };

    return (
        <Router>
            <AppContent />
        </Router>
    );
}

export default App;