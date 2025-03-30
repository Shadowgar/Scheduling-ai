// frontend/src/components/Login.js
import React, { useState, /* useContext */ } from 'react'; // Add useContext later if using AuthContext
import { useNavigate } from 'react-router-dom';
// import { AuthContext } from '../context/AuthContext'; // Example: Uncomment when AuthContext is ready

function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    // const { login } = useContext(AuthContext); // Example: Uncomment when AuthContext is ready

    const handleSubmit = async (event) => {
        event.preventDefault(); // Prevent default page reload
        setError(null); // Clear previous errors
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/login', { // Using fetch API
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }), // Send email and password
            });

            const data = await response.json(); // Parse the JSON response body

            if (response.ok) {
                // --- SUCCESS ---
                console.log('Login successful:', data);

                // 1. Store the token (localStorage is simple, Context is better for reactivity)
                localStorage.setItem('accessToken', data.access_token);

                // 2. Store user info (Optional here, better handled by Context/global state)
                // localStorage.setItem('user', JSON.stringify(data.user)); // Less ideal than Context

                // 3. Update global state (Example using a hypothetical AuthContext)
                // login(data.access_token, data.user); // Call context login function

                // 4. Redirect to the main schedule page (or dashboard)
                navigate('/schedule'); // Assuming '/schedule' is your main app route after login

            } else {
                // --- FAILURE ---
                setError(data.message || 'Login failed. Please check your credentials.');
                console.error('Login failed:', data);
            }
        } catch (err) {
            // --- NETWORK OR OTHER ERRORS ---
            console.error('Login request failed:', err);
            setError('An error occurred during login. Please try again later.');
        } finally {
            setIsLoading(false); // Stop loading indicator
        }
    };

    return (
        <div className="login-container" style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Login</h2>
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="email" style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label htmlFor="password" style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                {error && <p style={{ color: 'red', marginBottom: '15px' }}>{error}</p>}
                <button
                    type="submit"
                    disabled={isLoading}
                    style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    {isLoading ? 'Logging in...' : 'Login'}
                </button>
            </form>
        </div>
    );
}

export default Login;