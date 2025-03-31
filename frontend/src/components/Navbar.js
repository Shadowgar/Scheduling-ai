// frontend/src/components/Navbar.js
import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css'; // Create this file for styling

function Navbar({ currentUser, onLogout }) {
    const isAuthenticated = !!currentUser;
    const isSupervisor = currentUser?.role === 'supervisor';

    return (
        <nav className="main-navbar">
            <div className="nav-links">
                {/* Always show App Name/Home Link */}
                 <Link to={isAuthenticated ? "/schedule" : "/login"} className="nav-brand">Scheduler</Link>

                {isAuthenticated && <Link to="/schedule">Schedule</Link>}
                {isSupervisor && (
                    <Link to="/admin/employees">Manage Employees</Link>
                )}
                {/* Add other links as needed */}
            </div>
            <div className="nav-auth">
                {!isAuthenticated && <Link to="/login">Login</Link>}
                {isAuthenticated && (
                    <>
                        <span className="user-greeting">Welcome, {currentUser.name}!</span>
                        <button onClick={onLogout} className="logout-button">Logout</button>
                    </>
                )}
            </div>
        </nav>
    );
}

export default Navbar;