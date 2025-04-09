import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';

const PolicyViewer = () => {
  const { id } = useParams();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const response = await apiFetch(`/api/policies/${id}/view`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (!response.ok) throw new Error('Failed to fetch policy content');
        const text = await response.text();
        setContent(text);
      } catch (err) {
        console.error(err);
        setError('Error loading policy content');
      }
    };
    fetchContent();
  }, [id]);

  return (
    <div style={{ padding: '20px' }}>
      <h2>Policy Document #{id}</h2>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f4f4f4', padding: '10px' }}>
        {content}
      </pre>
    </div>
  );
};

export default PolicyViewer;
