// frontend/src/components/ScheduleCalendar.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './ScheduleCalendar.css'; // Make sure styles for note-indicator are here
import ShiftModal from './ShiftModal'; // Ensure ShiftModal is imported

// Helper functions
const getDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
};
const formatDateKey = (date) => {
    if (!(date instanceof Date) || isNaN(date)) { return null; }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const getWeekParity = (date, firstDayOfMonth) => {
    const firstDayOfMonthDayOfWeek = firstDayOfMonth.getDay(); // 0=Sun, 6=Sat
    const msPerDay = 1000 * 60 * 60 * 24;
    const startOfWeekMonthStarts = new Date(firstDayOfMonth.getTime() - firstDayOfMonthDayOfWeek * msPerDay);
    const diffInTime = date.getTime() - startOfWeekMonthStarts.getTime();
    const diffInDays = Math.floor(diffInTime / msPerDay);
    const weekNumber = Math.floor(diffInDays / 7);
    return weekNumber % 2 === 0 ? 'even' : 'odd';
};

// Use job title strings for sorting order (lowercase)
const roleOrder = ['supervisor', 'police', 'security']; // Adjust as needed
const todayDateStr = formatDateKey(new Date());

// --- Component Starts ---
const ScheduleCalendar = ({ currentUser }) => {
    // Get the access_role value (e.g., 'supervisor', 'member')
    const userAccessRole = currentUser?.access_role;

    // --- State ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [employees, setEmployees] = useState([]);
    const [shiftLookup, setShiftLookup] = useState(new Map()); // Map<employeeId, Map<dateKey, shiftObject>>
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCellData, setSelectedCellData] = useState(null); // { employeeId, employeeName, date, shift? }

    console.log('[ScheduleCalendar] Rendering. User Role:', userAccessRole);

    // --- Data Fetching Logic (Shifts) ---
    // Fetches shifts for the current month and updates the shiftLookup state
    const fetchShiftData = useCallback(async () => {
        // Reset lookup before fetching
        // setShiftLookup(new Map()); // Maybe better to update selectively? Let's clear for simplicity now.
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1;
        const shiftsApiUrl = `/api/shifts?year=${year}&month=${month}`;
        const token = localStorage.getItem('accessToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) { headers['Authorization'] = `Bearer ${token}`; }
        else {
             // Handle case where token might be needed but missing (optional, depends on API security)
             console.warn("No auth token found for fetching shifts.");
             // setError("Authentication might be required to view shifts."); // Optionally inform user
             // return; // Optionally stop fetching if token is strictly required
        }


        try {
            console.log(`Fetching shifts from: ${shiftsApiUrl}`);
            const shiftResponse = await fetch(shiftsApiUrl, { method: 'GET', headers: headers });

            if (!shiftResponse.ok) {
                let errorDetails = `Shift fetch failed (${shiftResponse.status})`;
                try { const errorJson = await shiftResponse.json(); errorDetails += `: ${errorJson.error || JSON.stringify(errorJson)}`; } catch (parseError) { /* Ignore */ }
                throw new Error(errorDetails);
            }

            const shiftData = await shiftResponse.json();
            console.log(`Received ${shiftData.length} shifts.`);
            const newLookup = new Map();
            shiftData.forEach(shift => {
                // *** Ensure shift object includes cell_text ***
                if (!shift.employee_id || !shift.start_time) {
                    console.warn("Skipping shift with missing employee_id or start_time:", shift);
                    return;
                }
                try {
                    const shiftDate = new Date(shift.start_time);
                    const dateKey = formatDateKey(shiftDate);
                    if (dateKey) {
                        if (!newLookup.has(shift.employee_id)) {
                            newLookup.set(shift.employee_id, new Map());
                        }
                        // Store the entire shift object (including notes and cell_text)
                        newLookup.get(shift.employee_id).set(dateKey, shift);
                    } else {
                         console.warn("Could not generate dateKey for shift:", shift);
                    }
                } catch (e) {
                    console.error("Error processing shift date:", shift.start_time, e);
                }
            });
            setShiftLookup(newLookup); // Update state with the new map
            if (error) setError(null); // Clear previous errors on success
        } catch (fetchError) {
            console.error("Error during shift data fetch:", fetchError);
            setError(`Failed to load shift data: ${fetchError.message}.`);
            setShiftLookup(new Map()); // Clear lookup on error
        }
    }, [currentDate, error]); // Dependencies: re-run if date changes or error state changes (for retry logic)

    // --- Fetch Initial Data (Employees for Schedule View) ---
    // Fetches the list of employees to display on the schedule
    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('accessToken');
        const headers = { 'Content-Type': 'application/json' };
        if (token) { headers['Authorization'] = `Bearer ${token}`; }
        else { console.warn("No auth token found for fetching employees."); }


        try {
            // Use /api/employees (gets only active/schedulable ones by default)
            const employeesApiUrl = '/api/employees';
            console.log(`Fetching employees from: ${employeesApiUrl}`);
            const empPromise = fetch(employeesApiUrl, { method: 'GET', headers: headers });
            // Fetch shifts concurrently
            const shiftPromise = fetchShiftData();

            const empResponse = await empPromise;

            if (!empResponse.ok) {
                let errorDetails = `Employee fetch failed (${empResponse.status})`;
                try { const errorJson = await empResponse.json(); errorDetails += `: ${errorJson.error || JSON.stringify(errorJson)}`; } catch (parseError) { /* Ignore */ }
                throw new Error(errorDetails);
            }

            const empData = await empResponse.json();
            console.log(`Received ${empData.length} employees.`);
            // Sort using job_title (lowercase comparison) based on roleOrder
            const sortedEmployees = empData.sort((a, b) => {
                const jobTitleA = a.job_title?.toLowerCase() || 'zzzz'; // Default for sorting if missing
                const jobTitleB = b.job_title?.toLowerCase() || 'zzzz';
                const indexA = roleOrder.findIndex(role => jobTitleA.includes(role));
                const indexB = roleOrder.findIndex(role => jobTitleB.includes(role));
                const effectiveIndexA = indexA === -1 ? roleOrder.length : indexA; // Put unknowns last
                const effectiveIndexB = indexB === -1 ? roleOrder.length : indexB;
                if (effectiveIndexA !== effectiveIndexB) return effectiveIndexA - effectiveIndexB;
                // Fallback to name sort within the same role group
                return a.name.localeCompare(b.name);
            });
            setEmployees(sortedEmployees);

            await shiftPromise; // Wait for shifts to finish loading as well
        } catch (initialError) {
            console.error("Error fetching initial data:", initialError);
            if (!error) setError(`Failed to load initial data: ${initialError.message}.`);
            setEmployees([]); // Clear employees on error
        } finally {
            setLoading(false); // Stop loading indicator
        }
    }, [fetchShiftData, error]); // Dependency: fetchShiftData (which depends on currentDate)

    // --- Initial Data Fetch Effect ---
    useEffect(() => {
        let isMounted = true; // Prevent state update on unmounted component
        const loadData = async () => {
            if (isMounted) {
                console.log("Mounting/Date Change: Fetching initial data...");
                await fetchInitialData();
            }
        };
        loadData();
        // Cleanup function to set isMounted to false when component unmounts
        return () => {
            isMounted = false;
            console.log("Unmounting ScheduleCalendar or date changed, cleanup.");
        };
    }, [fetchInitialData]); // Dependency: fetchInitialData (which includes fetchShiftData -> currentDate)

    // --- Calendar Logic & Constants ---
    const { year, month, monthName, daysInMonth, datesInMonth } = useMemo(() => {
        const yr = currentDate.getFullYear();
        const mnth = currentDate.getMonth();
        const name = currentDate.toLocaleString('default', { month: 'long' });
        const numDays = new Date(yr, mnth + 1, 0).getDate();
        const dates = Array.from({ length: numDays }, (_, i) => new Date(yr, mnth, i + 1));
        return { year: yr, month: mnth, monthName: name, daysInMonth: numDays, datesInMonth: dates };
    }, [currentDate]);

    const firstDayOfMonth = useMemo(() => new Date(year, month, 1), [year, month]);

    // Grid layout constants
    const HEADER_ROW_COUNT = 2; // Rows for Day Name and Date Number
    const ROWS_PER_EMPLOYEE = 2; // Rows for Name/Title + Shift/CellText
    const EMPLOYEE_NAME_COL = 1; // First column for employee info
    const DATE_START_COL = 2; // Column where dates begin

    // --- Month Navigation ---
    const goToPreviousMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // --- Helper: Find Shift ---
    // Looks up shift in the state map for a given employee and date
    const findShiftForCell = (employeeId, date) => {
        const dateKey = formatDateKey(date);
        return dateKey ? shiftLookup.get(employeeId)?.get(dateKey) : null;
    };

    // --- Helper: Format Shift Display (Top part of cell) ---
    // Determines the primary code/time to show
    const formatShiftDisplay = (shift) => {
        if (!shift) return ''; // No shift, empty display

        // Priority 1: Check for specific codes in notes (if you want notes to override time)
        const notesUpper = shift.notes?.toUpperCase() || '';
        if (notesUpper.includes('7A7P')) return '7a7p';
        if (notesUpper.includes('7P7A')) return '7p7a';
        if (notesUpper.includes('11A7P')) return '11a7p'; // Add other note codes if needed

        // Priority 2: Calculate standard shift codes based on time
        if (shift.start_time && shift.end_time) {
            try {
                const start = new Date(shift.start_time);
                const end = new Date(shift.end_time);
                const startH = start.getHours();
                const endH = end.getHours();
                const durationHours = (end - start) / 3600000; // Duration in hours

                // Define standard shift logic (adjust times as needed)
                if (startH >= 6 && startH < 8 && endH >= 14 && endH < 16) return '1'; // Day shift
                if (startH >= 14 && startH < 16 && endH >= 22 && endH < 24) return '2'; // Evening shift
                if ((startH >= 22 || startH < 1) && durationHours > 6 && durationHours < 10) return '3'; // Night shift

                // Priority 3: Fallback to formatted start-end time if no standard code matched
                const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute:'2-digit', hour12: true }).toLowerCase().replace(':00','').replace(' ','');
                return `${formatTime(start)}-${formatTime(end)}`;

            } catch (e) {
                console.error("Error formatting shift time:", e);
                return 'Err'; // Indicate error
            }
        }

        // Priority 4: If no time, maybe display cell_text or first part of notes?
        return shift.cell_text?.substring(0,5) || shift.notes?.substring(0,5) || 'S'; // Fallback if only notes/cell_text exist
    };


    // --- Click Handler for Cells ---
    // Opens the modal with data for the clicked cell
    const handleCellClick = (employee, date, shift) => {
        console.log(`Cell Clicked: Emp ${employee?.id}, Date ${formatDateKey(date)}, Shift Exists: ${!!shift}`);
        // Only allow opening modal if user is a supervisor
        if (userAccessRole !== 'supervisor') {
            console.log("Non-supervisor clicked cell, modal blocked.");
            return; // Do nothing if not a supervisor
        }

        // Prepare data payload for the modal
        const cellPayload = {
            employeeId: employee.id,
            employeeName: employee.name,
            date: date, // Pass the actual Date object
            shift: shift // Pass the existing shift object (or null if none)
        };
        setSelectedCellData(cellPayload); // Set state to trigger modal opening
        setIsModalOpen(true);
    };

    // --- Function to close modal ---
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCellData(null); // Clear selected data when closing
    };

    // --- Function passed to Modal to trigger data refresh ---
    // Called by ShiftModal after successful save/delete
    const handleShiftUpdate = () => {
        console.log("Shift update detected, re-fetching shift data...");
        fetchShiftData(); // Re-fetch only the shift data for the current month
    };

    // --- Render Logic ---
    // Loading indicator
    if (loading) return <div className="loading-container">Loading Schedule...</div>;

    // Error display if initial load failed completely
    if (error && employees.length === 0 && !isModalOpen) {
         return <div className="error error-message">Error: {error} <button onClick={fetchInitialData}>Retry All</button></div>;
    }

    // Calculate grid properties
    let currentGridRow = HEADER_ROW_COUNT + 1; // Start below header rows
    let previousRoleGroup = null; // Track role group for separators
    const totalDataColumns = daysInMonth;
    // Define CSS grid columns: Employee Name | Date 1 | Date 2 | ...
    const gridTemplateColumns = `minmax(150px, 15%) repeat(${totalDataColumns}, minmax(35px, 1fr))`; // Adjusted min width for dates

    console.log(`Rendering grid. ${employees.length} employees.`);

    return (
        <div className="schedule-calendar-container" style={{ position: 'relative' }}>
            <div className="schedule-calendar">
                {/* Header with Month/Year and Navigation Buttons */}
                <div className="calendar-header">
                    <button onClick={goToPreviousMonth}>&lt; Prev</button>
                    <h2>{monthName} {year}</h2>
                    <button onClick={goToNextMonth}>Next &gt;</button>
                </div>

                {/* Optional Inline Error (if shifts failed but employees loaded) */}
                {error && employees.length > 0 && !isModalOpen && (
                     <div className="error error-message error-inline">
                        Shift loading issue: {error} <button onClick={fetchShiftData}>Retry Shifts</button>
                     </div>
                 )}

                {/* Grid Area */}
                <div className="calendar-grid" style={{ gridTemplateColumns: gridTemplateColumns }}>
                    {/* --- Header Rows (Day Names, Date Numbers) --- */}
                    {/* Top-left empty corner */}
                    <div className="grid-cell grid-header top-left-corner" style={{ gridRow: 1, gridColumn: EMPLOYEE_NAME_COL }}></div>
                    {/* Day Names */}
                    {datesInMonth.map((date, index) => {
                         const isToday = formatDateKey(date) === todayDateStr;
                         const todayClass = isToday ? 'today-highlight' : '';
                         return (
                            <div key={`day-name-${index}`} className={`grid-cell grid-header week-day ${todayClass}`} style={{ gridRow: 1, gridColumn: DATE_START_COL + index }}>
                                {getDayName(date)}
                            </div>
                        );
                    })}
                    {/* Second row, first column empty */}
                    <div className="grid-cell grid-header" style={{ gridRow: 2, gridColumn: EMPLOYEE_NAME_COL }}></div>
                    {/* Date Numbers */}
                    {datesInMonth.map((date, index) => {
                        const dayNumber = date.getDate();
                        const isToday = formatDateKey(date) === todayDateStr;
                        const todayClass = isToday ? 'today-highlight' : '';
                        return (
                            <div key={`date-num-${index}`} className={`grid-cell grid-header date-number ${todayClass}`} style={{ gridRow: 2, gridColumn: DATE_START_COL + index }}>
                                {dayNumber}
                            </div>
                        );
                    })}

                    {/* --- Employee Rows & Shift Cells --- */}
                    {employees.map((employee) => {
                        // Determine current grid row positions for this employee
                        let nameRow = currentGridRow;
                        let titleRow = currentGridRow + 1;
                        let shiftDataRow = currentGridRow; // Data cells span both rows

                        // Check if a role group separator is needed
                        const currentRoleGroup = roleOrder.find(role => employee.job_title?.toLowerCase().includes(role)) || 'other';
                        let separatorRow = null;
                        if (previousRoleGroup !== null && currentRoleGroup !== previousRoleGroup) {
                            // Insert separator row
                            separatorRow = (
                                <div key={`sep-${currentGridRow}`} className="grid-cell separator-row" style={{ gridRow: currentGridRow, gridColumn: `1 / ${totalDataColumns + 2}` }} ></div>
                            );
                            currentGridRow++; // Increment row index for the separator
                            // Update row indices for the actual employee data
                            nameRow = currentGridRow;
                            titleRow = currentGridRow + 1;
                            shiftDataRow = currentGridRow;
                        }
                        previousRoleGroup = currentRoleGroup; // Update for next iteration

                        // --- Render Employee Info and Cells for the row ---
                        const employeeElements = (
                            <React.Fragment key={employee.id}>
                                {/* Column 1: Employee Name & Title */}
                                <div className="grid-cell employee-name-cell" style={{ gridRow: nameRow, gridColumn: EMPLOYEE_NAME_COL }} >
                                    {employee.name}
                                </div>
                                <div className="grid-cell employee-title-cell" style={{ gridRow: titleRow, gridColumn: EMPLOYEE_NAME_COL }} >
                                    {employee.job_title || 'N/A'}
                                </div>

                                {/* Columns 2+: Data Cells for each date */}
                                {datesInMonth.map((date, index) => {
                                    const shift = findShiftForCell(employee.id, date); // Get shift data (includes notes, cell_text)
                                    const currentDataColumn = DATE_START_COL + index; // Calculate current column

                                    // --- Cell Styling Classes ---
                                    const weekParity = getWeekParity(date, firstDayOfMonth);
                                    const weekColorClass = `week-color-${weekParity}`;
                                    const isToday = formatDateKey(date) === todayDateStr;
                                    const todayClass = isToday ? 'today-highlight' : '';
                                    // Make cell clickable only for supervisors
                                    const clickableClass = userAccessRole === 'supervisor' ? 'clickable-cell' : '';

                                    // --- Tooltip Text ---
                                    // Show full notes in tooltip if they exist
                                    const titleText = shift?.notes && shift.notes.trim().length > 0
                                        ? `Notes: ${shift.notes}` + (shift?.cell_text ? `\nCell: ${shift.cell_text}` : '') // Notes + Cell Text
                                        : shift?.cell_text // Only Cell Text
                                            ? `Cell: ${shift.cell_text}`
                                            : (userAccessRole === 'supervisor' ? `Assign shift for ${employee.name} on ${formatDateKey(date)}` : `${employee.name} - ${formatDateKey(date)}`); // Default

                                    // --- Check for Notes Indicator ---
                                    // Check if notes exist and are not just whitespace
                                    const hasNotes = shift?.notes && shift.notes.trim().length > 0;

                                    // --- Render the Cell Group ---
                                    return (
                                        <div
                                            key={`cell-group-${employee.id}-${index}`}
                                            // Apply CSS classes for styling
                                            className={`grid-cell-group ${weekColorClass} ${todayClass} ${clickableClass}`}
                                            // Apply grid positioning and basic flex layout
                                            style={{
                                                gridRow: `${shiftDataRow} / span ${ROWS_PER_EMPLOYEE}`, // Span 2 rows
                                                gridColumn: currentDataColumn, // Correct column
                                                display: 'flex', flexDirection: 'column', // Stack content vertically
                                                justifyContent: 'center', alignItems: 'center', // Center content
                                                padding: '1px 2px', // Minimal padding
                                                borderRight: '1px solid #eee', borderBottom: '1px solid #eee',
                                                overflow: 'hidden', // Hide overflowing text
                                                lineHeight: '1.1', fontSize: '0.8em', // Adjust text size/spacing
                                                position: 'relative', // *** NEEDED for absolute positioning of indicator ***
                                                textAlign: 'center', // Center text within the divs
                                            }}
                                            onClick={() => handleCellClick(employee, date, shift)} // Click handler
                                            title={titleText} // Tooltip shows notes/cell text
                                        >
                                            {/* Top part: Main shift display (code/time) */}
                                            <div className={`grid-cell shift-cell`} style={{border:'none', flexShrink: 0, fontWeight: 'bold'}} >
                                                {formatShiftDisplay(shift)}
                                            </div>
                                            {/* Bottom part: Directly display cell_text */}
                                            <div className={`grid-cell cell-text-display`} style={{border:'none', flexShrink: 0}} >
                                                {/* Display cell_text from shift object or empty string */}
                                                {shift?.cell_text || ''}
                                            </div>

                                            {/* *** ADD NOTE INDICATOR conditionally *** */}
                                            {/* Render the indicator div only if hasNotes is true */}
                                            {hasNotes && <div className="note-indicator"></div>}
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        );

                        // Increment grid row index for the next employee (accounts for 2 rows per employee)
                        currentGridRow += ROWS_PER_EMPLOYEE;

                        // Return the separator (if any) and the employee elements
                        return (
                            <React.Fragment key={`emp-group-${employee.id}`}>
                                {separatorRow}
                                {employeeElements}
                            </React.Fragment>
                        );
                    })}
                </div> {/* End calendar-grid */}
            </div> {/* End schedule-calendar */}

            {/* --- Modal Rendering --- */}
            {/* Render ShiftModal only if conditions are met */}
            {isModalOpen && selectedCellData && userAccessRole === 'supervisor' && (
                <ShiftModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    cellData={selectedCellData} // Pass the prepared data for the modal
                    onShiftUpdate={handleShiftUpdate} // Pass the callback for refreshing data
                />
            )}
        </div> // End schedule-calendar-container
    );
};

export default ScheduleCalendar;