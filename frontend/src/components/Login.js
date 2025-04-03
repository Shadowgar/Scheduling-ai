// frontend/src/components/Login.js
import React, { useState } from 'react';
import './Login.css';
// No navigate needed here anymore, App.js handles it

// Accept onLoginSuccess prop from App.js
function Login({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError(null);
        setIsLoading(true);
        console.log('Login.js: handleSubmit triggered. Email:', email); // <<< DEBUG LOG

        try {
            console.log('Login.js: Attempting fetch to /api/auth/login'); // <<< DEBUG LOG
            const response = await fetch('/api/auth/login', { // Using relative URL for proxy
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            console.log('Login.js: Fetch response status:', response.status); // <<< DEBUG LOG
            // It's generally safer to attempt parsing JSON even on failure,
            // as the body might contain a structured error message.
            let data;
            try {
                data = await response.json(); // Parse JSON response
                console.log('Login.js: Fetch response data:', data); // <<< DEBUG LOG
            } catch (jsonError) {
                // Handle cases where response is not JSON (e.g., HTML error page from proxy/server)
                console.error('Login.js: Failed to parse JSON response:', jsonError); // <<< DEBUG LOG
                const textResponse = await response.text(); // Get raw text instead
                console.error('Login.js: Raw text response:', textResponse); // <<< DEBUG LOG
                setError(`Server returned non-JSON response (Status: ${response.status}). Check network tab.`);
                setIsLoading(false);
                return; // Stop execution here
            }


            if (response.ok) {
                // --- SUCCESS ---
                console.log('Login.js: Login successful. Raw response data:', data); // <<< DEBUG LOG
                // *** ADD DETAILED LOGGING HERE ***
                if (data && data.access_token) {
                    const receivedToken = data.access_token;
                    console.log('Login.js: Received access_token:', receivedToken); // <<< DEBUG LOG
                    console.log('Login.js: Calling onLoginSuccess callback.'); // <<< DEBUG LOG
                     if (typeof onLoginSuccess === 'function') {
                        onLoginSuccess(data); // Pass the full data object up
                    } else {
                        console.error("Login.js: onLoginSuccess prop is not a function!"); // <<< DEBUG LOG
                        setError("Login callback configuration error."); // Show error to user
                    }
                } else {
                    console.error('Login.js: Login response OK, but missing access_token in data:', data); // <<< DEBUG LOG
                    setError('Login succeeded but received invalid data from server.');
                }
                // *** REMOVE localStorage.setItem and navigate calls from here ***

            } else {
                // --- FAILURE ---
                console.error('Login.js: Login failed. Status:', response.status, 'Error from server:', data?.error || data?.message || 'Unknown server error'); // <<< DEBUG LOG
                setError(data?.error || data?.message || 'Login failed. Please check credentials.'); // Use backend error message safely
            }
        } catch (err) {
            // --- NETWORK OR OTHER ERRORS ---
            // This catches fetch failures (network down, DNS issues, CORS if proxy fails)
            console.error('Login.js: Login request failed (network error):', err); // <<< DEBUG LOG
            setError('Could not connect to the server. Please try again later.');
        } finally {
            console.log('Login.js: Setting isLoading to false.'); // <<< DEBUG LOG
            setIsLoading(false);
        }
    };

    // --- JSX remains the same ---
    return (
        <div className="login-container">
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="email">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        className="form-control"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        className="form-control"
                    />
                </div>
                {error && <p className="error-message">{error}</p>}
                <button
                    type="submit"
                    disabled={isLoading}
                    className="login-button"
                >
                    {isLoading ? 'Logging in...' : 'Login'}
                </button>
            </form>
        </div>
    );
}

export default Login;