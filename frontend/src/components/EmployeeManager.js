import React, { useState, useEffect, useCallback } from 'react';
import 'react-datepicker/dist/react-datepicker.css';
import './EmployeeManager.css';
import { apiFetch } from '../utils/api';

const EmployeeManager = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Require full coverage state (persisted in localStorage)
    const [requireFullCoverage, setRequireFullCoverage] = useState(() => {
        const stored = localStorage.getItem('requireFullCoverage');
        return stored === null ? false : stored === 'true';
    });

    // State for Add/Edit Form
    const [showForm, setShowForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null); // null for Add, employee object for Edit
    const [formData, setFormData] = useState(getInitialFormData()); // Use helper for initial state
    const [isSubmitting, setIsSubmitting] = useState(false); // For form submission loading state

    // Persist requireFullCoverage to localStorage
    useEffect(() => {
        localStorage.setItem('requireFullCoverage', requireFullCoverage ? 'true' : 'false');
    }, [requireFullCoverage]);

    // Helper to get initial/reset form data
    function getInitialFormData() {
        return {
            name: '',
            email: '',
            phone: '',
            job_title: 'Employee', // Default job title
            access_role: 'member', // Default access role (lowercase)
            hire_date: new Date().toISOString().split('T')[0], // Default to today
            end_date: '', // Optional end date
            status: 'active', // Default status
            seniority_level: '',
            max_hours_per_week: '',
            min_hours_per_week: '',
            show_on_schedule: true, // Default to true
            password: '', // Required only for adding
            preferred_shifts: [],
            preferred_days: [],
            days_off: '', // Changed to string for simpler handling
            max_hours: '',
            max_shifts_in_a_row: '',
        };
    }

    // --- Fetch Employees for Admin View ---
    const fetchEmployees = useCallback(async () => {
        console.log("fetchEmployees called in EmployeeManager");
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('accessToken');

        if (!token) {
            setError("Authentication required to manage employees.");
            setLoading(false);
            return;
        }

        try {
            // Use the admin endpoint to get all details
            const adminEmployeesApiUrl = '/api/admin/employees';
            console.log('Fetching admin employees from:', adminEmployeesApiUrl);

            const response = await apiFetch(adminEmployeesApiUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.status === 401 || response.status === 403) {
                 const errData = await response.json().catch(() => ({}));
                 throw new Error(errData.error || `Authorization failed (${response.status}). Please log in again or check permissions.`);
            }
            if (!response.ok) {
                 const errData = await response.json().catch(() => ({}));
                 throw new Error(errData.error || `Network response was not ok (${response.status})`);
            }

            const data = await response.json();
            console.log("Admin employees received:", data);
            setEmployees(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Error fetching admin employees:", error);
            setError(`Failed to load employees: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch employees on component mount
    useEffect(() => {
        console.log("EmployeeManager mounting, fetching employees...");
        fetchEmployees();
    }, [fetchEmployees]);


    // --- Form Handling ---
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleShowAddForm = () => {
        setEditingEmployee(null);
        setFormData(getInitialFormData()); // Reset form with correct lowercase defaults
        setShowForm(true);
        setError(null);
    };

    const handleShowEditForm = (employee) => {
        console.log("Editing employee:", employee);
        setEditingEmployee(employee);
        
        // Pre-fill form data from the employee object
        setFormData({
            name: employee.name || '',
            email: employee.email || '',
            phone: employee.phone || '',
            job_title: employee.job_title || 'Employee',
            access_role: employee.access_role || 'member',
            hire_date: employee.hire_date || '',
            end_date: employee.end_date || '',
            status: employee.status || 'active',
            seniority_level: employee.seniority_level !== null ? String(employee.seniority_level) : '',
            max_hours_per_week: employee.max_hours_per_week !== null ? String(employee.max_hours_per_week) : '',
            min_hours_per_week: employee.min_hours_per_week !== null ? String(employee.min_hours_per_week) : '',
            show_on_schedule: employee.show_on_schedule !== undefined ? employee.show_on_schedule : true,
            preferred_shifts: employee.preferred_shifts || [],
            preferred_days: employee.preferred_days || [],
            days_off: employee.days_off || '', // Simplified to string
            max_hours: employee.max_hours !== null ? String(employee.max_hours) : '',
            max_shifts_in_a_row: employee.max_shifts_in_a_row !== null ? String(employee.max_shifts_in_a_row) : '',
            password: '', // Clear password field for edits
        });
        setShowForm(true);
        setError(null);
    };

    const handleCancelForm = () => {
        setShowForm(false);
        setEditingEmployee(null);
        setError(null); // Clear errors when cancelling form
    };

    // --- Form Submission (Add/Update) ---
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        setError(null); // Clear previous errors
        setIsSubmitting(true);

        const token = localStorage.getItem('accessToken');
        if (!token) {
            setError("Authentication required.");
            setIsSubmitting(false);
            return;
        }

        const url = editingEmployee
            ? `/api/employees/${editingEmployee.id}`
            : '/api/employees';
        const method = editingEmployee ? 'PUT' : 'POST';

        // Prepare data, ensuring access_role is sent as lowercase string
        const dataToSend = {
            ...formData,
            // Convert potentially empty strings for numeric fields to null or integer
            seniority_level: formData.seniority_level ? parseInt(formData.seniority_level, 10) : null,
            max_hours_per_week: formData.max_hours_per_week ? parseInt(formData.max_hours_per_week, 10) : null,
            min_hours_per_week: formData.min_hours_per_week ? parseInt(formData.min_hours_per_week, 10) : null,
            end_date: formData.end_date || null,
            preferred_shifts: formData.preferred_shifts || [],
            preferred_days: formData.preferred_days || [],
            days_off: formData.days_off || null,
            max_hours: formData.max_hours ? parseInt(formData.max_hours, 10) : null,
            max_shifts_in_a_row: formData.max_shifts_in_a_row ? parseInt(formData.max_shifts_in_a_row, 10) : null,
        };

        // Validate numeric conversions
        if (formData.seniority_level && isNaN(dataToSend.seniority_level)) {
             setError("Seniority Level must be a valid number."); setIsSubmitting(false); return;
        }
        if (formData.max_hours_per_week && isNaN(dataToSend.max_hours_per_week)) {
             setError("Max Hours/Week must be a valid number."); setIsSubmitting(false); return;
        }
        if (formData.min_hours_per_week && isNaN(dataToSend.min_hours_per_week)) {
             setError("Min Hours/Week must be a valid number."); setIsSubmitting(false); return;
        }

        // Remove password if editing and field is empty
        if (method === 'PUT' && !dataToSend.password) {
            delete dataToSend.password;
        }
        // Ensure password is included if creating
        if (method === 'POST' && !dataToSend.password) {
             setError("Password is required for new employees.");
             setIsSubmitting(false);
             return;
        }

        console.log(`Submitting ${method} to ${url} with data:`, JSON.stringify(dataToSend, null, 2));

        try {
            const response = await apiFetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(dataToSend)
            });

            const result = await response.json();

            if (!response.ok) {
                 console.error("API Error Response:", result);
                 throw new Error(result.error || `Request failed with status ${response.status}`);
            }

            console.log(`Employee ${editingEmployee ? 'updated' : 'added'} successfully:`, result);
            fetchEmployees(); // Refresh the list
            handleCancelForm(); // Close the form

        } catch (err) {
            console.error(`Error ${editingEmployee ? 'updating' : 'adding'} employee:`, err);
            setError(err.message || `Failed to ${editingEmployee ? 'update' : 'add'} employee.`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- Delete Handling ---
    const handleDeleteEmployee = async (employeeId, employeeName) => {
        // Use window.confirm for simple confirmation
        if (window.confirm(`Are you sure you want to delete employee "${employeeName}"? This action might be irreversible.`)) {
            setError(null); // Clear previous errors
            const token = localStorage.getItem('accessToken');
            if (!token) {
                setError("Authentication required.");
                return;
            }

            console.log("Attempting to delete employee:", employeeId);

            try {
                 const response = await apiFetch(`/api/employees/${employeeId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                 });

                 // Check for 204 No Content (successful delete with no body)
                 if (response.status === 204) {
                    console.log(`Employee ${employeeId} deleted successfully (204).`);
                 } else if (response.ok) {
                    // Handle 200 OK with message body
                    const result = await response.json();
                    console.log(`Employee ${employeeId} deleted successfully:`, result.message);
                 } else {
                     // Handle other error statuses (4xx, 5xx)
                     const result = await response.json().catch(() => ({})); // Try to parse error body
                     throw new Error(result.error || `Failed to delete (${response.status})`);
                 }

                 fetchEmployees(); // Refresh list on success

            } catch (err) {
                 console.error("Error deleting employee:", err);
                 setError(err.message || "Failed to delete employee."); // Show error message
            }
        }
    };

    // --- Render Logic ---
    // Show loading indicator only on initial load
    if (loading && employees.length === 0) return <div className="loading-container">Loading Employees...</div>;

    // Show primary error if loading failed and no employees are loaded (and form isn't shown)
    if (error && employees.length === 0 && !showForm) return <div className="error error-message">Error: {error} <button onClick={fetchEmployees}>Retry</button></div>;

    return (
        <div className="employee-manager">
            <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f8f8f8', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                <input
                    type="checkbox"
                    id="requireFullCoverage"
                    checked={requireFullCoverage}
                    onChange={e => setRequireFullCoverage(e.target.checked)}
                    style={{ marginRight: 8 }}
                />
                <label htmlFor="requireFullCoverage" style={{ fontWeight: 500 }}>
                    Require all shifts (1,2,3) to be filled by Police
                </label>
                <span style={{ marginLeft: 10, color: '#888', fontSize: '0.95em' }}>
                    (Controls schedule conflict highlighting for Police coverage in the calendar)
                </span>
            </div>
            <h2>Manage Employees</h2>

             {/* Show inline error if loading succeeded but there was a subsequent error (e.g., delete failed) */}
             {error && !showForm && employees.length > 0 && (
                <div className="error error-message error-inline">{error}</div>
             )}

            {!showForm && (
                <button onClick={handleShowAddForm} className="add-button">
                    + Add New Employee
                </button>
            )}

            {/* --- Add/Edit Form --- */}
            {showForm && (
                <div className="employee-form-container">
                    <h3 className="text-xl font-semibold mb-6">{editingEmployee ? `Edit Employee: ${editingEmployee.name}` : 'Add New Employee'}</h3>
                    {error && <div className="form-error error-message">{error}</div>}
                    <form onSubmit={handleSubmitForm}>
                        {/* --- Basic Info --- */}
                        <div className="mb-6">
                            <div className="form-group">
                                <label htmlFor="name">Full Name<span className="text-red-500">*</span></label>
                                <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} required disabled={isSubmitting}/>
                                <div className="text-xs text-gray-500 mt-1">Enter the employee's full legal name.</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="email">Email<span className="text-red-500">*</span></label>
                                <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} required disabled={isSubmitting}/>
                                <div className="text-xs text-gray-500 mt-1">Work or personal email for notifications and login.</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="phone">Phone</label>
                                <input type="tel" id="phone" name="phone" value={formData.phone || ''} onChange={handleInputChange} disabled={isSubmitting}/>
                                <div className="text-xs text-gray-500 mt-1">Optional. For urgent contact (e.g., 555-123-4567).</div>
                            </div>
                        </div>
                        <hr className="my-4"/>
                        {/* --- Job Details --- */}
                        <div className="mb-6">
                            <div className="form-group">
                                <label htmlFor="job_title">Job Title<span className="text-red-500">*</span></label>
                                <select id="job_title" name="job_title" value={formData.job_title} onChange={handleInputChange} required disabled={isSubmitting}>
                                    <option value="Employee">Employee</option>
                                    <option value="Supervisor">Supervisor</option>
                                    <option value="Police">Police</option>
                                    <option value="Security">Security</option>
                                </select>
                                <div className="text-xs text-gray-500 mt-1">Determines scheduling rules and permissions.</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="access_role">Access Role<span className="text-red-500">*</span></label>
                                <select id="access_role" name="access_role" value={formData.access_role} onChange={handleInputChange} required disabled={isSubmitting}>
                                    <option value="member">Member</option>
                                    <option value="supervisor">Supervisor</option>
                                </select>
                                <div className="text-xs text-gray-500 mt-1">Supervisors can manage employees and schedules.</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="hire_date">Hire Date<span className="text-red-500">*</span></label>
                                <input type="date" id="hire_date" name="hire_date" value={formData.hire_date} onChange={handleInputChange} required disabled={isSubmitting}/>
                                <div className="text-xs text-gray-500 mt-1">Date the employee started working.</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="end_date">End Date</label>
                                <input type="date" id="end_date" name="end_date" value={formData.end_date || ''} onChange={handleInputChange} disabled={isSubmitting}/>
                                <div className="text-xs text-gray-500 mt-1">Optional. Last day of employment, if applicable.</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="status">Status<span className="text-red-500">*</span></label>
                                <select id="status" name="status" value={formData.status} onChange={handleInputChange} required disabled={isSubmitting}>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="on_leave">On Leave</option>
                                </select>
                                <div className="text-xs text-gray-500 mt-1">Active employees are scheduled; others are not.</div>
                            </div>
                            <div className="form-group checkbox-group flex items-center">
                                <input type="checkbox" id="show_on_schedule" name="show_on_schedule" checked={formData.show_on_schedule} onChange={handleInputChange} disabled={isSubmitting} className="mr-2"/>
                                <label htmlFor="show_on_schedule">Show on Schedule</label>
                                <div className="text-xs text-gray-500 ml-2">Uncheck to hide from the schedule (e.g., for long-term leave).</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="password">Password<span className="text-red-500">{!editingEmployee ? '*' : ''}</span></label>
                                <input type="password" id="password" name="password" value={formData.password} onChange={handleInputChange} required={!editingEmployee} placeholder={editingEmployee ? '(Leave blank to keep unchanged)' : 'Required for new employee'} disabled={isSubmitting}/>
                                <div className="text-xs text-gray-500 mt-1">
                                    {!editingEmployee ? "Password is required when adding a new employee." : "Leave blank to keep the current password."}
                                </div>
                            </div>
                        </div>
                        <hr className="my-4"/>
                        {/* --- Scheduling Preferences (Collapsible Advanced Section) --- */}
                        <details className="mb-4" open>
                            <summary className="font-semibold cursor-pointer mb-2">Advanced Scheduling Preferences (Optional)</summary>
                            <div className="form-group">
                                <label htmlFor="seniority_level">Seniority Level</label>
                                <input type="number" id="seniority_level" name="seniority_level" value={formData.seniority_level || ''} onChange={handleInputChange} min="0" step="1" disabled={isSubmitting}/>
                                <div className="text-xs text-gray-500 mt-1">Higher numbers indicate more seniority (for shift priority).</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="max_hours_per_week">Max Hours/Week</label>
                                <input type="number" id="max_hours_per_week" name="max_hours_per_week" value={formData.max_hours_per_week || ''} onChange={handleInputChange} min="0" step="1" disabled={isSubmitting}/>
                                <div className="text-xs text-gray-500 mt-1">Maximum hours this employee can be scheduled per week.</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="min_hours_per_week">Min Hours/Week</label>
                                <input type="number" id="min_hours_per_week" name="min_hours_per_week" value={formData.min_hours_per_week || ''} onChange={handleInputChange} min="0" step="1" disabled={isSubmitting}/>
                                <div className="text-xs text-gray-500 mt-1">Minimum hours this employee should be scheduled per week.</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="preferred_shifts">Preferred Shifts</label>
                                <input
                                    type="text"
                                    id="preferred_shifts"
                                    name="preferred_shifts"
                                    value={Array.isArray(formData.preferred_shifts) ? formData.preferred_shifts.join(', ') : formData.preferred_shifts || ''}
                                    onChange={(e) => {
                                        const shiftsArray = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                                        setFormData(prev => ({ ...prev, preferred_shifts: shiftsArray }));
                                    }}
                                    placeholder="e.g., Morning, Afternoon, Evening"
                                    disabled={isSubmitting}
                                />
                                <div className="text-xs text-gray-500 mt-1">Comma-separated. Example: Morning, Afternoon, Evening.</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="preferred_days">Preferred Days</label>
                                <input
                                    type="text"
                                    id="preferred_days"
                                    name="preferred_days"
                                    value={Array.isArray(formData.preferred_days) ? formData.preferred_days.join(', ') : formData.preferred_days || ''}
                                    onChange={(e) => {
                                        const daysArray = e.target.value.split(',').map(d => d.trim()).filter(d => d);
                                        setFormData(prev => ({ ...prev, preferred_days: daysArray }));
                                    }}
                                    placeholder="e.g., Monday, Tuesday"
                                    disabled={isSubmitting}
                                />
                                <div className="text-xs text-gray-500 mt-1">Comma-separated. Example: Monday, Tuesday.</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="days_off">Scheduling Preferences/Days Off</label>
                                <textarea
                                    id="days_off"
                                    name="days_off"
                                    value={formData.days_off || ''}
                                    onChange={handleInputChange}
                                    placeholder="e.g., Prefers weekends off, Unavailable 1st week of July, Cannot work Mondays"
                                    rows={3}
                                    disabled={isSubmitting}
                                />
                                <div className="text-xs text-gray-500 mt-1">Describe any special requests or restrictions in plain language.</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="max_hours">Max Hours</label>
                                <input type="number" id="max_hours" name="max_hours" value={formData.max_hours || ''} onChange={handleInputChange} min="0" step="1" disabled={isSubmitting}/>
                                <div className="text-xs text-gray-500 mt-1">Absolute maximum hours per week (overrides other settings).</div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="max_shifts_in_a_row">Max Shifts in a Row</label>
                                <input type="number" id="max_shifts_in_a_row" name="max_shifts_in_a_row" value={formData.max_shifts_in_a_row || ''} onChange={handleInputChange} min="0" step="1" disabled={isSubmitting}/>
                                <div className="text-xs text-gray-500 mt-1">Maximum consecutive shifts this employee can work.</div>
                            </div>
                        </details>
                        {/* --- Form Actions --- */}
                        <div className="form-actions">
                            <button type="submit" className="save-button" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : (editingEmployee ? 'Update Employee' : 'Save Employee')}
                            </button>
                            <button type="button" onClick={handleCancelForm} className="cancel-button" disabled={isSubmitting}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* --- Employee List --- */}
            {!showForm && (
                 <table className="employee-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Job Title</th>
                            <th>Access Role</th>
                            <th>Shows on Schedule?</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Render employees only if not loading and employees array exists */}
                        {!loading && employees && employees.map(emp => (
                            <tr key={emp.id}>
                                <td>{emp.name}</td>
                                <td>{emp.email}</td>
                                <td>{emp.job_title || 'N/A'}</td>
                                <td>{emp.access_role || 'N/A'}</td>
                                <td>{emp.show_on_schedule ? 'Yes' : 'No'}</td>
                                <td>{emp.status || 'N/A'}</td>
                                <td className="action-buttons">
                                    <button onClick={() => handleShowEditForm(emp)} className="edit-button">Edit</button>
                                    <button onClick={() => handleDeleteEmployee(emp.id, emp.name)} className="delete-button">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {/* Show message if loading finished but no employees */}
                        {employees.length === 0 && !loading && (
                            <tr>
                                <td colSpan="7">No employees found. Add one using the button above.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default EmployeeManager;
