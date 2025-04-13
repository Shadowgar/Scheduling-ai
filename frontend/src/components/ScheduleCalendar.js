// frontend/src/components/ScheduleCalendar.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './ScheduleCalendar.css'; // Make sure styles for note-indicator are here
import ShiftModal from './ShiftModal'; // Ensure ShiftModal is imported
import { formatDateKey } from '../utils/dateUtils';
import { roleOrder } from '../utils/formatUtils';
import { fetchShiftData, fetchEmployeeData } from '../utils/fetchUtils';
import CalendarHeader from './CalendarHeader';
import CalendarGrid from './CalendarGrid';

// Use job title strings for sorting order (lowercase)
const todayDateStr = formatDateKey(new Date());

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
    const memoizedFetchShiftData = useCallback(async () => {
        try {
            const shiftData = await fetchShiftData(currentDate, setError);
            setShiftLookup(shiftData);
            if (error) setError(null);
        } catch (e) {
            console.error("Error fetching shift data:", e);
            setError(`Failed to load shift data: ${e.message}.`);
            setShiftLookup(new Map());
        }
    }, [currentDate, setError, error]);

    // --- Fetch Initial Data (Employees for Schedule View) ---
    // Fetches the list of employees to display on the schedule
    const memoizedFetchEmployeeData = useCallback(async () => {
        try {
            const employeeData = await fetchEmployeeData(setLoading, setError);
            const sortedEmployees = employeeData.sort((a, b) => {
                const jobTitleA = a.job_title?.toLowerCase() || 'zzzz'; // Default for sorting if missing
                const jobTitleB = b.job_title?.toLowerCase() || 'zzzz';
                const indexA = roleOrder.findIndex(role => jobTitleA.includes(role));
                const indexB = roleOrder.findIndex(role => jobTitleB.includes(role));
                const effectiveIndexA = indexA === -1 ? roleOrder.length : indexA; // Put unknowns last
                const effectiveIndexB = indexB === -1 ? roleOrder.length : indexB;
                if (effectiveIndexA !== effectiveIndexB) return effectiveIndexA - effectiveIndexB;
                return a.name.localeCompare(b.name);
            });
            setEmployees(sortedEmployees);
        } catch (e) {
            console.error("Error fetching employee data:", e);
            setError(`Failed to load employee data: ${e.message}.`);
            setEmployees([]);
        }
    }, [setLoading, setError]);

    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            if (isMounted) {
                console.log("Mounting/Date Change: Fetching initial data...");
                setLoading(true);
                setError(null);

                try {
                    await memoizedFetchEmployeeData();
                    await memoizedFetchShiftData();
                } catch (initialError) {
                    console.error("Error fetching initial data:", initialError);
                    if (!error) setError(`Failed to load initial data: ${initialError.message}.`);
                    setEmployees([]);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadData();
        return () => {
            isMounted = false;
            console.log("Unmounting ScheduleCalendar or date changed, cleanup.");
        };
    }, [memoizedFetchEmployeeData, memoizedFetchShiftData, error, setLoading, setError, setEmployees]);

    const { year, month, monthName, datesInMonth } = useMemo(() => {
        const yr = currentDate.getFullYear();
        const mnth = currentDate.getMonth();
        const name = currentDate.toLocaleString('default', { month: 'long' });
        const numDays = new Date(yr, mnth + 1, 0).getDate();
        const dates = Array.from({ length: numDays }, (_, i) => new Date(yr, mnth, i + 1));
        return { year: yr, month: mnth, monthName: name, daysInMonth: numDays, datesInMonth: dates };
    }, [currentDate]);

    const firstDayOfMonth = useMemo(() => new Date(year, month, 1), [year, month]);

    // --- Month Navigation ---
    const goToPreviousMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // --- Click Handler for Cells ---
    // Opens the modal with data for the clicked cell
    const handleCellClick = (employee, date, shift) => {
        console.log(`Cell Clicked: Emp ${employee?.id}, Date ${formatDateKey(date)}, Shift Exists: ${!!shift}`);
        // Only allow opening modal if userAccessRole !== 'supervisor'
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
    const handleShiftUpdate = () => {
        console.log("Shift update detected, re-fetching shift data...");
        memoizedFetchShiftData(); // Re-fetch only the shift data for the current month
    };

    // --- Conflict Detection Logic ---
    const [requireFullCoverage, setRequireFullCoverage] = useState(() => {
        const stored = localStorage.getItem('requireFullCoverage');
        return stored === null ? false : stored === 'true';
    });
    // Listen for changes to requireFullCoverage in localStorage (set by EmployeeManager)
    useEffect(() => {
        const handleStorage = () => {
            const stored = localStorage.getItem('requireFullCoverage');
            setRequireFullCoverage(stored === 'true');
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);
    // Also update requireFullCoverage on mount in case it was changed elsewhere
    useEffect(() => {
        const stored = localStorage.getItem('requireFullCoverage');
        setRequireFullCoverage(stored === 'true');
    }, []);
    const conflictMap = useMemo(() => {
        if (!requireFullCoverage) return {};
        // Build a map: { [dateKey]: { [shiftNumber]: true } }
        const conflicts = {};
        // For each date in the month
        datesInMonth.forEach(date => {
            const dateKey = formatDateKey(date);
            // For each shift number (1,2,3)
            [1,2,3].forEach(shiftNum => {
                // Find all shifts for this date and shiftNum
                const shiftsForThisShiftNum = [];
                employees.forEach(emp => {
                    const empShifts = shiftLookup.get(emp.id);
                    if (empShifts) {
                        const shift = empShifts.get(dateKey);
                        if (shift) {
                            // Determine shift number using start/end time logic
                            const start = new Date(shift.start_time);
                            const end = new Date(shift.end_time);
                            const startH = start.getHours();
                            const endH = end.getHours();
                            const durationMs = end.getTime() - start.getTime();
                            let shiftNumber = null;
                            if (startH === 7 && endH === 15) shiftNumber = 1;
                            else if (startH === 15 && endH === 23) shiftNumber = 2;
                            else if (startH === 23 && endH === 7 && durationMs > 6 * 3600 * 1000 && durationMs < 10 * 3600 * 1000) shiftNumber = 3;
                            if (shiftNumber === shiftNum) {
                                shiftsForThisShiftNum.push({ ...shift, employee: emp });
                            }
                        }
                    }
                });
                // Check if at least one Police is assigned
                const hasPolice = shiftsForThisShiftNum.some(s => (s.employee?.job_title || '').toLowerCase() === 'police');
                if (!hasPolice) {
                    if (!conflicts[dateKey]) conflicts[dateKey] = {};
                    conflicts[dateKey][shiftNum] = true;
                }
            });
        });
        return conflicts;
    }, [requireFullCoverage, datesInMonth, employees, shiftLookup]);
    
    // --- Render Logic ---
    // Loading indicator
    if (loading) return <div className="loading-container">Loading Schedule...</div>;

    // Error display if initial load failed completely
    if (error && employees.length === 0 && !isModalOpen) {
         return <div className="error error-message">Error: {error} <button onClick={memoizedFetchShiftData}>Retry Shifts</button></div>;
    }

    console.log(`Rendering grid. User Role:`, userAccessRole);

    return (
        <div className="schedule-calendar-container" style={{ position: 'relative' }}>
            <div className="schedule-calendar">
                {/* Header with Month/Year and Navigation Buttons */}
                <CalendarHeader
                    monthName={monthName}
                    year={year}
                    goToPreviousMonth={goToPreviousMonth}
                    goToNextMonth={goToNextMonth}
                />

                {/* Optional Inline Error (if shifts failed but employees loaded) */}
                {error && employees.length > 0 && !isModalOpen && (
                     <div className="error error-message error-inline">
                        Shift loading issue: {error}
                     </div>
                )}

                {/* Grid Area */}
                <CalendarGrid
                    employees={employees}
                    datesInMonth={datesInMonth}
                    shiftLookup={shiftLookup}
                    userAccessRole={userAccessRole}
                    handleCellClick={handleCellClick}
                    firstDayOfMonth={firstDayOfMonth}
                    todayDateStr={todayDateStr}
                    conflictMap={conflictMap}
                />
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
