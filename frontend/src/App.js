// frontend/src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import ScheduleCalendar from './components/ScheduleCalendar';
import EmployeeManager from './components/EmployeeManager';
import Login from './components/Login';
import Navbar from './components/Navbar';
import './App.css';

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
    const [isLoading, setIsLoading] = useState(true); // Still true initially

    const AppContent = () => {
        const navigate = useNavigate();
        console.log('AppContent rendering...'); // Keep this log for now

        const handleLoginSuccess = useCallback((data) => {
            console.log('App.js: handleLoginSuccess called with data:', data);
            if (data && data.access_token && data.user) {
                const tokenToStore = data.access_token;
                // console.log('App.js: Token to store:', tokenToStore); // Can comment out
                localStorage.setItem('accessToken', tokenToStore);
                // console.log('App.js: Token stored in localStorage.'); // Can comment out
                setCurrentUser(data.user); // Set user state
                setIsLoading(false); // We have user data, no longer loading initial auth
                console.log('App.js: User state set:', data.user);
                console.log('App.js: Navigating to /schedule');
                navigate('/schedule');
            } else {
                console.error('App.js: handleLoginSuccess received invalid data:', data);
                setIsLoading(false); // Stop loading even if login data is bad
            }
        }, [navigate]);

        const handleLogout = useCallback(() => {
            console.log('App.js: handleLogout called');
            localStorage.removeItem('accessToken');
            setCurrentUser(null); // Clear user state
            setIsLoading(false); // No user, not loading initial auth
            navigate('/login');
        }, [navigate]);

        // --- Effect for Initial Authentication Check ---
        useEffect(() => {
            console.log('App.js: Auth check effect logic running...');
            const token = localStorage.getItem('accessToken');
            // console.log('App.js: Token retrieved from localStorage:', token); // Can comment out

            // *** FIX: Only fetch if token exists AND we don't have a user yet ***
            if (token && currentUser === null) {
                console.log('App.js: Token found AND currentUser is null, fetching /api/auth/me');
                const headers = { 'Authorization': `Bearer ${token}` };
                // console.log('App.js: Fetching /api/auth/me with headers:', headers); // Can comment out

                // Ensure loading is true before fetch
                if (!isLoading) setIsLoading(true);

                fetch('/api/auth/me', { headers: headers })
                .then(response => {
                    // console.log('App.js: /api/auth/me response status:', response.status); // Can comment out
                    if (response.ok) {
                        return response.json();
                    }
                    // If token is invalid/expired, logout
                    throw new Error(`Invalid or expired token (status: ${response.status})`);
                })
                .then(data => {
                    if (data && data.user) {
                        console.log('App.js: User data fetched successfully, setting state.');
                        setCurrentUser(data.user); // Set user state
                    } else {
                         console.error('App.js: /api/auth/me response OK but no user data');
                         handleLogout(); // Treat as invalid session
                    }
                })
                .catch(error => {
                    console.error('App.js: Error validating token or fetching user:', error.message);
                    handleLogout(); // Clear invalid token and state
                })
                .finally(() => {
                    console.log('App.js: Initial auth fetch finished.');
                    setIsLoading(false); // Finished loading sequence
                });
            } else if (!token) {
                 // No token found, ensure user is null and stop loading
                 console.log('App.js: No token found, ensuring user is null.');
                 if (currentUser !== null) setCurrentUser(null); // Clear user if somehow set
                 if (isLoading) setIsLoading(false); // Stop loading
            } else {
                 // Token exists AND currentUser is already set, no need to fetch
                 console.log('App.js: Token found and currentUser exists, skipping fetch.');
                 // Ensure loading is false if we skipped fetch
                 if (isLoading) setIsLoading(false);
            }
        // Dependencies:
        // - handleLogout: Stable function.
        // - currentUser: We need to re-run if the user logs out (currentUser becomes null).
        // - isLoading: Might need to re-run if loading state changes externally (less likely here).
        }, [handleLogout, currentUser, isLoading]);


        // Show loading indicator *only* when isLoading is true
        if (isLoading) {
            return <div className="loading-container">Loading application...</div>;
        }

        // --- Render Main Application UI ---
        const isAuthenticated = !!currentUser;
        const userRole = currentUser?.role; // Get role safely

        return (
            <div className="App">
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
                            // Pass currentUser itself if ScheduleCalendar needs more than just the role
                            element={<ScheduleCalendar currentUser={currentUser} />}
                        />
                        <Route
                            path="/admin/employees"
                            element={
                                <ProtectedRoute isAllowed={isAuthenticated && userRole === 'supervisor'} redirectTo="/schedule">
                                    {/* Pass relevant props if EmployeeManager needs them */}
                                    <EmployeeManager />
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