// frontend/src/components/ShiftModal.js
import React, { useState, useEffect, useMemo } from 'react';
import './ShiftModal.css';

// ... (helpers: formatModalDate, formatDateTimeLocal, formatISOForBackend remain the same) ...
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
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().substring(0, 16);
};

// Helper to format date/time string from input to ISO 8601 for backend
const formatISOForBackend = (dateTimeLocalString) => {
    if (!dateTimeLocalString) return null;
    try {
        const date = new Date(dateTimeLocalString);
        if (isNaN(date)) return null;
        return date.toISOString();
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
        return shift?.start_time ? formatDateTimeLocal(new Date(shift.start_time))
               : formatDateTimeLocal(new Date(baseDate.setHours(7, 0, 0, 0)));
    }, [date, shift?.start_time]);

    const defaultEndTime = useMemo(() => {
         const baseDate = (date instanceof Date && !isNaN(date)) ? new Date(date) : new Date();
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
        if (endTimeISO <= startTimeISO) {
             setModalError("End time must be after start time.");
             setIsSaving(false); return;
        }

        const payload = { employee_id: employeeId, start_time: startTimeISO, end_time: endTimeISO, notes: notes };
        const isUpdate = shift?.id;
        const url = isUpdate ? `http://127.0.0.1:5000/api/shifts/${shift.id}` : 'http://127.0.0.1:5000/api/shifts';
        const method = isUpdate ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify(payload),
            });

            // *** ENHANCED ERROR HANDLING ***
            if (!response.ok) {
                let errorMsg = `Error: ${response.status} ${response.statusText}`; // Default error
                try {
                    // Attempt to parse specific error message from backend JSON response
                    const errorJson = await response.json();
                    // Use the specific 'error' field if available, otherwise stringify the whole JSON
                    errorMsg = errorJson.error || JSON.stringify(errorJson);
                } catch (parseError) {
                    // If response is not JSON or empty, stick with the status text
                    console.warn("Could not parse error response as JSON:", parseError);
                }
                // Throw the specific error message to be caught below
                throw new Error(errorMsg);
            }
            // *** END ENHANCED ERROR HANDLING ***

            onShiftUpdate();
            onClose();

        } catch (error) { // Catch errors from fetch() itself or thrown above
            console.error(`Error ${isUpdate ? 'updating' : 'creating'} shift:`, error);
            // Display the specific error message (either from backend or fetch failure)
            setModalError(`Failed to save shift: ${error.message}`);
        } finally {
             setIsSaving(false);
        }
    };

    // --- Handle Delete ---
    const handleDelete = async () => {
        if (!shift?.id) { setModalError("Cannot delete unsaved shift."); return; }

        const displayDate = (date instanceof Date && !isNaN(date)) ? date : new Date();
        if (window.confirm(`Are you sure you want to delete the shift for ${employeeName} on ${formatModalDate(displayDate)}?`)) {
            setModalError(null);
            setIsSaving(true);
            const url = `http://127.0.0.1:5000/api/shifts/${shift.id}`;

            try {
                const response = await fetch(url, { method: 'DELETE' });

                // *** ENHANCED ERROR HANDLING ***
                // Check for success (204 No Content is ideal, but 200 OK is also acceptable)
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
                // *** END ENHANCED ERROR HANDLING ***

                onShiftUpdate();
                onClose();

            } catch (error) {
                 console.error("Error deleting shift:", error);
                 setModalError(`Failed to delete shift: ${error.message}`);
            } finally {
                 setIsSaving(false);
            }
        }
    };

    // --- Render ---
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

                    {modalError && <div className="modal-error">{modalError}</div>}

                    {/* Key prop forces re-render and use of new defaultValues when cellData changes */}
                    <form key={shift?.id || employeeId + '-' + date?.toISOString()} onSubmit={handleSave}>
                        <div className="form-group">
                            <label htmlFor="start-time">Start Time:</label>
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