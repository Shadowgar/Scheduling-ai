// frontend/src/components/ShiftModal.js
import React, { useState, useEffect, useMemo } from 'react';
import './ShiftModal.css';

// Helper functions (formatModalDate, formatDateTimeLocal, formatISOForBackend) remain the same...
// Helper to format date for display in modal title
const formatModalDate = (date) => {
    if (!(date instanceof Date) || isNaN(date)) return "Invalid Date";
    return date.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
};

// Helper to format Date object to YYYY-MM-DDTHH:MM required by datetime-local input
const formatDateTimeLocal = (date) => {
    if (!(date instanceof Date) || isNaN(date)) return '';
    // Simple conversion, assumes user's local time is intended
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};


// Helper to format date/time string from input to ISO 8601 for backend
const formatISOForBackend = (dateTimeLocalString) => {
    if (!dateTimeLocalString) return null;
    try {
        // Directly creating a Date from datetime-local string assumes local timezone
        // Sending as ISO string will include timezone offset or Z (UTC)
        const date = new Date(dateTimeLocalString);
        if (isNaN(date)) return null;
        return date.toISOString(); // Send in UTC format
    } catch (e) {
        console.error("Error parsing date input:", e);
        return null;
    }
};


const ShiftModal = ({ isOpen, onClose, cellData, onShiftUpdate }) => {
    const [modalError, setModalError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const { employeeId, employeeName, date, shift } = cellData || {};

    // Calculate default values using useMemo
    const defaultStartTime = useMemo(() => {
        const baseDate = (date instanceof Date && !isNaN(date)) ? new Date(date) : new Date();
        // If shift exists, use its start time, otherwise default to 7 AM of the cell's date
        return shift?.start_time ? formatDateTimeLocal(new Date(shift.start_time))
               : formatDateTimeLocal(new Date(baseDate.setHours(7, 0, 0, 0)));
    }, [date, shift?.start_time]);

    const defaultEndTime = useMemo(() => {
         const baseDate = (date instanceof Date && !isNaN(date)) ? new Date(date) : new Date();
         // If shift exists, use its end time, otherwise default to 3 PM (15:00) of the cell's date
         return shift?.end_time ? formatDateTimeLocal(new Date(shift.end_time))
              : formatDateTimeLocal(new Date(baseDate.setHours(15, 0, 0, 0)));
    }, [date, shift?.end_time]);

    const defaultNotes = useMemo(() => shift?.notes || '', [shift?.notes]);

    // Effect to clear error when modal opens or cellData changes
    useEffect(() => {
        if (isOpen) {
            setModalError(null);
            setIsSaving(false);
        }
    }, [isOpen, cellData]);


    if (!isOpen || !cellData) {
        return null;
    }

    // --- Handle Save/Update ---
    const handleSave = async (e) => {
        e.preventDefault();
        setModalError(null);
        setIsSaving(true);

        // *** FIX: Get Token ***
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setModalError("Authentication token not found. Please log in again.");
            setIsSaving(false);
            return;
        }

        const form = e.target;
        const startTimeLocal = form.elements['start_time'].value;
        const endTimeLocal = form.elements['end_time'].value;
        const notes = form.elements['notes'].value;

        if (!startTimeLocal || !endTimeLocal) {
            setModalError("Start and End times are required.");
            setIsSaving(false); return;
        }
        const startTimeISO = formatISOForBackend(startTimeLocal);
        const endTimeISO = formatISOForBackend(endTimeLocal);

        if (!startTimeISO || !endTimeISO) {
             setModalError("Invalid date format entered. Please use the date picker.");
             setIsSaving(false); return;
        }
        if (new Date(endTimeISO) <= new Date(startTimeISO)) { // Compare Date objects
             setModalError("End time must be after start time.");
             setIsSaving(false); return;
        }

        const payload = { employee_id: employeeId, start_time: startTimeISO, end_time: endTimeISO, notes: notes };
        const isUpdate = shift?.id;
        // *** FIX: Use Relative URL ***
        const url = isUpdate ? `/api/shifts/${shift.id}` : '/api/shifts';
        const method = isUpdate ? 'PUT' : 'POST';

        console.log(`Saving shift. Method: ${method}, URL: ${url}, Payload:`, payload); // Log before fetch

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    // *** FIX: Add Authorization Header ***
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload),
            });

            // Enhanced error handling remains the same
            if (!response.ok) {
                let errorMsg = `Error: ${response.status} ${response.statusText}`;
                try {
                    const errorJson = await response.json();
                    errorMsg = errorJson.error || JSON.stringify(errorJson);
                } catch (parseError) {
                    console.warn("Could not parse error response as JSON:", parseError);
                }
                throw new Error(errorMsg);
            }

            console.log("Shift saved successfully."); // Log success
            onShiftUpdate(); // Refresh data in parent
            onClose(); // Close modal

        } catch (error) {
            console.error(`Error ${isUpdate ? 'updating' : 'creating'} shift:`, error);
            setModalError(`Failed to save shift: ${error.message}`);
        } finally {
             setIsSaving(false);
        }
    };

    // --- Handle Delete ---
    const handleDelete = async () => {
        if (!shift?.id) { setModalError("Cannot delete unsaved shift."); return; }

        // *** FIX: Get Token ***
        const token = localStorage.getItem('accessToken');
        if (!token) {
            setModalError("Authentication token not found. Please log in again.");
            return;
        }

        const displayDate = (date instanceof Date && !isNaN(date)) ? date : new Date();
        if (window.confirm(`Are you sure you want to delete the shift for ${employeeName} on ${formatModalDate(displayDate)}?`)) {
            setModalError(null);
            setIsSaving(true);
            // *** FIX: Use Relative URL ***
            const url = `/api/shifts/${shift.id}`;

            console.log(`Deleting shift. URL: ${url}`); // Log before fetch

            try {
                const response = await fetch(url, {
                    method: 'DELETE',
                    // *** FIX: Add Authorization Header ***
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                // Enhanced error handling remains the same
                if (!response.ok && response.status !== 204) {
                     let errorMsg = `Error: ${response.status} ${response.statusText}`;
                     try {
                         const errorJson = await response.json();
                         errorMsg = errorJson.error || JSON.stringify(errorJson);
                     } catch (parseError) {
                         console.warn("Could not parse error response as JSON:", parseError);
                     }
                     throw new Error(errorMsg);
                }

                console.log("Shift deleted successfully."); // Log success
                onShiftUpdate(); // Refresh data in parent
                onClose(); // Close modal

            } catch (error) {
                 console.error("Error deleting shift:", error);
                 setModalError(`Failed to delete shift: ${error.message}`);
            } finally {
                 setIsSaving(false);
            }
        }
    };

    // --- Render ---
    // JSX remains largely the same, ensure defaultValues are used correctly
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{shift ? 'Edit' : 'Create'} Shift</h2>
                    <button onClick={onClose} className="close-button" disabled={isSaving}>&times;</button>
                </div>

                <div className="modal-body">
                    {employeeName && date && (
                        <>
                            <p><strong>Employee:</strong> {employeeName}</p>
                            <p><strong>Date:</strong> {formatModalDate(date)}</p>
                        </>
                    )}

                    {modalError && <div className="modal-error error-message">{modalError}</div>} {/* Added error-message class */}

                    {/* Key prop forces re-render and use of new defaultValues when cellData changes */}
                    <form key={shift?.id || `${employeeId}-${date?.toISOString()}`} onSubmit={handleSave}>
                        <div className="form-group">
                            <label htmlFor="start-time">Start Time:</label>
                            {/* Use defaultValue for uncontrolled input tied to key re-render */}
                            <input type="datetime-local" id="start-time" name="start_time" defaultValue={defaultStartTime} required disabled={isSaving} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="end-time">End Time:</label>
                            <input type="datetime-local" id="end-time" name="end_time" defaultValue={defaultEndTime} required disabled={isSaving} />
                        </div>
                         <div className="form-group">
                            <label htmlFor="notes">Notes:</label>
                            <textarea id="notes" name="notes" defaultValue={defaultNotes} rows="3" disabled={isSaving}></textarea>
                        </div>

                        <div className="modal-actions">
                             <button type="submit" className="save-button" disabled={isSaving}>
                                {isSaving ? 'Saving...' : (shift ? 'Update Shift' : 'Create Shift')}
                            </button>
                            {shift?.id && (
                                <button type="button" onClick={handleDelete} className="delete-button" disabled={isSaving}>
                                    {isSaving ? 'Deleting...' : 'Delete Shift'}
                                </button>
                            )}
                             <button type="button" onClick={onClose} className="cancel-button" disabled={isSaving}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ShiftModal;