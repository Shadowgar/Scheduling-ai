import React, { useState, useEffect, useRef } from 'react';
import './OllamaAssistant.css';
import { apiFetch } from '../utils/api';

const OllamaAssistant = () => {
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [activeConv, isLoading]);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await apiFetch('/api/conversations/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setConversations(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const startNewChat = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await apiFetch('/api/conversations/', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: 'New Chat', messages: [] })
      });
      const data = await res.json();
      setConversations(prev => [data, ...prev]);
      setActiveConv(data);
    } catch (err) {
      console.error(err);
    }
  };

  const deleteConversation = async (id) => {
    try {
      const token = localStorage.getItem('accessToken');
      await apiFetch(`/api/conversations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConv?.id === id) setActiveConv(null);
    } catch (err) {
      console.error(err);
    }
  };

  const updateConversation = async (conv) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await apiFetch(`/api/conversations/${conv.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: conv.title, messages: conv.messages })
      });
      const data = await res.json();
      setConversations(prev => prev.map(c => c.id === data.id ? data : c));
      setActiveConv(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim() || !activeConv) return;

    const newMessages = [...(activeConv.messages || []), { role: 'user', text: query }];
    setIsLoading(true);
    setError(null);
    setQuery('');

    try {
      const token = localStorage.getItem('accessToken');

      // Save snapshot before AI modifies schedule
      await apiFetch('/api/schedule/snapshot', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ description: 'Before AI change' })
      });

      const res = await apiFetch('/api/ollama/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });
      const data = await res.json();
      newMessages.push({ role: 'assistant', text: data.response || '[No response]' });

      const updatedConv = { ...activeConv, messages: newMessages };
      await updateConversation(updatedConv);
    } catch (err) {
      console.error(err);
      setError('Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex h-screen ${darkMode ? 'text-white bg-gray-900' : 'text-gray-900 bg-white'}`}>
      <div className="w-64 flex flex-col bg-gray-800 p-2">
        <button className="mb-2 p-2 bg-gray-700 hover:bg-gray-600 rounded" onClick={startNewChat}>+ New Chat</button>
        <div className="flex-1 overflow-y-auto space-y-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`flex items-center justify-between p-2 rounded cursor-pointer ${activeConv?.id === conv.id ? 'bg-gray-700' : 'hover:bg-gray-700'}`}
              onClick={() => setActiveConv(conv)}
            >
              <input
                value={conv.title}
                onChange={async (e) => {
                  const newTitle = e.target.value;
                  const updated = { ...conv, title: newTitle };
                  await updateConversation(updated);
                }}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => e.stopPropagation()}
                className="bg-transparent border-none text-white flex-1 mr-2"
              />
              <button
                className="text-red-400 hover:text-red-600"
                title="Delete"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-2">
          <button
            className="w-full p-2 bg-gray-700 hover:bg-gray-600 rounded"
            onClick={async () => {
              try {
                const token = localStorage.getItem('accessToken');
                const snapsRes = await apiFetch('/api/schedule/snapshots', {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const snaps = await snapsRes.json();
                if (snaps.length === 0) {
                  alert('No snapshots to restore.');
                  return;
                }
                const latest = snaps[0];
                await apiFetch(`/api/schedule/snapshot/${latest.id}/restore`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                alert('Schedule restored to last snapshot.');
              } catch (err) {
                console.error(err);
                alert('Failed to restore snapshot.');
              }
            }}
          >
            Undo Last AI Change
          </button>
          <button
            className="w-full p-2 bg-gray-700 hover:bg-gray-600 rounded"
            onClick={() => setShowSettings(!showSettings)}
          >
            Settings
          </button>
          {showSettings && (
            <div className="p-2 bg-gray-700 rounded space-y-2">
              <div className="flex items-center justify-between">
                <span>Dark Mode</span>
                <input
                  type="checkbox"
                  checked={darkMode}
                  onChange={() => setDarkMode(!darkMode)}
                />
              </div>
              <div className="text-sm text-gray-300">More settings coming soon...</div>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col flex-1">
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeConv?.messages?.map((msg, idx) => (
            <div key={idx} className={`p-3 rounded max-w-xl ${msg.role === 'user' ? 'bg-blue-600 self-end' : 'bg-gray-700 self-start'}`}>
              {msg.text}
            </div>
          ))}
          {isLoading && <div className="p-3 rounded bg-gray-700 max-w-xl self-start">Thinking...</div>}
          <div ref={chatEndRef} />
        </div>
        {activeConv && (
          <form className="flex p-4 border-t border-gray-700" onSubmit={handleSubmit}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 p-2 rounded bg-gray-800 text-white border-none mr-2"
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="p-2 bg-blue-600 hover:bg-blue-500 rounded text-white"
            >
              Send
            </button>
          </form>
        )}
        {error && <div className="p-2 text-red-400">{error}</div>}
      </div>
    </div>
  );
};

export default OllamaAssistant;
