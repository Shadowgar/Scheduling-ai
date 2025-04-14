import React, { useState } from 'react';
import { apiFetch } from '../utils/api';

/**
 * ExcelUpload
 *
 * Component for uploading Excel files for historical scheduling data.
 * Handles file selection and upload to the backend.
 */
function ExcelUpload() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preview, setPreview] = useState(null);

  const handleFileChange = (e) => {
    console.log("handleFileChange called", e.target.files[0]); // DEBUG LOG
    setFile(e.target.files[0]);
    setError('');
    setSuccess('');
    setPreview(null);
  };

  const handleUpload = async () => {
    console.log("handleUpload called", file); // DEBUG LOG
    if (!file) return;
    setUploading(true);
    setError('');
    setSuccess('');
    setPreview(null);

    try {
      const token = localStorage.getItem('accessToken');
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiFetch('/api/excel/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      console.log("Excel upload response:", data); // DEBUG LOG
      if (!response.ok) {
        setError(data.error || 'Upload failed');
      } else {
        setSuccess(data.message || 'Upload successful');
        setPreview({
          columns: data.columns,
          preview: data.preview,
          sheet_names: data.sheet_names,
        });
      }
    } catch (err) {
      console.error("Excel upload error:", err); // DEBUG LOG
      setError('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h4>Upload Excel File</h4>
      <input
        type="file"
        accept=".xls,.xlsx"
        onChange={handleFileChange}
        disabled={uploading}
      />
      <button onClick={handleUpload} disabled={uploading || !file} style={{ marginLeft: '1rem' }}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
      {error && <div style={{ color: 'red', marginTop: '0.5rem' }}>{error}</div>}
      {success && <div style={{ color: 'green', marginTop: '0.5rem' }}>{success}</div>}
      {preview && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Columns:</strong> {(preview.columns || []).join(', ')}
          <br />
          <strong>Sheet(s):</strong> {(preview.sheet_names || []).join(', ')}
          <br />
          <strong>Preview (first 5 rows):</strong>
          <pre style={{ background: '#f7f7f7', padding: '0.5rem', borderRadius: '4px' }}>
            {JSON.stringify(preview.preview, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ExcelUpload;