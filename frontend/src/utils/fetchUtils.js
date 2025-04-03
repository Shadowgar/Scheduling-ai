// frontend/src/utils/fetchUtils.js
import { formatDateKey } from './dateUtils';

export const fetchShiftData = async (currentDate, setError, setShiftLookup) => {
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
        return newLookup;
        //setShiftLookup(newLookup); // Update state with the new map
        //if (error) setError(null); // Clear previous errors on success
    } catch (fetchError) {
        console.error("Error during shift data fetch:", fetchError);
        //setError(`Failed to load shift data: ${fetchError.message}.`);
        //setShiftLookup(new Map()); // Clear lookup on error
        return new Map();
    }
};

export const fetchEmployeeData = async (setLoading, setError, setEmployees) => {
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
        const empResponse = await fetch(employeesApiUrl, { method: 'GET', headers: headers });

        if (!empResponse.ok) {
            let errorDetails = `Employee fetch failed (${empResponse.status})`;
            try { const errorJson = await empResponse.json(); errorDetails += `: ${errorJson.error || JSON.stringify(errorJson)}`; } catch (parseError) { /* Ignore */ }
            throw new Error(errorDetails);
        }

        const empData = await empResponse.json();
        console.log(`Received ${empData.length} employees.`);
        return empData;
        // Sort using job_title (lowercase comparison) based on roleOrder
        // const sortedEmployees = empData.sort((a, b) => {
        //     const jobTitleA = a.job_title?.toLowerCase() || 'zzzz'; // Default for sorting if missing
        //     const jobTitleB = b.job_title?.toLowerCase() || 'zzzz';
        //     const indexA = roleOrder.findIndex(role => jobTitleA.includes(role));
        //     const indexB = roleOrder.findIndex(role => jobTitleB.includes(role));
        //     const effectiveIndexA = indexA === -1 ? roleOrder.length : indexA; // Put unknowns last
        //     const effectiveIndexB = indexB === -1 ? roleOrder.length : indexB;
        //     if (effectiveIndexA !== effectiveIndexB) return effectiveIndexA - effectiveIndexB;
        //     // Fallback to name sort within the same role group
        //     return a.name.localeCompare(b.name);
        // });
        //setEmployees(sortedEmployees);

        //await shiftPromise; // Wait for shifts to finish loading as well
    } catch (initialError) {
        console.error("Error fetching initial data:", initialError);
        //if (!error) setError(`Failed to load initial data: ${initialError.message}.`);
        //setEmployees([]); // Clear employees on error
        return [];
    } finally {
        setLoading(false); // Stop loading indicator
    }
};
