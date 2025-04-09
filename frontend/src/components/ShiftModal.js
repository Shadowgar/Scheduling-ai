// frontend/src/components/ShiftModal.js
import React, { useState, useEffect } from 'react';
import './ShiftModal.css'; // Ensure you have styles for the modal
import { apiFetch } from '../utils/api';

const ShiftModal = ({ isOpen, onClose, cellData, onShiftUpdate, selectedCells = [] }) => {
    // Existing state declarations...
    const [employeeId, setEmployeeId] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [notes, setNotes] = useState('');
    const [cellText, setCellText] = useState('');

    // State for component logic
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [employeesList, setEmployeesList] = useState([]); // To populate dropdown
    const [isApplyingToMultiple, setIsApplyingToMultiple] = useState(false);

    // Determine if editing an existing shift
    const isEditMode = !!cellData?.shift?.id;
    // Determine if we have multiple cells selected
    const hasMultipleSelection = Array.isArray(selectedCells) && selectedCells.length > 1;

    // Format date/time for input[type=datetime-local] (needs YYYY-MM-DDTHH:mm)
    const formatDateTimeLocal = (d) => {
        if (!d) return '';
        try {
            const dateObj = new Date(d);
            // Adjust for timezone offset to display correctly in local time input
            dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
            return dateObj.toISOString().slice(0, 16);
        } catch (e) {
            console.error("Error formatting date for input:", e);
            return ''; // Return empty string on error
        }
    };

    // Fetch employees for dropdown when modal opens
    useEffect(() => {
        // Existing employee fetching code...
        const fetchEmployees = async () => {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                setError("Authentication required to load employees.");
                setEmployeesList([]);
                return;
            }
            try {
                const response = await apiFetch('/api/admin/employees', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.status === 401 || response.status === 403) {
                    throw new Error('Authorization failed fetching employees.');
                }
                if (!response.ok) {
                    throw new Error(`Failed to fetch employees (${response.status})`);
                }
                const data = await response.json();
                setEmployeesList(data.sort((a, b) => a.name.localeCompare(b.name)));
                setError(null); // Clear previous errors on success
            } catch (err) {
                console.error("Error loading employees:", err);
                setError(`Error loading employees: ${err.message}`);
                setEmployeesList([]); // Set empty on error
            }
        };
        if (isOpen) {
            fetchEmployees();
        }
    }, [isOpen]);

    // Populate form when cellData changes
    useEffect(() => {
        if (isOpen && cellData) {
            const shift = cellData.shift;
            const date = cellData.date; // Get the date from cellData

            // Set default times based on the clicked date if creating new shift
            const defaultStart = new Date(date);
            defaultStart.setHours(8, 0, 0, 0); // Default 8 AM
            const defaultEnd = new Date(date);
            defaultEnd.setHours(16, 0, 0, 0); // Default 4 PM

            setEmployeeId(shift?.employee_id || cellData.employeeId || '');
            setStartTime(formatDateTimeLocal(shift?.start_time || defaultStart));
            setEndTime(formatDateTimeLocal(shift?.end_time || defaultEnd));
            setNotes(shift?.notes || '');
            setCellText(shift?.cell_text || '');

            setError(null);
            setIsSaving(false);
            setIsApplyingToMultiple(false);

        } else {
            // Reset form if modal is closed or no cellData
            setEmployeeId('');
            setStartTime('');
            setEndTime('');
            setNotes('');
            setCellText('');
            setError(null);
            setIsSaving(false);
            setIsApplyingToMultiple(false);
        }
    }, [isOpen, cellData]);

    // --- Handle Form Submission (Save/Update) ---
    const handleSave = async (e) => {
        e.preventDefault();
        setError(null);
        setIsSaving(true);
        const token = localStorage.getItem('accessToken');

        if (!token) {
            setError("Authentication required to save.");
            setIsSaving(false);
            return;
        }

        // Basic validation
        if (!employeeId) { setError("Please select an employee."); setIsSaving(false); return; }
        if (!startTime || !endTime) { setError("Start and End times are required."); setIsSaving(false); return; }
        try {
            if (new Date(endTime) <= new Date(startTime)) {
                setError("End time must be after start time."); setIsSaving(false); return;
            }
        } catch (dateError) {
            setError("Invalid start or end time format."); setIsSaving(false); return;
        }

        // Prepare payload for API
        const shiftPayload = {
            employee_id: parseInt(employeeId, 10),
            start_time: new Date(startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            notes: notes,
            cell_text: cellText || null,
        };

        const url = isEditMode ? `/api/shifts/${cellData.shift.id}` : '/api/shifts';
        const method = isEditMode ? 'PUT' : 'POST';

        console.log(`Saving shift (${method} to ${url}) Payload:`, shiftPayload);

        try {
            const response = await apiFetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(shiftPayload)
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || `Failed to ${isEditMode ? 'update' : 'create'} shift (${response.status})`);
            }

            console.log(`Shift ${isEditMode ? 'updated' : 'created'} successfully:`, result);
            onShiftUpdate();
            onClose();

        } catch (err) {
            console.error(`Error saving shift:`, err);
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // --- Handle Quick Fill ---
    const handleQuickFill = async (shiftType) => {
        setIsApplyingToMultiple(true);
        setError(null);
        setIsSaving(true);
        
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setError("Authentication required to save.");
            setIsSaving(false);
            setIsApplyingToMultiple(false);
            return;
        }

        if (!employeeId) {
            setError("Please select an employee first.");
            setIsSaving(false);
            setIsApplyingToMultiple(false);
            return;
        }

        // Determine which cells to apply to
        const cellsToProcess = hasMultipleSelection ? selectedCells : [cellData];
        if (!cellsToProcess || cellsToProcess.length === 0) {
            setError("No cells selected to apply shifts.");
            setIsSaving(false);
            setIsApplyingToMultiple(false);
            return;
        }

        // Set up shift times based on type
        let successCount = 0;
        let errorCount = 0;
        
        for (const cell of cellsToProcess) {
            if (!cell || !cell.date) continue;
            
            const date = cell.date;
            let start, end;

            if (shiftType === 'morning') {
                start = new Date(date);
                start.setHours(7, 0, 0, 0);
                end = new Date(date);
                end.setHours(15, 0, 0, 0);
            } else if (shiftType === 'afternoon') {
                start = new Date(date);
                start.setHours(15, 0, 0, 0);
                end = new Date(date);
                end.setHours(23, 0, 0, 0);
            } else if (shiftType === 'night') {
                start = new Date(date);
                start.setHours(23, 0, 0, 0);
                end = new Date(date);
                end.setDate(end.getDate() + 1); // next day
                end.setHours(7, 0, 0, 0);
            } else {
                continue; // Skip invalid shift type
            }

            const shiftPayload = {
                employee_id: parseInt(employeeId, 10),
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                notes: notes,
                cell_text: cellText || null,
            };

            try {
                // If there's already a shift for this cell and it's being edited, use PUT
                const isExistingShift = cell.shift && cell.shift.id;
                const url = isExistingShift ? `/api/shifts/${cell.shift.id}` : '/api/shifts';
                const method = isExistingShift ? 'PUT' : 'POST';

                console.log(`${method} shift for ${cell.employeeName || employeeId} on ${date}`, shiftPayload);
                
                const response = await apiFetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(shiftPayload)
                });

                if (response.ok) {
                    successCount++;
                } else {
                    const result = await response.json().catch(() => ({}));
                    console.error(`Error applying shift to ${date}:`, result.error || response.status);
                    errorCount++;
                }
            } catch (err) {
                console.error(`Exception applying shift to ${date}:`, err);
                errorCount++;
            }
        }

        if (successCount > 0) {
            console.log(`Successfully applied ${shiftType} shift to ${successCount} cells`);
            onShiftUpdate();
            onClose();
        } else if (errorCount > 0) {
            setError(`Failed to apply shifts. ${errorCount} errors occurred.`);
            setIsSaving(false);
            setIsApplyingToMultiple(false);
        } else {
            setError("No shifts were applied.");
            setIsSaving(false);
            setIsApplyingToMultiple(false);
        }
    };

    // --- Handle Shift Deletion ---
    const handleDelete = async () => {
        if (!isEditMode) return;

        if (window.confirm("Are you sure you want to delete this shift? This action cannot be undone.")) {
            setError(null);
            setIsSaving(true);
            const token = localStorage.getItem('accessToken');
            if (!token) { setError("Authentication required."); setIsSaving(false); return; }

            const url = `/api/shifts/${cellData.shift.id}`;
            console.log(`Deleting shift: ${url}`);

            try {
                const response = await apiFetch(url, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.status === 204 || response.ok) {
                    console.log(`Shift deleted successfully.`);
                    onShiftUpdate();
                    onClose();
                } else {
                    const result = await response.json().catch(() => ({}));
                    throw new Error(result.error || `Failed to delete shift (${response.status})`);
                }
            } catch (err) {
                console.error(`Error deleting shift:`, err);
                setError(err.message);
            } finally {
                setIsSaving(false);
            }
        }
    };

    // Render nothing if modal is not open
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button className="modal-close-button" onClick={onClose} disabled={isSaving}>×</button>

                <h3>{isEditMode ? 'Edit Shift' : 'Add Shift'}</h3>

                <p className="modal-context">
                    For: <strong>{cellData?.employeeName || 'Unknown Employee'}</strong> <br/>
                    Date: <strong>{cellData?.date ? new Date(cellData.date).toLocaleDateString() : 'Unknown Date'}</strong>
                    {hasMultipleSelection && (
                        <><br/>Multiple Selection: <strong>{selectedCells.length} cells selected</strong></>
                    )}
                </p>

                {error && <p className="modal-error">Error: {error}</p>}

                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label htmlFor="employeeId">Employee:</label>
                        <select
                            id="employeeId"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            required
                            disabled={isSaving || employeesList.length === 0}
                        >
                            <option value="" disabled>Select Employee</option>
                            {employeesList.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                            {employeesList.length === 0 && !error && <option disabled>Loading employees...</option>}
                            {employeesList.length === 0 && error && <option disabled>Could not load employees</option>}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="startTime">Start Time:</label>
                        <input
                            type="datetime-local"
                            id="startTime"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            required
                            disabled={isSaving}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="endTime">End Time:</label>
                        <input
                            type="datetime-local"
                            id="endTime"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            required
                            disabled={isSaving}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="cellText">Cell Display Text (Optional):</label>
                        <input
                            type="text"
                            id="cellText"
                            value={cellText}
                            onChange={(e) => setCellText(e.target.value)}
                            maxLength="20"
                            placeholder="e.g., TRNG, RCall, 1st"
                            disabled={isSaving}
                        />
                        <small>Short text shown directly on the calendar grid (max 20 chars).</small>
                    </div>

                    <div className="form-group">
                        <label htmlFor="notes">Notes (Optional):</label>
                        <textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows="3"
                            placeholder="Longer details (triggers corner mark)"
                            disabled={isSaving}
                        />
                        <small>Presence indicated by a corner mark on the calendar.</small>
                    </div>

                    <div className="modal-actions">
                        <button type="submit" className="save-button" disabled={isSaving}>
                            {isSaving && !isApplyingToMultiple ? 'Saving...' : (isEditMode ? 'Update Shift' : 'Save Shift')}
                        </button>
                        {isEditMode && (
                            <button
                                type="button"
                                className="delete-button"
                                onClick={handleDelete}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Deleting...' : 'Delete Shift'}
                            </button>
                        )}
                        <button type="button" className="cancel-button" onClick={onClose} disabled={isSaving}>
                            Cancel
                        </button>
                    </div>

                    <div className="quick-fill-section">
                        <h4>Quick Fill{hasMultipleSelection ? ` (${selectedCells.length} cells)` : ''}</h4>
                        <div className="quick-fill-buttons">
                            <button 
                                type="button" 
                                onClick={() => handleQuickFill('morning')} 
                                disabled={isSaving}
                                className="quick-fill-button morning"
                            >
                                {isSaving && isApplyingToMultiple ? 'Applying...' : 'Morning (7 AM - 3 PM)'}
                            </button>
                            <button 
                                type="button" 
                                onClick={() => handleQuickFill('afternoon')} 
                                disabled={isSaving}
                                className="quick-fill-button afternoon"
                            >
                                {isSaving && isApplyingToMultiple ? 'Applying...' : 'Afternoon (3 PM - 11 PM)'}
                            </button>
                            <button 
                                type="button" 
                                onClick={() => handleQuickFill('night')} 
                                disabled={isSaving}
                                className="quick-fill-button night"
                            >
                                {isSaving && isApplyingToMultiple ? 'Applying...' : 'Night (11 PM - 7 AM)'}
                            </button>
                        </div>
                        {hasMultipleSelection && (
                            <p className="multi-selection-note">
                                <small>These buttons will apply the selected shift to all {selectedCells.length} selected cells.</small>
                            </p>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShiftModal;
