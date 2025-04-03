// frontend/src/components/ShiftModal.js
import React, { useState, useEffect } from 'react';
import './ShiftModal.css'; // Ensure you have styles for the modal

const ShiftModal = ({ isOpen, onClose, cellData, onShiftUpdate }) => {
    // State for form fields
    const [employeeId, setEmployeeId] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [notes, setNotes] = useState('');
    // *** ADD STATE FOR NEW FIELD ***
    const [cellText, setCellText] = useState('');

    // State for component logic
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [employeesList, setEmployeesList] = useState([]); // To populate dropdown

    // Determine if editing an existing shift
    const isEditMode = !!cellData?.shift?.id;

    // Fetch employees for dropdown when modal opens
    useEffect(() => {
        const fetchEmployees = async () => {
            const token = localStorage.getItem('accessToken');
            // Prevent fetching if no token
            if (!token) {
                setError("Authentication required to load employees.");
                setEmployeesList([]);
                return;
            }
            try {
                // Use admin endpoint to get all employees suitable for assignment
                const response = await fetch('/api/admin/employees', {
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
    }, [isOpen]); // Dependency: only run when isOpen changes


    // Populate form when cellData changes (modal opens or cell selection changes)
    useEffect(() => {
        if (isOpen && cellData) {
            const shift = cellData.shift;
            const date = cellData.date; // Get the date from cellData

            // Set default times based on the clicked date if creating new shift
            const defaultStart = new Date(date);
            defaultStart.setHours(8, 0, 0, 0); // Default 8 AM
            const defaultEnd = new Date(date);
            defaultEnd.setHours(16, 0, 0, 0); // Default 4 PM

            // Format date/time for input[type=datetime-local] (needs YYYY-MM-DDTHH:mm)
            const formatDateTimeLocal = (d) => {
                if (!d) return '';
                try {
                    const dateObj = new Date(d);
                    // Adjust for timezone offset to display correctly in local time input
                    // This ensures the time shown matches the user's local timezone interpretation of the UTC time
                    dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
                    return dateObj.toISOString().slice(0, 16);
                } catch (e) {
                    console.error("Error formatting date for input:", e);
                    return ''; // Return empty string on error
                }
            };

            setEmployeeId(shift?.employee_id || cellData.employeeId || ''); // Prefer existing shift emp, fallback to cell emp
            setStartTime(formatDateTimeLocal(shift?.start_time || defaultStart));
            setEndTime(formatDateTimeLocal(shift?.end_time || defaultEnd));
            setNotes(shift?.notes || '');
            // *** SET NEW FIELD STATE ***
            setCellText(shift?.cell_text || ''); // Populate from existing shift or default empty

            setError(null); // Clear previous errors when opening/re-opening
            setIsSaving(false); // Reset saving state

        } else {
            // Reset form if modal is closed or no cellData
            setEmployeeId('');
            setStartTime('');
            setEndTime('');
            setNotes('');
            setCellText(''); // Reset new field
            setError(null);
            setIsSaving(false);
        }
    }, [isOpen, cellData]); // Dependencies: run when modal opens or cell data changes

    // --- Handle Form Submission (Save/Update) ---
    const handleSave = async (e) => {
        e.preventDefault();
        setError(null); // Clear previous errors
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
            // Convert local datetime-local string back to ISO 8601 UTC string for backend
            start_time: new Date(startTime).toISOString(),
            end_time: new Date(endTime).toISOString(),
            notes: notes, // Send notes content
            // *** INCLUDE NEW FIELD IN PAYLOAD ***
            cell_text: cellText || null, // Send the cellText state, or null if empty
        };

        const url = isEditMode ? `/api/shifts/${cellData.shift.id}` : '/api/shifts';
        const method = isEditMode ? 'PUT' : 'POST';

        console.log(`Saving shift (${method} to ${url}) Payload:`, shiftPayload);

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(shiftPayload)
            });

            const result = await response.json();
            if (!response.ok) {
                // Use error message from backend if available
                throw new Error(result.error || `Failed to ${isEditMode ? 'update' : 'create'} shift (${response.status})`);
            }

            console.log(`Shift ${isEditMode ? 'updated' : 'created'} successfully:`, result);
            onShiftUpdate(); // Trigger refresh in parent component (ScheduleCalendar)
            onClose(); // Close modal on success

        } catch (err) {
            console.error(`Error saving shift:`, err);
            setError(err.message); // Display error message in the modal
        } finally {
            setIsSaving(false); // Re-enable buttons
        }
    };

    const handleQuickFill = (shiftType) => {
        const date = cellData.date;
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
            end.setHours(7, 0, 0, 0);
            end.setDate(end.getDate() + 1); // next day
        }

        const formatDateTimeLocal = (d) => {
            if (!d) return '';
            try {
                const dateObj = new Date(d);
                // Adjust for timezone offset to display correctly in local time input
                // This ensures the time shown matches the user's local timezone interpretation of the UTC time
                dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
                return dateObj.toISOString().slice(0, 16);
            } catch (e) {
                console.error("Error formatting date for input:", e);
                return ''; // Return empty string on error
            }
        };

        setStartTime(formatDateTimeLocal(start));
        setEndTime(formatDateTimeLocal(end));
    };

    // --- Handle Shift Deletion ---
    const handleDelete = async () => {
         if (!isEditMode) return; // Should not happen, but safeguard

         // Confirmation dialog
         if (window.confirm("Are you sure you want to delete this shift? This action cannot be undone.")) {
             setError(null);
             setIsSaving(true); // Use saving state to disable buttons during delete
             const token = localStorage.getItem('accessToken');
             if (!token) { setError("Authentication required."); setIsSaving(false); return; }

             const url = `/api/shifts/${cellData.shift.id}`;
             console.log(`Deleting shift: ${url}`);

             try {
                 const response = await fetch(url, {
                     method: 'DELETE',
                     headers: { 'Authorization': `Bearer ${token}` }
                 });

                 // Check for successful deletion (200 OK or 204 No Content)
                 if (response.status === 204 || response.ok) {
                     console.log(`Shift deleted successfully.`);
                     onShiftUpdate(); // Trigger refresh in parent
                     onClose(); // Close modal
                 } else {
                      // Try to parse error message from backend
                      const result = await response.json().catch(() => ({}));
                      throw new Error(result.error || `Failed to delete shift (${response.status})`);
                 }
             } catch (err) {
                  console.error(`Error deleting shift:`, err);
                  setError(err.message); // Show error in modal
             } finally {
                 setIsSaving(false); // Re-enable buttons
             }
         }
    };


    // Render nothing if modal is not open
    if (!isOpen) return null;

    // Render the modal structure
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                {/* Close button */}
                <button className="modal-close-button" onClick={onClose} disabled={isSaving}>×</button>

                {/* Title */}
                <h3>{isEditMode ? 'Edit Shift' : 'Add Shift'}</h3>

                {/* Context Info */}
                <p className="modal-context">
                    For: <strong>{cellData?.employeeName || 'Unknown Employee'}</strong> <br/>
                    Date: <strong>{cellData?.date ? new Date(cellData.date).toLocaleDateString() : 'Unknown Date'}</strong>
                </p>

                {/* Error Display */}
                {error && <p className="modal-error">Error: {error}</p>}

                {/* Form */}
                <form onSubmit={handleSave}>
                    {/* Employee Select */}
                    <div className="form-group">
                        <label htmlFor="employeeId">Employee:</label>
                        <select
                            id="employeeId"
                            value={employeeId}
                            onChange={(e) => setEmployeeId(e.target.value)}
                            required
                            disabled={isSaving || employeesList.length === 0} // Disable if saving or no employees loaded
                        >
                            <option value="" disabled>Select Employee</option>
                            {/* Populate dropdown */}
                            {employeesList.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                            ))}
                             {employeesList.length === 0 && !error && <option disabled>Loading employees...</option>}
                             {employeesList.length === 0 && error && <option disabled>Could not load employees</option>}
                        </select>
                    </div>

                    {/* Start Time */}
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

                    {/* End Time */}
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

                     {/* *** NEW INPUT FIELD FOR CELL TEXT *** */}
                    <div className="form-group">
                        <label htmlFor="cellText">Cell Display Text (Optional):</label>
                        <input
                            type="text"
                            id="cellText"
                            value={cellText}
                            onChange={(e) => setCellText(e.target.value)}
                            maxLength="20" // Match DB length limit
                            placeholder="e.g., TRNG, RCall, 1st"
                            disabled={isSaving}
                        />
                        <small>Short text shown directly on the calendar grid (max 20 chars).</small>
                    </div>

                    {/* Notes Textarea */}
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

                    {/* Action Buttons */}
                    <div className="modal-actions">
                        <button type="submit" className="save-button" disabled={isSaving}>
                            {isSaving ? 'Saving...' : (isEditMode ? 'Update Shift' : 'Save Shift')}
                        </button>
                        {/* Show delete button only in edit mode */}
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

                     {/* Quick Fill Buttons */}
                     <div className="form-group">
                        <label>Quick Fill:</label>
                        <div className="quick-fill-buttons">
                            <button type="button" onClick={() => handleQuickFill('morning')} disabled={isSaving}>Morning (7 AM - 3 PM)</button>
                            <button type="button" onClick={() => handleQuickFill('afternoon')} disabled={isSaving}>Afternoon (3 PM - 11 PM)</button>
                            <button type="button" onClick={() => handleQuickFill('night')} disabled={isSaving}>Night (11 PM - 7 AM)</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShiftModal;
