import React, { useState } from 'react';

/**
 * ExcelColumnMapper
 *
 * Allows user to map Excel columns to database fields after upload.
 * Expects columns and preview data as props.
 */
const DB_FIELDS = [
  { key: 'employee_name', label: 'Employee Name' },
  { key: 'shift_date', label: 'Shift Date' },
  { key: 'shift_start', label: 'Shift Start' },
  { key: 'shift_end', label: 'Shift End' },
  // Add more DB fields as needed
];

function ExcelColumnMapper({ columns, preview, filePath, sheetName, onMappingComplete, onRestart }) {
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validation, setValidation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [commitResult, setCommitResult] = useState(null);
  const [committing, setCommitting] = useState(false);

  // Reset mapping and validation to allow remapping
  const handleRemap = () => {
    setMapping({});
    setError('');
    setSuccess('');
    setValidation(null);
  };

  const handleSelect = (dbField, excelCol) => {
    setMapping((prev) => ({
      ...prev,
      [excelCol]: dbField,
    }));
    setError('');
    setSuccess('');
    setValidation(null);
  };

  const handleSubmit = async () => {
    if (!filePath || !sheetName) {
      setError('Missing file path or sheet name.');
      return;
    }
    // Ensure all required DB fields are mapped
    const required = DB_FIELDS.map(f => f.key);
    const mapped = Object.values(mapping);
    const missing = required.filter(f => !mapped.includes(f));
    if (missing.length) {
      setError('Please map all required fields: ' + missing.join(', '));
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    setValidation(null);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/excel/map', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: filePath,
          sheet_name: sheetName,
          mapping: mapping
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Mapping failed');
      } else {
        setSuccess(data.message || 'Mapping successful');
        setValidation(data);
        if (onMappingComplete) onMappingComplete(data);
      }
    } catch (err) {
      setError('Mapping failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Commit mapped/validated data to backend
  const handleCommit = async () => {
    if (!validation || !validation.preview || (validation.validation_errors && validation.validation_errors.length > 0)) {
      setCommitResult({ error: "Cannot commit: fix validation errors first." });
      return;
    }
    setCommitting(true);
    setCommitResult(null);
    try {
      const token = localStorage.getItem('accessToken');
      // Use the mapped/validated preview as records
      const records = validation.preview;
      const response = await fetch('/api/excel/commit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ records })
      });
      const data = await response.json();
      setCommitResult(data);
    } catch (err) {
      setCommitResult({ error: "Commit failed" });
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h4>Map Excel Columns to Database Fields</h4>
      <table style={{ borderCollapse: 'collapse', marginBottom: '1rem' }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 8px' }}>Excel Column</th>
            <th style={{ padding: '4px 8px' }}>Map to DB Field</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => (
            <tr key={col}>
              <td style={{ padding: '4px 8px' }}>{col}</td>
              <td style={{ padding: '4px 8px' }}>
                <select
                  value={mapping[col] || ''}
                  onChange={e => handleSelect(e.target.value, col)}
                >
                  <option value="">-- Select DB Field --</option>
                  {DB_FIELDS.map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={handleSubmit} disabled={submitting}>
        {submitting ? 'Submitting...' : 'Submit Mapping'}
      </button>
      {validation && (!validation.validation_errors || validation.validation_errors.length === 0) && (
        <button
          onClick={handleCommit}
          disabled={committing}
          style={{ marginLeft: '1rem', background: '#4caf50', color: 'white' }}
        >
          {committing ? 'Committing...' : 'Commit Data'}
        </button>
      )}
      {error && (
        <div style={{
          color: 'red',
          marginTop: '0.5rem',
          background: '#ffeaea',
          border: '1px solid #e57373',
          padding: '0.75rem',
          borderRadius: '4px'
        }}>
          <strong>Validation Error:</strong>
          <div>{error}</div>
        </div>
      )}
      {success && <div style={{ color: 'green', marginTop: '0.5rem' }}>{success}</div>}
      {validation && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Validation Result:</strong>
          {validation.validation_errors && validation.validation_errors.length > 0 ? (
            <ul style={{ color: 'red', margin: '0.5rem 0' }}>
              {validation.validation_errors.map((err, idx) => (
                <li key={idx}>{typeof err === 'string' ? err : JSON.stringify(err)}</li>
              ))}
            </ul>
          ) : (
            <span style={{ color: 'green' }}>No validation errors.</span>
          )}
          <pre style={{ background: '#f7f7f7', padding: '0.5rem', borderRadius: '4px' }}>
            {JSON.stringify(validation, null, 2)}
          </pre>
        </div>
      )}
      <div style={{ marginTop: '1rem' }}>
        <strong>Preview (first 5 rows):</strong>
        <pre style={{ background: '#f7f7f7', padding: '0.5rem', borderRadius: '4px' }}>
          {JSON.stringify(preview, null, 2)}
        </pre>
      </div>
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
        <button onClick={handleRemap} disabled={submitting}>
          Remap Columns
        </button>
        {onRestart && (
          <button onClick={onRestart} disabled={submitting}>
            Re-upload File
          </button>
        )}
      </div>
      {commitResult && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Commit Result:</strong>
          <pre style={{ background: '#f7f7f7', padding: '0.5rem', borderRadius: '4px' }}>
            {JSON.stringify(commitResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ExcelColumnMapper;