import React, { useState, useEffect } from 'react';
import PolicyManager from './PolicyManager';
import ExcelUpload from './ExcelUpload';
import ExcelColumnMapper from './ExcelColumnMapper';
import { apiFetch } from '../utils/api';
import './EmployeeManager.css'; // Reuse for table styling, or create DocumentManager.css

/**
 * DocumentManager
 *
 * Unified area for managing all document types (policies, Excel, etc.).
 * Shows policy documents and Excel uploads in a consistent, visually appealing table UI.
 */
function DocumentManager() {
  const [excelDocs, setExcelDocs] = useState([]);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [filter, setFilter] = useState('');
  const [sortBy, setSortBy] = useState('uploaded_at');
  const [sortDir, setSortDir] = useState('desc');
  const [previewSheet, setPreviewSheet] = useState(null);
  const [showMapper, setShowMapper] = useState(false);
  const [mapperData, setMapperData] = useState(null);

  // Fetch Excel uploads
  const fetchExcelDocs = async () => {
    setExcelLoading(true);
    setExcelError('');
    try {
      const token = localStorage.getItem('accessToken');
      const response = await apiFetch('/api/excel/', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch Excel uploads');
      const data = await response.json();
      setExcelDocs(data);
    } catch (err) {
      setExcelError('Error fetching Excel uploads');
    }
    setExcelLoading(false);
  };

  useEffect(() => {
    fetchExcelDocs();
  }, []);

  // Sorting and filtering
  const sortedDocs = excelDocs
    .filter(doc =>
      doc.filename.toLowerCase().includes(filter.toLowerCase()) ||
      (doc.status && doc.status.toLowerCase().includes(filter.toLowerCase()))
    )
    .slice()
    .sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'filename') cmp = a.filename.localeCompare(b.filename);
      else if (sortBy === 'uploaded_at') cmp = new Date(a.uploaded_at) - new Date(b.uploaded_at);
      else if (sortBy === 'status') cmp = (a.status || '').localeCompare(b.status || '');
      else if (sortBy === 'sheet_count') cmp = a.sheet_count - b.sheet_count;
      if (sortDir === 'desc') cmp = -cmp;
      return cmp;
    });

  // Upload handlers
  const handleUploadSuccess = () => {
    setShowUpload(false);
    setUploadSuccess('Upload successful');
    setUploadError('');
    fetchExcelDocs();
  };
  const handleUploadError = (msg) => {
    setUploadError(msg || 'Upload failed');
    setUploadSuccess('');
  };

  // Actions
  const handlePreview = (sheet) => {
    setPreviewSheet(sheet);
  };
  const handleClosePreview = () => {
    setPreviewSheet(null);
  };
  const handleMap = (sheet, doc) => {
    setMapperData({
      columns: sheet.columns,
      preview: sheet.preview,
      filePath: doc.filename, // Adjust if backend returns file path
      sheetName: sheet.sheet_name
    });
    setShowMapper(true);
  };
  const handleCloseMapper = () => {
    setShowMapper(false);
    setMapperData(null);
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
      <h2>Document Management</h2>
      <section style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        <h3>Policy Documents</h3>
        <PolicyManager />
      </section>
      <section style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3>Excel Documents</h3>
          <button onClick={() => setShowUpload(true)}>Upload Excel</button>
        </div>
        {uploadSuccess && <div style={{ color: 'green' }}>{uploadSuccess}</div>}
        {uploadError && <div style={{ color: 'red' }}>{uploadError}</div>}
        <div style={{ margin: '16px 0' }}>
          <input
            type="text"
            placeholder="Search by filename or status"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ padding: '6px', width: '250px', marginRight: '10px' }}
          />
          <button onClick={fetchExcelDocs}>Refresh</button>
        </div>
        {excelError && <div className="error-message">{excelError}</div>}
        {excelLoading ? (
          <div>Loading...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
            <thead>
              <tr>
                {renderHeader('Filename', 'filename')}
                {renderHeader('Uploaded', 'uploaded_at')}
                {renderHeader('Status', 'status')}
                {renderHeader('Sheets', 'sheet_count')}
                <th>Error</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedDocs.map(doc => (
                <tr
                  key={doc.id}
                  style={{
                    background: doc.status === 'Error'
                      ? '#ffeaea'
                      : doc.status === 'Pending'
                        ? '#fffbe6'
                        : '#eaffea',
                    borderBottom: '1px solid #eee'
                  }}
                >
                  <td>{doc.filename}</td>
                  <td>{doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : ''}</td>
                  <td>
                    <span
                      style={{
                        color:
                          doc.status === 'Error'
                            ? 'red'
                            : doc.status === 'Pending'
                              ? '#b59a00'
                              : 'green',
                        fontWeight: 'bold'
                      }}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td>{doc.sheet_count}</td>
                  <td style={{ color: 'red', fontSize: '0.95em' }}>
                    {doc.error_message}
                  </td>
                  <td>
                    {doc.sheets.map(sheet => (
                      <span key={sheet.id} style={{ marginRight: 8 }}>
                        <button onClick={() => handlePreview(sheet)}>Preview</button>
                        <button onClick={() => handleMap(sheet, doc)}>Map</button>
                      </span>
                    ))}
                    <button
                      style={{ marginLeft: 8, color: 'white', background: 'red', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}
                      onClick={async () => {
                        if (window.confirm(`Delete document "${doc.filename}"? This cannot be undone.`)) {
                          try {
                            const token = localStorage.getItem('accessToken');
                            const response = await apiFetch(`/api/excel/${doc.id}`, {
                              method: 'DELETE',
                              headers: { 'Authorization': `Bearer ${token}` }
                            });
                            if (!response.ok) {
                              const data = await response.json();
                              alert(data.error || 'Failed to delete document');
                            } else {
                              fetchExcelDocs();
                            }
                          } catch (err) {
                            alert('Failed to delete document');
                          }
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {/* Excel Upload Modal */}
      {showUpload && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.4)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={() => setShowUpload(false)}
        >
          <div
            style={{
              background: '#fff', padding: '24px', borderRadius: '8px',
              minWidth: '350px', boxShadow: '0 2px 16px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <ExcelUpload
              onSuccess={handleUploadSuccess}
              onError={handleUploadError}
            />
            <button onClick={() => setShowUpload(false)} style={{ marginTop: '16px' }}>
              Close
            </button>
          </div>
        </div>
      )}
      {/* Excel Sheet Preview Modal */}
      {previewSheet && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.4)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={handleClosePreview}
        >
          <div
            style={{
              background: '#fff', padding: '24px', borderRadius: '8px',
              maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 2px 16px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3>Sheet: {previewSheet.sheet_name}</h3>
            <strong>Columns:</strong> {previewSheet.columns.join(', ')}
            <br />
            <strong>Preview (first 5 rows):</strong>
            <pre style={{ background: '#f7f7f7', padding: '0.5rem', borderRadius: '4px' }}>
              {JSON.stringify(previewSheet.preview, null, 2)}
            </pre>
            <button onClick={handleClosePreview} style={{ marginTop: '16px' }}>
              Close
            </button>
          </div>
        </div>
      )}
      {/* Excel Column Mapper Modal */}
      {showMapper && mapperData && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.4)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onClick={handleCloseMapper}
        >
          <div
            style={{
              background: '#fff', padding: '24px', borderRadius: '8px',
              maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 2px 16px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <ExcelColumnMapper
              columns={mapperData.columns}
              preview={mapperData.preview}
              filePath={mapperData.filePath}
              sheetName={mapperData.sheetName}
              onRestart={handleCloseMapper}
            />
            <button onClick={handleCloseMapper} style={{ marginTop: '16px' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentManager;