    // frontend/src/components/ScheduleCalendar.js
    import React, { useState, useEffect } from 'react';
    import './ScheduleCalendar.css';

    // Define roleOrder outside the component
    const roleOrder = ['supervisor', 'police', 'security']; // Lowercase for comparison

    // Helper function to get short day name (e.g., 'Sat')
    const getDayName = (date) => {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
    };

    const ScheduleCalendar = () => {
        // --- State ---
        const [currentDate, setCurrentDate] = useState(new Date()); // Represents the month to display
        const [employees, setEmployees] = useState([]);
        const [shifts, setShifts] = useState([]);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);

        // --- Fetch Data ---
        useEffect(() => {
            const fetchData = async () => {
                setLoading(true);
                setError(null);
                const year = currentDate.getFullYear();
                const month = currentDate.getMonth(); // 0-indexed

                try {
                    // Fetch Employees
                    const empResponse = await fetch('http://127.0.0.1:5000/api/employees');
                    if (!empResponse.ok) throw new Error('Network response for employees was not ok');
                    const empData = await empResponse.json();

                    // Sort employees by role then name
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

                    // Fetch Shifts (Still needs backend filtering by month!)
                    // Example: fetch(`/api/shifts?year=${year}&month=${month + 1}`)
                    const shiftResponse = await fetch('http://127.0.0.1:5000/api/shifts');
                    if (!shiftResponse.ok) throw new Error('Network response for shifts was not ok');
                    const shiftData = await shiftResponse.json();
                    setShifts(shiftData);

                } catch (error) {
                    console.error("Error fetching data:", error);
                    setError(`Failed to load data: ${error.message}. Is the backend running?`);
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        }, [currentDate]);


        // --- Calendar Logic & Constants ---
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth(); // 0-indexed
        const monthName = currentDate.toLocaleString('default', { month: 'long' });

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const datesInMonth = Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1));

        // *** No fixed weekDays array needed anymore ***

        // Constants for grid layout
        const HEADER_ROW_COUNT = 2; // 1 for day names, 1 for date numbers
        const ROWS_PER_EMPLOYEE = 2; // 1 for shift, 1 for special markings
        const EMPLOYEE_NAME_COL = 1; // Column index for employee names/titles
        const DATE_START_COL = 2; // Data columns start from the second grid column

        // --- Month Navigation ---
        const goToPreviousMonth = () => setCurrentDate(new Date(year, month - 1, 1));
        const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

        // --- Helper: Find Shift --- (Logic remains the same)
        const findShiftForCell = (employeeId, date) => {
            const targetDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            return shifts.find(shift =>
                shift.employee_id === employeeId &&
                shift.start_time?.startsWith(targetDateStr)
            );
        };

        // --- Helper: Format Shift Display --- (Logic remains the same)
        const formatShiftDisplay = (shift) => {
            if (!shift) return '';
            if (shift.start_time && shift.end_time) {
                try {
                    const start = new Date(shift.start_time);
                    const end = new Date(shift.end_time);
                    const startH = start.getHours();
                    const endH = end.getHours();
                    if (startH >= 6 && startH < 8 && endH >= 14 && endH < 16) return '1';
                    if (startH >= 14 && startH < 16 && endH >= 22 && endH < 24) return '2';
                    const durationHours = (end - start) / (1000 * 60 * 60);
                    if ((startH >= 22 || startH < 1) && durationHours > 6 && durationHours < 10) return '3';
                    const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute:'2-digit', hour12: true }).toLowerCase().replace(':00','').replace(' ','');
                    // Basic check to avoid showing time if it's a standard shift
                     let standardShiftCode = '';
                     if (startH >= 6 && startH < 8 && endH >= 14 && endH < 16) standardShiftCode = '1';
                     else if (startH >= 14 && startH < 16 && endH >= 22 && endH < 24) standardShiftCode = '2';
                     else if ((startH >= 22 || startH < 1) && durationHours > 6 && durationHours < 10) standardShiftCode = '3';

                     if(!standardShiftCode) {
                         return `${formatTime(start)}-${formatTime(end)}`;
                     } else {
                         return standardShiftCode; // Return 1, 2, or 3 if detected
                     }
                } catch (e) { console.error("Error formatting shift time:", e); }
            }
            // Extract potential codes/times from notes as fallback if needed
             const notesUpper = shift.notes?.toUpperCase() || '';
             if (notesUpper.includes('7A7P')) return '7a7p';
             if (notesUpper.includes('7P7A')) return '7p7a';
             if (notesUpper.includes('11A7P')) return '11a7p';
             // Add more custom time extractions if necessary

            return shift.notes?.substring(0,5) || 'S'; // Final fallback
        };

        // --- Helper: Format Special Markings --- (Logic remains the same)
        const formatSpecialMarkings = (shift) => {
            if (!shift || !shift.notes) return '';
            const notes = shift.notes.toUpperCase();
            if (notes.includes('TRNG')) return 'TRNG';
            if (notes.includes('RCALL')) return 'RCall';
            if (notes.includes('BLS')) return 'BLS';
            return '';
        };

        // --- Render ---
        if (loading) return <div>Loading Schedule...</div>;
        if (error) return <div className="error">Error: {error}</div>;

        let currentGridRow = HEADER_ROW_COUNT + 1;
        let previousRoleGroup = null;

        // Calculate the total number of columns needed
        const totalDataColumns = daysInMonth;
        const gridTemplateColumns = `minmax(150px, 15%) repeat(${totalDataColumns}, minmax(28px, 1fr))`;

        return (
            <div className="schedule-calendar">
                {/* Header: Month/Year and Navigation */}
                <div className="calendar-header">
                    <button onClick={goToPreviousMonth}>&lt; Prev</button>
                    <h2>{monthName} {year}</h2>
                    <button onClick={goToNextMonth}>Next &gt;</button>
                </div>

                {/* Grid Area */}
                <div className="calendar-grid" style={{ gridTemplateColumns: gridTemplateColumns }}>

                    {/* --- Row 1: Day Name Headers --- */}
                    {/* Top-Left Empty Cell */}
                    <div className="grid-cell grid-header top-left-corner" style={{ gridRow: 1, gridColumn: EMPLOYEE_NAME_COL }}></div>
                    {/* Generate Day Name for each date */}
                    {datesInMonth.map((date, index) => (
                        <div key={`day-name-${index}`} className="grid-cell grid-header week-day" style={{ gridRow: 1, gridColumn: DATE_START_COL + index }}>
                            {getDayName(date)} {/* Display Sat, Sun, Mon etc. */}
                        </div>
                    ))}

                    {/* --- Row 2: Date Number Headers --- */}
                    {/* Empty cell below top-left */}
                    <div className="grid-cell grid-header" style={{ gridRow: 2, gridColumn: EMPLOYEE_NAME_COL }}></div>
                     {/* Generate Date Number for each date */}
                    {datesInMonth.map((date, index) => {
                        const dayNumber = date.getDate();
                        return (
                            <div key={`date-num-${index}`} className="grid-cell grid-header date-number" style={{ gridRow: 2, gridColumn: DATE_START_COL + index }}>
                                {dayNumber} {/* Display 1, 2, 3 etc. */}
                            </div>
                        );
                    })}

                    {/* --- Employee Rows & Shift Cells --- */}
                    {employees.map((employee) => {
                        let nameRow = currentGridRow; // Start row for this employee pair
                        let titleRow = currentGridRow + 1;
                        let shiftDataRow = currentGridRow;
                        let specialMarkingsRow = currentGridRow + 1;

                        // --- Add Separator Row ---
                        const currentRoleGroup = roleOrder.find(role => employee.role?.toLowerCase().includes(role)) || 'other';
                        let separatorRow = null;
                        if (previousRoleGroup !== null && currentRoleGroup !== previousRoleGroup) {
                             separatorRow = ( <div key={`sep-${currentGridRow}`} className="grid-cell separator-row" style={{ gridRow: currentGridRow, gridColumn: `1 / ${totalDataColumns + 2}` }} ></div> ); // Span ALL columns
                            currentGridRow++; // Increment for the actual employee data
                            // Recalculate rows
                            nameRow = currentGridRow;
                            titleRow = currentGridRow + 1;
                            shiftDataRow = currentGridRow;
                            specialMarkingsRow = currentGridRow + 1;
                        }
                        previousRoleGroup = currentRoleGroup;

                        const employeeElements = (
                            <React.Fragment key={employee.id}>
                                {/* Employee Name Cell (Col 1) */}
                                <div className="grid-cell employee-name-cell" style={{ gridRow: nameRow, gridColumn: EMPLOYEE_NAME_COL }} > {employee.name} </div>
                                {/* Employee Title Cell (Col 1) */}
                                <div className="grid-cell employee-title-cell" style={{ gridRow: titleRow, gridColumn: EMPLOYEE_NAME_COL }} > {employee.role || 'N/A'} </div>

                                {/* Data Cells for this Employee */}
                                {datesInMonth.map((date, index) => {
                                    const shift = findShiftForCell(employee.id, date);
                                    const currentDataColumn = DATE_START_COL + index; // Calculate column based on date index

                                    // TODO: Add week-based background color logic here based on 'date'

                                    return (
                                        <React.Fragment key={`data-${employee.id}-${index}`}>
                                            {/* Primary Shift Data Cell */}
                                            <div className={`grid-cell shift-cell`} style={{ gridRow: shiftDataRow, gridColumn: currentDataColumn }} > {formatShiftDisplay(shift)} </div>
                                            {/* Special Markings Cell */}
                                            <div className={`grid-cell special-marking-cell`} style={{ gridRow: specialMarkingsRow, gridColumn: currentDataColumn }} > {formatSpecialMarkings(shift)} </div>
                                        </React.Fragment>
                                    );
                                })}
                            </React.Fragment>
                        );

                        currentGridRow += ROWS_PER_EMPLOYEE; // Increment row counter for the next employee pair

                        return ( <React.Fragment key={`emp-group-${employee.id}`}> {separatorRow} {employeeElements} </React.Fragment> );
                    })}
                </div> {/* End calendar-grid */}
            </div> // End schedule-calendar
        );
    };

    export default ScheduleCalendar;