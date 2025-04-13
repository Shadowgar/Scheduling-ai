import React, { useState, useEffect } from 'react';
import './EmployeeManager.css'; // TODO: Create PolicyManager.css for custom styles
import { API_BASE_URL, apiFetch } from '../utils/api';

// Helper for status color
const statusColor = (status) => {
  if (status === 'Error') return '#ffeaea';
  if (status === 'Pending') return '#fffbe6';
  if (status === 'Indexed') return '#eaffea';
  return '#f9f9f9';
};

const PolicyManager = () => {
  const [files, setFiles] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sortBy, setSortBy] = useState('filename');
  const [sortDir, setSortDir] = useState('asc');
  const [filter, setFilter] = useState('');
  const [viewTextId, setViewTextId] = useState(null);
  const [viewText, setViewText] = useState('');
  const [loadingText, setLoadingText] = useState(false);

  const fetchPolicies = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await apiFetch('/api/policies/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch policies');
      const data = await response.json();
      setPolicies(data);
    } catch (err) {
      console.error(err);
      setError('Error fetching policies');
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  // Sorting and filtering
  const sortedPolicies = policies
    .filter(
      (p) =>
        p.filename.toLowerCase().includes(filter.toLowerCase()) ||
        p.file_type.toLowerCase().includes(filter.toLowerCase()) ||
        p.status.toLowerCase().includes(filter.toLowerCase())
    )
    .slice()
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'filename') cmp = a.filename.localeCompare(b.filename);
      else if (sortBy === 'file_type') cmp = a.file_type.localeCompare(b.file_type);
      else if (sortBy === 'uploaded_at') cmp = new Date(a.uploaded_at) - new Date(b.uploaded_at);
      else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortBy === 'chunk_count') cmp = a.chunk_count - b.chunk_count;
      if (sortDir === 'desc') cmp = -cmp;
      return cmp;
    });

  // Upload handlers
  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setUploadProgress(0);
    setError('');
    let completed = 0;
    for (const file of files) {
      try {
        const token = localStorage.getItem('accessToken');
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', API_BASE_URL + '/api/policies/upload', true);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        };

        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            completed += 1;
            if (completed === files.length) {
              setUploading(false);
              setUploadProgress(0);
              setFiles([]);
              await fetchPolicies();
            }
          } else {
            setUploading(false);
            setUploadProgress(0);
            try {
              const errorData = JSON.parse(xhr.responseText);
              setError(errorData.error || 'Upload failed');
            } catch {
              setError('Upload failed');
            }
          }
        };

        xhr.onerror = () => {
          setUploading(false);
          setUploadProgress(0);
          setError('Upload failed');
        };

        xhr.send(formData);
      } catch (err) {
        console.error(err);
        setUploading(false);
        setUploadProgress(0);
        setError(err.message);
      }
    }
  };

  // View extracted text/chunks
  const handleViewText = async (policyId) => {
    console.log("handleViewText called for policyId:", policyId); // DEBUG LOG
    setViewTextId(policyId);
    setLoadingText(true);
    setViewText('');
    try {
      const token = localStorage.getItem('accessToken');
      const response = await apiFetch(`/api/policies/${policyId}/view`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch extracted text');
      const text = await response.text();
      console.log("Extracted text response:", text); // DEBUG LOG
      setViewText(text);
    } catch (err) {
      setViewText('Error loading extracted text');
    }
    setLoadingText(false);
  };

  // Table header with sorting
  const renderHeader = (label, key) => (
    <th
      onClick={() => {
        if (sortBy === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        else {
          setSortBy(key);
          setSortDir('asc');
        }
      }}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      {label} {sortBy === key ? (sortDir === 'asc' ? '▲' : '▼') : ''}
    </th>
  );

  return (
    <div className="employee-manager">
      <h2>Policy Document Management</h2>

      <div className="upload-section">
        <input
          type="file"
          multiple
          onChange={handleFileChange}
          disabled={uploading}
        />
        <button onClick={handleUpload} disabled={uploading || !files.length}>
          {uploading ? 'Uploading...' : 'Upload Policy'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {uploading && (
        <div style={{ marginTop: '10px' }}>
          Uploading: {uploadProgress}%
          <div style={{ background: '#ccc', height: '10px', width: '100%', marginTop: '5px' }}>
            <div
              style={{
                background: '#4caf50',
                width: `${uploadProgress}%`,
                height: '100%',
                transition: 'width 0.2s'
              }}
            />
          </div>
        </div>
      )}

      <div style={{ margin: '16px 0' }}>
        <input
          type="text"
          placeholder="Search by name, type, or status"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ padding: '6px', width: '250px', marginRight: '10px' }}
        />
        <button
          onClick={async () => {
            setError('');
            try {
              const token = localStorage.getItem('accessToken');
              const response = await apiFetch('/api/policies/reindex', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              if (!response.ok) throw new Error('Failed to re-index policies');
              await fetchPolicies();
            } catch (err) {
              setError('Error re-indexing policies');
            }
          }}
        >
          Re-index All
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
        <thead>
          <tr>
            {renderHeader('Filename', 'filename')}
            {renderHeader('Type', 'file_type')}
            {renderHeader('Uploaded', 'uploaded_at')}
            {renderHeader('Status', 'status')}
            {renderHeader('Chunks', 'chunk_count')}
            <th>Error</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedPolicies.map((policy) => (
            <tr
              key={policy.id}
              style={{
                background: statusColor(policy.status),
                borderBottom: '1px solid #eee'
              }}
            >
              <td>{policy.filename}</td>
              <td>{policy.file_type}</td>
              <td>{new Date(policy.uploaded_at).toLocaleString()}</td>
              <td>
                <span
                  style={{
                    color:
                      policy.status === 'Error'
                        ? 'red'
                        : policy.status === 'Pending'
                        ? '#b59a00'
                        : 'green',
                    fontWeight: 'bold'
                  }}
                >
                  {policy.status}
                </span>
              </td>
              <td>{policy.chunk_count}</td>
              <td style={{ color: 'red', fontSize: '0.95em' }}>
                {policy.error_message}
              </td>
              <td>
                <a
                  href={`/admin/policies/file/${policy.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ marginRight: '8px' }}
                >
                  Download
                </a>
                <button
                  onClick={() => handleViewText(policy.id)}
                  style={{ marginRight: '8px' }}
                >
                  View Text
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm('Are you sure you want to delete this policy?')) return;
                    try {
                      const token = localStorage.getItem('accessToken');
                      const response = await apiFetch(`/api/policies/${policy.id}`, {
                        method: 'DELETE',
                        headers: {
                          'Authorization': `Bearer ${token}`
                        }
                      });
                      if (!response.ok) throw new Error('Failed to delete policy');
                      await fetchPolicies();
                    } catch (err) {
                      console.error(err);
                      alert('Error deleting policy');
                    }
                  }}
                  style={{ marginRight: '8px' }}
                >
                  Delete
                </button>
                <button
                  onClick={async () => {
                    setError('');
                    try {
                      const token = localStorage.getItem('accessToken');
                      const response = await apiFetch('/api/policies/reindex', {
                        method: 'POST',
                        headers: {
                          'Authorization': `Bearer ${token}`
                        }
                      });
                      if (!response.ok) throw new Error('Failed to re-index policies');
                      await fetchPolicies();
                    } catch (err) {
                      setError('Error re-indexing policies');
                    }
                  }}
                >
                  Re-index
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal for viewing extracted text/chunks */}
      {viewTextId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setViewTextId(null)}
        >
          <div
            style={{
              background: '#fff',
              padding: '24px',
              borderRadius: '8px',
              maxWidth: '700px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 2px 16px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3>Extracted Text</h3>
            {loadingText ? (
              <div>Loading...</div>
            ) : (
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '1em' }}>{viewText}</pre>
            )}
            <button onClick={() => setViewTextId(null)} style={{ marginTop: '16px' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PolicyManager;
