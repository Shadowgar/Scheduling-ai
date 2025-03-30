// frontend/src/components/ScheduleCalendar.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './ScheduleCalendar.css';
import ShiftModal from './ShiftModal';

// Helper function to get short day name (e.g., 'Sat')
const getDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
};

// Helper function to format date as YYYY-MM-DD string (consistent key for map)
const formatDateKey = (date) => {
    if (!(date instanceof Date) || isNaN(date)) {
        // console.error("Invalid date passed to formatDateKey:", date); // Reduce console noise
        return null;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper function to determine week parity (odd/even)
const getWeekParity = (date, firstDayOfMonth) => {
    const firstDayOfMonthDayOfWeek = firstDayOfMonth.getDay(); // 0=Sun, 1=Mon,...
    const msPerDay = 1000 * 60 * 60 * 24;
    const startOfWeekMonthStarts = new Date(firstDayOfMonth.getTime() - firstDayOfMonthDayOfWeek * msPerDay);
    const diffInTime = date.getTime() - startOfWeekMonthStarts.getTime();
    const diffInDays = Math.floor(diffInTime / msPerDay);
    const weekNumber = Math.floor(diffInDays / 7);
    return weekNumber % 2 === 0 ? 'even' : 'odd';
};

// Define roleOrder outside the component
const roleOrder = ['supervisor', 'police', 'security']; // Lowercase for comparison

// Get today's date string ONCE outside the component
const todayDateStr = formatDateKey(new Date()); // Get 'YYYY-MM-DD' for today


const ScheduleCalendar = () => {
    // --- State ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [employees, setEmployees] = useState([]);
    const [shiftLookup, setShiftLookup] = useState(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCellData, setSelectedCellData] = useState(null);

    // --- Data Fetching Logic (extracted for reuse) ---
    const fetchShiftData = useCallback(async () => {
        setShiftLookup(new Map()); // Clear map before fetching

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const apiMonth = month + 1;
        const shiftsApiUrl = `http://127.0.0.1:5000/api/shifts?year=${year}&month=${apiMonth}`;
        console.log('Fetching/Refreshing shifts from:', shiftsApiUrl);

        try {
            const shiftResponse = await fetch(shiftsApiUrl);
            if (!shiftResponse.ok) {
                let errorDetails = `Network response for shifts was not ok (${shiftResponse.status})`;
                try { const errorJson = await shiftResponse.json(); errorDetails += `: ${errorJson.error || JSON.stringify(errorJson)}`; } catch (parseError) { /* Ignore */ }
                throw new Error(errorDetails);
            }
            const shiftData = await shiftResponse.json();

            // Process shifts into the lookup map
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
            if (error) setError(null); // Clear error on successful fetch/refresh

        } catch (fetchError) {
            console.error("Error fetching/refreshing shift data:", fetchError);
            setError(`Failed to load shift data: ${fetchError.message}.`);
        }
    }, [currentDate, error]); // Include error to allow clearing


    // --- Initial Data Fetch Effect (Employees + Shifts) ---
    useEffect(() => {
        let isMounted = true;
        const fetchInitialData = async () => {
            setLoading(true);
            setError(null);
            try {
                const empPromise = fetch('http://127.0.0.1:5000/api/employees');
                const shiftPromise = fetchShiftData(); // Start fetching shifts

                const empResponse = await empPromise;
                if (!isMounted) return;

                if (!empResponse.ok) throw new Error('Network response for employees was not ok');
                const empData = await empResponse.json();
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

                await shiftPromise; // Wait for shifts to finish
                if (!isMounted) return;

            } catch (initialError) {
                 if (isMounted) {
                     console.error("Error fetching initial data:", initialError);
                     setError(`Failed to load initial data: ${initialError.message}.`);
                 }
            } finally {
                 if (isMounted) { setLoading(false); }
            }
        };
        fetchInitialData();
        return () => { isMounted = false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchShiftData]); // Dependency is the memoized fetch function


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

    const HEADER_ROW_COUNT = 2;
    const ROWS_PER_EMPLOYEE = 2;
    const EMPLOYEE_NAME_COL = 1;
    const DATE_START_COL = 2;

    // --- Month Navigation ---
    const goToPreviousMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // --- Helper: Find Shift (Uses Lookup Map) ---
    const findShiftForCell = (employeeId, date) => {
        const dateKey = formatDateKey(date);
        if (!dateKey) return null;
        const employeeMap = shiftLookup.get(employeeId);
        if (employeeMap) { return employeeMap.get(dateKey); }
        return undefined;
    };

    // --- Helper: Format Shift Display ---
    const formatShiftDisplay = (shift) => {
        if (!shift) return '';
        if (shift.start_time && shift.end_time) {
            try {
                const start = new Date(shift.start_time); const end = new Date(shift.end_time);
                const startH = start.getHours(); const endH = end.getHours();
                if (startH >= 6 && startH < 8 && endH >= 14 && endH < 16) return '1';
                if (startH >= 14 && startH < 16 && endH >= 22 && endH < 24) return '2';
                const durationHours = (end - start) / 3600000;
                if ((startH >= 22 || startH < 1) && durationHours > 6 && durationHours < 10) return '3';
                const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute:'2-digit', hour12: true }).toLowerCase().replace(':00','').replace(' ','');
                 let standardShiftCode = '';
                 if (startH >= 6 && startH < 8 && endH >= 14 && endH < 16) standardShiftCode = '1';
                 else if (startH >= 14 && startH < 16 && endH >= 22 && endH < 24) standardShiftCode = '2';
                 else if ((startH >= 22 || startH < 1) && durationHours > 6 && durationHours < 10) standardShiftCode = '3';
                 if(!standardShiftCode) { return `${formatTime(start)}-${formatTime(end)}`; }
                 else { return standardShiftCode; }
            } catch (e) { console.error("Error formatting shift time:", e); }
        }
         const notesUpper = shift.notes?.toUpperCase() || '';
         if (notesUpper.includes('7A7P')) return '7a7p'; if (notesUpper.includes('7P7A')) return '7p7a'; if (notesUpper.includes('11A7P')) return '11a7p';
        return shift.notes?.substring(0,5) || 'S';
    };

    // --- Helper: Format Special Markings ---
    const formatSpecialMarkings = (shift) => {
        if (!shift || !shift.notes) return '';
        const notes = shift.notes.toUpperCase();
        if (notes.includes('TRNG')) return 'TRNG'; if (notes.includes('RCALL')) return 'RCall'; if (notes.includes('BLS')) return 'BLS';
        return '';
    };

    // --- Click Handler for Cells ---
    const handleCellClick = (employee, date, shift) => {
        setSelectedCellData({ employeeId: employee.id, employeeName: employee.name, date: date, shift: shift });
        setIsModalOpen(true);
    };

    // --- Function to close modal ---
    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedCellData(null);
    };

    // --- Function passed to Modal to trigger data refresh ---
    const handleShiftUpdate = () => {
        fetchShiftData();
    };

    // --- Render ---
     if (loading) return <div>Loading Schedule...</div>;
     if (error && !isModalOpen) return <div className="error">Error: {error} <button onClick={fetchShiftData}>Retry Shifts</button></div>;

    let currentGridRow = HEADER_ROW_COUNT + 1;
    let previousRoleGroup = null;
    const totalDataColumns = daysInMonth;
    const gridTemplateColumns = `minmax(150px, 15%) repeat(${totalDataColumns}, minmax(28px, 1fr))`;

    return (
        <div className="schedule-calendar-container" style={{ position: 'relative' }}>
            <div className="schedule-calendar">
                {/* Header */}
                <div className="calendar-header">
                    <button onClick={goToPreviousMonth}>&lt; Prev</button>
                    <h2>{monthName} {year}</h2>
                    <button onClick={goToNextMonth}>Next &gt;</button>
                </div>

                {/* Optional Inline Error */}
                 {error && !isModalOpen && <div className="error-inline">Error loading shifts: {error} <button onClick={fetchShiftData}>Retry</button></div>}

                {/* Grid Area */}
                <div className="calendar-grid" style={{ gridTemplateColumns: gridTemplateColumns }}>

                    {/* Row 1: Day Name Headers */}
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

                    {/* Row 2: Date Number Headers */}
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

                                    return (
                                        <div
                                            key={`cell-group-${employee.id}-${index}`}
                                            className={`grid-cell-group ${weekColorClass} ${todayClass}`}
                                            style={{
                                                gridRow: `${shiftDataRow} / span ${ROWS_PER_EMPLOYEE}`, gridColumn: currentDataColumn,
                                                display: 'flex', flexDirection: 'column', padding: 0, cursor: 'pointer',
                                                borderRight: '1px solid #eee', borderBottom: '1px solid #eee'
                                            }}
                                            onClick={() => handleCellClick(employee, date, shift)}
                                            title={shift?.notes || `Assign shift for ${employee.name} on ${formatDateKey(date)}`}
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

            {/* Modal */}
            {isModalOpen && selectedCellData && (
                <ShiftModal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    cellData={selectedCellData}
                    onShiftUpdate={handleShiftUpdate}
                />
            )}
        </div> // End schedule-calendar-container
    );
};

export default ScheduleCalendar;