import React from 'react';
import { Link } from 'react-router-dom';
// Assuming Navbar.css is imported somewhere, or import it here if needed:
import './Navbar.css';

const Navbar = ({ currentUser, onLogout }) => {
    // Check access_role against lowercase 'supervisor'
    const isAdmin = currentUser && currentUser.access_role === 'supervisor';
    const isLoggedIn = !!currentUser;

    // Log for debugging (optional)
    // console.log('[Navbar] Rendering. currentUser:', currentUser, 'isAdmin:', isAdmin);

    return (
        // Use class names from Navbar.css
        <nav className="main-navbar">

            {/* Left side: Brand and Links */}
            <div className="nav-links">
                <div className="nav-brand">
                    <Link to="/">Schedule App</Link>
                </div>
                {isLoggedIn && (
                    <>
                        {/* Use appropriate class for styling links */}
                        <Link to="/schedule" className="navbar-item">Schedule</Link>
                        <Link to="/assistant">AI Assistant</Link>
                        {isAdmin && (
                            <>
                                <Link to="/admin/employees" className="navbar-item">Manage Employees</Link>
                                <Link to="/admin/policies" className="navbar-item">Policies</Link>
                                <Link to="/admin/documents" className="navbar-item">Document Management</Link>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Right side: Auth info/buttons */}
            <div className="nav-auth">
                {isLoggedIn ? (
                    <>
                        <span className="user-greeting">
                            Hello, {currentUser.name} ({currentUser.job_title || 'N/A'})
                        </span>
                        <button onClick={onLogout} className="logout-button">
                            Logout
                        </button>
                    </>
                ) : (
                    // Ensure login-button class exists in CSS or style the Link appropriately
                    <Link to="/login" className="login-button">
                        Login
                    </Link>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
