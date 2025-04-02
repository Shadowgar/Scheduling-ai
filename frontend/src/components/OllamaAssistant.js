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
    
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch('/api/ollama/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query })
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }
      
      const data = await response.json();
      setResponse(data.response || JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err.message);
      console.error('Error querying Ollama:', err);
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
      
      {error && <div className="error-message">{error}</div>}
      
      {response && (
        <div className="response-container">
          <h3>Response:</h3>
          <div className="response-content">
            {response}
          </div>
        </div>
      )}
    </div>
  );
};

export default OllamaAssistant;
