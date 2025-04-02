// frontend/src/components/OllamaAssistant.js
import React, { useState } from 'react';
import './OllamaAssistant.css';

const OllamaAssistant = () => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setResponse(''); // Clear previous response

    try {
      // --- Retrieve the token ---
      const token = localStorage.getItem('accessToken');

      // --- Add check: Ensure token exists ---
      if (!token) {
        console.error('handleSubmit Error: No access token found in localStorage.');
        setError('Authentication error: You might need to log in again.');
        setIsLoading(false);
        return; // Stop execution if no token
      }
      // --- End check ---

      const apiResponse = await fetch('/api/ollama/query', { // Ensure this path is correct relative to your setup
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Correctly sending the token
        },
        body: JSON.stringify({ query }) // Sending the query text
      });

      // --- Improved error handling ---
      if (!apiResponse.ok) {
        let errorPayload = { message: `Request failed with status: ${apiResponse.status}` };
        try {
          // Try to parse backend error message if available
          const backendError = await apiResponse.json();
          errorPayload = backendError; // Use backend error
        } catch (parseError) {
          // Ignore if response wasn't JSON
          console.warn("Could not parse error response as JSON.");
        }
        // Use the 'error' field from backend if it exists, otherwise use 'message' or default
        throw new Error(errorPayload.error || errorPayload.message || `HTTP error! Status: ${apiResponse.status}`);
      }
      // --- End improved error handling ---

      const data = await apiResponse.json();
      setResponse(data.response || JSON.stringify(data, null, 2)); // Display response or formatted data

    } catch (err) {
      console.error('Error querying Ollama:', err);
      // Set the error state with the message from the caught error
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="ollama-assistant">
      <h2>Schedule Assistant</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-container">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about the schedule or request changes..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Processing...' : 'Ask'}
          </button>
        </div>
      </form>

      {/* Display loading indicator */}
      {isLoading && <div className="loading-message">Thinking...</div>}

      {/* Display error message if exists and not loading */}
      {error && !isLoading && <div className="error-message">Error: {error}</div>}

      {/* Display response if exists and not loading/errored */}
      {response && !isLoading && !error && (
        <div className="response-container">
          <h3>Response:</h3>
          {/* Use preformatted text for potentially multi-line responses */}
          <pre className="response-content">{response}</pre>
        </div>
      )}
    </div>
  );
};

export default OllamaAssistant;