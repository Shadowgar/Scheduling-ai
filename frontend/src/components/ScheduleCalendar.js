// frontend/src/components/ScheduleCalendar.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './ScheduleCalendar.css';
import ShiftModal from './ShiftModal';

// Helper functions (assuming they are correct and unchanged)
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
    // Calculate the date of the Sunday at the start of the week the month begins in
    const startOfWeekMonthStarts = new Date(firstDayOfMonth.getTime() - firstDayOfMonthDayOfWeek * msPerDay);
    const diffInTime = date.getTime() - startOfWeekMonthStarts.getTime();
    const diffInDays = Math.floor(diffInTime / msPerDay);
    const weekNumber = Math.floor(diffInDays / 7); // 0-based week number within the displayed calendar block
    return weekNumber % 2 === 0 ? 'even' : 'odd'; // Alternate week colors
};
const roleOrder = ['supervisor', 'police', 'security']; // Define desired role order
const todayDateStr = formatDateKey(new Date());

// --- Component Starts ---
// *** FIX: Accept currentUser prop instead of userRole ***
const ScheduleCalendar = ({ currentUser }) => {
    // *** FIX: Derive userRole from currentUser ***
    const userRole = currentUser?.role; // Use optional chaining

    // --- State ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [employees, setEmployees] = useState([]);
    const [shiftLookup, setShiftLookup] = useState(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCellData, setSelectedCellData] = useState(null);

    // *** DEBUG: Log the received currentUser prop and derived role ***
    console.log('[ScheduleCalendar] Received currentUser prop:', currentUser);
    console.log('[ScheduleCalendar] Derived userRole:', userRole);


    // --- Data Fetching Logic (Shifts) ---
    const fetchShiftData = useCallback(async () => {
        setShiftLookup(new Map()); // Clear map before fetching

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth() + 1; // API uses 1-12 month

        // *** USE RELATIVE URL FOR PROXY ***
        const shiftsApiUrl = `/api/shifts?year=${year}&month=${month}`;
        // console.log('Fetching/Refreshing shifts from:', shiftsApiUrl); // Keep less noisy

        // *** Get token (if available) ***
        const token = localStorage.getItem('accessToken');
        const headers = {
            'Content-Type': 'application/json', // Good practice
        };
        // *** Add Authorization header ONLY if token exists ***
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            // console.log('Fetching shifts WITH token.'); // Keep less noisy
        } else {
            // console.log('Fetching shifts WITHOUT token (anonymous view).'); // Keep less noisy
        }

        try {
            // *** Use updated headers in fetch ***
            const shiftResponse = await fetch(shiftsApiUrl, {
                method: 'GET',
                headers: headers // Pass constructed headers
            });

            // --- Response Handling ---
            if (!shiftResponse.ok) {
                // If backend requires auth and token was missing/invalid, this might be 401
                let errorDetails = `Network response for shifts was not ok (${shiftResponse.status})`;
                 try {
                     const errorJson = await shiftResponse.json();
                     errorDetails += `: ${errorJson.error || errorJson.message || JSON.stringify(errorJson)}`;
                 } catch (parseError) { /* Ignore if response isn't JSON */ }
                // Don't immediately throw if it's a 401 and we are allowing anonymous view
                // Let the component render empty/error state based on subsequent logic
                if (shiftResponse.status === 401 && !token) {
                    console.warn("Shifts fetch received 401 without a token - Backend might require login even for viewing.");
                    // Set an error or handle gracefully depending on desired UX for anonymous users
                    setError("Login may be required to view shifts.");
                } else {
                   throw new Error(errorDetails); // Throw for other errors or if token *was* present
                }
                setShiftLookup(new Map()); // Ensure lookup is empty on error
            } else {
                const shiftData = await shiftResponse.json();

                // Process shifts into the lookup map (unchanged)
                const newLookup = new Map();
                shiftData.forEach(shift => {
                    if (!shift.employee_id || !shift.start_time) { return; }
                    try {
                        const shiftDate = new Date(shift.start_time);
                        const dateKey = formatDateKey(shiftDate);
                        if (dateKey) {
                            if (!newLookup.has(shift.employee_id)) {
                                newLookup.set(shift.employee_id, new Map());
                            }
                            const employeeMap = newLookup.get(shift.employee_id);
                            employeeMap.set(dateKey, shift);
                        }
                    } catch (e) { console.error("Error processing shift date:", shift.start_time, e); }
                });
                setShiftLookup(newLookup);
                if (error) setError(null); // Clear previous error on success
            }

        } catch (fetchError) {
            console.error("Error during shift data fetch:", fetchError);
            setError(`Failed to load shift data: ${fetchError.message}.`);
            setShiftLookup(new Map()); // Ensure lookup is empty on error
        }
        // Loading state is handled in the useEffect that calls this
    }, [currentDate, error]); // Include error to allow clearing

    // --- Fetch Initial Data (Moved out of useEffect) ---
    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        setError(null);

        // *** Get token (if available) ***
        const token = localStorage.getItem('accessToken');
        const headers = {
            'Content-Type': 'application/json',
        };
        // *** Add Authorization header ONLY if token exists ***
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            // console.log('Fetching employees WITH token.'); // Keep less noisy
        } else {
            // console.log('Fetching employees WITHOUT token (anonymous view).'); // Keep less noisy
        }

        try {
            // *** USE RELATIVE URL FOR PROXY ***
            const employeesApiUrl = '/api/employees';

            // *** Use updated headers in fetch ***
            const empPromise = fetch(employeesApiUrl, {
                method: 'GET',
                headers: headers // Pass constructed headers
            });

            // Start fetching shifts concurrently (it handles its own token logic)
            const shiftPromise = fetchShiftData();

            const empResponse = await empPromise;

            if (!empResponse.ok) {
                let errorDetails = `Network response for employees was not ok (${empResponse.status})`;
                try {
                    const errorJson = await empResponse.json();
                    errorDetails += `: ${errorJson.error || errorJson.message || JSON.stringify(errorJson)}`;
                } catch (parseError) { /* Ignore */ }
                if (empResponse.status === 401 && !token) {
                    console.warn("Employees fetch received 401 without a token - Backend might require login even for viewing.");
                    setError("Login may be required to view employee list.");
                } else {
                    throw new Error(errorDetails);
                }
                setEmployees([]); // Clear employees on error
            } else {
                const empData = await empResponse.json();
                // Employee sorting logic (unchanged)
                const sortedEmployees = empData.sort((a, b) => {
                    const roleA = a.role?.toLowerCase() || 'zzzz';
                    const roleB = b.role?.toLowerCase() || 'zzzz';
                    const indexA = roleOrder.findIndex(role => roleA.includes(role));
                    const indexB = roleOrder.findIndex(role => roleB.includes(role));
                    const effectiveIndexA = indexA === -1 ? roleOrder.length : indexA;
                    const effectiveIndexB = indexB === -1 ? roleOrder.length : indexB;
                    if (effectiveIndexA !== effectiveIndexB) return effectiveIndexA - effectiveIndexB;
                    return a.name.localeCompare(b.name);
                });
                setEmployees(sortedEmployees);
            }

            await shiftPromise; // Wait for shifts to finish loading/processing

        } catch (initialError) {
            console.error("Error fetching initial data:", initialError);
            // Avoid overwriting more specific errors from fetch logic if already set
            if (!error) setError(`Failed to load initial data: ${initialError.message}.`);
        } finally {
            setLoading(false);
        }
    }, [fetchShiftData, error]); // Dependency on the memoized fetch function and error state

    // --- Initial Data Fetch Effect (now uses the defined fetchInitialData) ---
    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            if (isMounted) {
                await fetchInitialData();
            }
        };

        loadData();

        return () => {
            isMounted = false;
        };
    }, [fetchInitialData]); // Dependency on the memoized fetchInitialData function

    // --- Calendar Logic & Constants (Unchanged) ---
    const { year, month, monthName, daysInMonth, datesInMonth } = useMemo(() => {
        const yr = currentDate.getFullYear();
        const mnth = currentDate.getMonth();
        const name = currentDate.toLocaleString('default', { month: 'long' });
        const numDays = new Date(yr, mnth + 1, 0).getDate();
        const dates = Array.from({ length: numDays }, (_, i) => new Date(yr, mnth, i + 1));
        return { year: yr, month: mnth, monthName: name, daysInMonth: numDays, datesInMonth: dates };
    }, [currentDate]);

    const firstDayOfMonth = useMemo(() => new Date(year, month, 1), [year, month]);

    const HEADER_ROW_COUNT = 2;
    const ROWS_PER_EMPLOYEE = 2;
    const EMPLOYEE_NAME_COL = 1;
    const DATE_START_COL = 2;

    // --- Month Navigation (Unchanged) ---
    const goToPreviousMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // --- Helper: Find Shift (Unchanged) ---
    const findShiftForCell = (employeeId, date) => {
        const dateKey = formatDateKey(date);
        if (!dateKey) return null;
        // Optional chaining: return undefined if employeeId not in shiftLookup
        return shiftLookup.get(employeeId)?.get(dateKey);
    };

    // --- Helper: Format Shift Display (Unchanged, assuming correct) ---
    const formatShiftDisplay = (shift) => {
        if (!shift) return '';
        if (shift.start_time && shift.end_time) {
            try {
                const start = new Date(shift.start_time); const end = new Date(shift.end_time);
                const startH = start.getHours(); const endH = end.getHours();
                const durationHours = (end - start) / 3600000;
                let standardShiftCode = '';
                if (startH >= 6 && startH < 8 && endH >= 14 && endH < 16) standardShiftCode = '1';
                else if (startH >= 14 && startH < 16 && endH >= 22 && endH < 24) standardShiftCode = '2';
                else if ((startH >= 22 || startH < 1) && durationHours > 6 && durationHours < 10) standardShiftCode = '3';

                if(!standardShiftCode) {
                     const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute:'2-digit', hour12: true }).toLowerCase().replace(':00','').replace(' ','');
                     return `${formatTime(start)}-${formatTime(end)}`;
                } else {
                     return standardShiftCode;
                }
            } catch (e) { console.error("Error formatting shift time:", e); return 'Err';}
        }
        const notesUpper = shift.notes?.toUpperCase() || '';
        if (notesUpper.includes('7A7P')) return '7a7p'; if (notesUpper.includes('7P7A')) return '7p7a'; if (notesUpper.includes('11A7P')) return '11a7p';
        return shift.notes?.substring(0,5) || 'S'; // Fallback
    };

    // --- Helper: Format Special Markings (Unchanged, assuming correct) ---
    const formatSpecialMarkings = (shift) => {
        if (!shift || !shift.notes) return '';
        const notes = shift.notes.toUpperCase();
        if (notes.includes('TRNG')) return 'TRNG'; if (notes.includes('RCALL')) return 'RCall'; if (notes.includes('BLS')) return 'BLS';
        return '';
    };

    // --- Click Handler for Cells (Checks Role for Editing - Debug Logs Added) ---
    const handleCellClick = (employee, date, shift) => {
        // *** DEBUG: Log the click event and the role check ***
        console.log(`[ScheduleCalendar] handleCellClick fired for Employee: ${employee?.name}, Date: ${formatDateKey(date)}`);
        // *** The userRole variable is now derived from the currentUser prop ***
        console.log(`[ScheduleCalendar] Checking userRole in handleCellClick: "${userRole}"`);

        if (userRole !== 'supervisor') {
            console.log(`[ScheduleCalendar] Role is NOT supervisor. Preventing modal.`);
            return; // Stop execution for non-supervisors
        }

        // *** DEBUG: Log state updates if supervisor ***
        console.log('[ScheduleCalendar] Role IS supervisor. Setting modal state...');
        const cellPayload = {
            employeeId: employee.id,
            employeeName: employee.name,
            date: date, // Pass the full Date object
            shift: shift // Pass the existing shift data (or null)
        };
        console.log('[ScheduleCalendar] Setting selectedCellData:', cellPayload);
        setSelectedCellData(cellPayload);
        console.log('[ScheduleCalendar] Setting isModalOpen to true');
        setIsModalOpen(true);
    };


    // --- Function to close modal (Debug Log Added) ---
    const handleCloseModal = () => {
        console.log('[ScheduleCalendar] Closing modal.'); // DEBUG log
        setIsModalOpen(false);
        setSelectedCellData(null);
    };

    // --- Function passed to Modal to trigger data refresh (Debug Log Added) ---
    const handleShiftUpdate = () => {
        console.log('[ScheduleCalendar] handleShiftUpdate called (triggered by modal). Refreshing shifts.'); // DEBUG log
        fetchShiftData(); // Re-fetch shifts to show the update
    };

    // --- Render Logic ---
     if (loading) return <div>Loading Schedule...</div>;
     // Display error prominently if it prevents rendering useful data
     if (error && employees.length === 0 && !isModalOpen) { // Show primary error if employees didn't load
         return <div className="error">Error: {error} <button onClick={fetchInitialData}>Retry All</button></div>;
     }

    let currentGridRow = HEADER_ROW_COUNT + 1;
    let previousRoleGroup = null;
    const totalDataColumns = daysInMonth;
    const gridTemplateColumns = `minmax(150px, 15%) repeat(${totalDataColumns}, minmax(28px, 1fr))`;

    // *** DEBUG: Log role before rendering grid ***
    console.log(`[ScheduleCalendar] Rendering grid. User role for clickableClass: "${userRole}"`);

    return (
        <div className="schedule-calendar-container" style={{ position: 'relative' }}>
            <div className="schedule-calendar">
                {/* Header (Unchanged) */}
                <div className="calendar-header">
                    <button onClick={goToPreviousMonth}>&lt; Prev</button>
                    <h2>{monthName} {year}</h2>
                    <button onClick={goToNextMonth}>Next &gt;</button>
                </div>

                {/* Optional Inline Error (if shifts failed but employees loaded) */}
                 {error && employees.length > 0 && !isModalOpen && (
                    <div className="error-inline">Shift loading issue: {error} <button onClick={fetchShiftData}>Retry Shifts</button></div>
                 )}

                {/* Grid Area */}
                <div className="calendar-grid" style={{ gridTemplateColumns: gridTemplateColumns }}>

                    {/* Row 1 & 2: Day/Date Headers (Unchanged) */}
                    <div className="grid-cell grid-header top-left-corner" style={{ gridRow: 1, gridColumn: EMPLOYEE_NAME_COL }}></div>
                    {datesInMonth.map((date, index) => {
                        const isToday = formatDateKey(date) === todayDateStr;
                        const todayClass = isToday ? 'today-highlight' : '';
                        return (
                            <div key={`day-name-${index}`} className={`grid-cell grid-header week-day ${todayClass}`} style={{ gridRow: 1, gridColumn: DATE_START_COL + index }}>
                                {getDayName(date)}
                            </div>
                        );
                    })}
                    <div className="grid-cell grid-header" style={{ gridRow: 2, gridColumn: EMPLOYEE_NAME_COL }}></div>
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

                    {/* Employee Rows & Shift Cells */}
                    {employees.map((employee) => {
                        // Role separator logic (Unchanged)
                        let nameRow = currentGridRow; let titleRow = currentGridRow + 1; let shiftDataRow = currentGridRow;
                        const currentRoleGroup = roleOrder.find(role => employee.role?.toLowerCase().includes(role)) || 'other';
                        let separatorRow = null;
                        if (previousRoleGroup !== null && currentRoleGroup !== previousRoleGroup) {
                            separatorRow = ( <div key={`sep-${currentGridRow}`} className="grid-cell separator-row" style={{ gridRow: currentGridRow, gridColumn: `1 / ${totalDataColumns + 2}` }} ></div> );
                            currentGridRow++;
                            nameRow = currentGridRow; titleRow = currentGridRow + 1; shiftDataRow = currentGridRow;
                        }
                        previousRoleGroup = currentRoleGroup;

                        const employeeElements = (
                            <React.Fragment key={employee.id}>
                                {/* Employee Name/Title Cells (Unchanged) */}
                                <div className="grid-cell employee-name-cell" style={{ gridRow: nameRow, gridColumn: EMPLOYEE_NAME_COL }} > {employee.name} </div>
                                <div className="grid-cell employee-title-cell" style={{ gridRow: titleRow, gridColumn: EMPLOYEE_NAME_COL }} > {employee.role || 'N/A'} </div>

                                {/* Data Cells */}
                                {datesInMonth.map((date, index) => {
                                    const shift = findShiftForCell(employee.id, date);
                                    const currentDataColumn = DATE_START_COL + index;
                                    const weekParity = getWeekParity(date, firstDayOfMonth);
                                    const weekColorClass = `week-color-${weekParity}`;
                                    const isToday = formatDateKey(date) === todayDateStr;
                                    const todayClass = isToday ? 'today-highlight' : '';
                                    // *** Use the correctly derived userRole variable here ***
                                    const clickableClass = userRole === 'supervisor' ? 'clickable-cell' : '';

                                    return (
                                        <div
                                            key={`cell-group-${employee.id}-${index}`}
                                            // *** Apply clickableClass ***
                                            className={`grid-cell-group ${weekColorClass} ${todayClass} ${clickableClass}`}
                                            style={{
                                                gridRow: `${shiftDataRow} / span ${ROWS_PER_EMPLOYEE}`, gridColumn: currentDataColumn,
                                                display: 'flex', flexDirection: 'column', padding: 0,
                                                borderRight: '1px solid #eee', borderBottom: '1px solid #eee'
                                            }}
                                            // *** Attach click handler ***
                                            onClick={() => handleCellClick(employee, date, shift)}
                                            title={shift?.notes || (userRole === 'supervisor' ? `Assign shift for ${employee.name} on ${formatDateKey(date)}` : `${employee.name} - ${formatDateKey(date)}`)}
                                        >
                                            <div className={`grid-cell shift-cell`} style={{border:'none', minHeight: '12px'}} >{formatShiftDisplay(shift)}</div>
                                            <div className={`grid-cell special-marking-cell`} style={{border:'none', minHeight: '12px'}} >{formatSpecialMarkings(shift)}</div>
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        );

                        currentGridRow += ROWS_PER_EMPLOYEE;
                        return ( <React.Fragment key={`emp-group-${employee.id}`}> {separatorRow} {employeeElements} </React.Fragment> );
                    })}
                </div> {/* End calendar-grid */}
            </div> {/* End schedule-calendar */}

            {/* Modal - Render logic unchanged, opening is controlled by role check */}
             {/* *** DEBUG: Log modal render conditions *** */}
             {console.log('[ScheduleCalendar] Checking modal render conditions:', { isModalOpen, selectedCellData, userRole })}
             {/* The condition `userRole === 'supervisor'` here is redundant if handleCellClick already checked, but safe */}
             {isModalOpen && selectedCellData && userRole === 'supervisor' && (
                 <ShiftModal
                     isOpen={isModalOpen}
                     onClose={handleCloseModal}
                     cellData={selectedCellData}
                     onShiftUpdate={handleShiftUpdate}
                     // Pass userRole if modal needs it for internal logic (e.g., delete button)
                     // userRole={userRole} // Not currently needed by ShiftModal based on provided code
                 />
             )}
        </div> // End schedule-calendar-container
    );
};

export default ScheduleCalendar;