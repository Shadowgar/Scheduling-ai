import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';

const PolicyFileViewer = () => {
  const { id } = useParams();
  const [fileUrl, setFileUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchFile = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await apiFetch(`/api/policies/${id}/file`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Failed to fetch file');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setFileUrl(url);
      } catch (err) {
        console.error(err);
        setError('Error loading file');
      }
    };
    fetchFile();
  }, [id]);

  if (error) {
    return <div style={{ color: 'red' }}>{error}</div>;
  }

  if (!fileUrl) {
    return <div>Loading file...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>Original Policy Document #{id}</h2>
      <iframe
        src={fileUrl}
        title="Policy Document"
        style={{ width: '100%', height: '80vh', border: '1px solid #ccc' }}
      />
    </div>
  );
};

export default PolicyFileViewer;
