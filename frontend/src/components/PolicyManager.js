import React, { useState, useEffect } from 'react';
import './EmployeeManager.css'; // Reuse styling or create PolicyManager.css
import { API_BASE_URL, apiFetch } from '../utils/api';

const PolicyManager = () => {
  const [file, setFile] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError('');
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
        setUploading(false);
        setUploadProgress(0);
        if (xhr.status >= 200 && xhr.status < 300) {
          setFile(null);
          await fetchPolicies();
        } else {
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
  };

  return (
    <div className="employee-manager">
      <h2>Policy Document Management</h2>

      <div className="upload-section">
        <input type="file" onChange={handleFileChange} disabled={uploading} />
        <button onClick={handleUpload} disabled={uploading || !file}>
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

      <h3>Uploaded Policies</h3>
      <ul>
        {policies
          .slice()
          .sort((a, b) => a.filename.localeCompare(b.filename))
          .map((policy) => (
            <li key={policy.id}>
              <a
                href={`/admin/policies/view/${policy.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {policy.filename}
              </a>
              {' '}
              ({policy.file_type}) - Uploaded: {new Date(policy.uploaded_at).toLocaleString()}
              {' '}
              <a
                href={`/admin/policies/file/${policy.id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginLeft: '10px' }}
              >
                View Original
              </a>
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
                style={{ marginLeft: '10px' }}
              >
                Delete
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
};

export default PolicyManager;
