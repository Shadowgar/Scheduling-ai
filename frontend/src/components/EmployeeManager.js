// frontend/src/components/EmployeeManager.js
import React, { useState, useEffect, useCallback } from 'react';
import './EmployeeManager.css'; // Make sure you have this CSS file

const EmployeeManager = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for Add/Edit Form
    const [showForm, setShowForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null); // null for Add, employee object for Edit
    const [formData, setFormData] = useState(getInitialFormData()); // Use helper for initial state
    const [isSubmitting, setIsSubmitting] = useState(false); // For form submission loading state

    // Helper to get initial/reset form data
    function getInitialFormData() {
        return {
            name: '',
            email: '',
            phone: '',
            role: 'employee', // Default role
            hire_date: new Date().toISOString().split('T')[0], // Default to today
            end_date: '', // Optional end date
            status: 'active', // Default status
            seniority_level: '',
            max_hours_per_week: '',
            min_hours_per_week: '',
            show_on_schedule: true, // Default to true
            password: '', // Required only for adding
        };
    }

    // --- Fetch Employees for Admin View ---
    const fetchEmployees = useCallback(async () => {
        console.log("fetchEmployees called in EmployeeManager"); // Log when called
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('accessToken');

        if (!token) {
            setError("Authentication required to manage employees.");
            setLoading(false);
            return;
        }

        try {
            // *** USE THE NEW ADMIN ENDPOINT ***
            const adminEmployeesApiUrl = '/api/admin/employees';
            console.log('Fetching admin employees from:', adminEmployeesApiUrl);

            const response = await fetch(adminEmployeesApiUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401 || response.status === 403) {
                 const errData = await response.json().catch(() => ({})); // Try parsing error
                 throw new Error(errData.error || `Authorization failed (${response.status}). Please log in again or check permissions.`);
            }
            if (!response.ok) {
                 const errData = await response.json().catch(() => ({})); // Try parsing error
                 throw new Error(errData.error || `Network response was not ok (${response.status})`);
            }

            const data = await response.json();
            console.log("Admin employees received:", data); // Log received data
            // Sorting by name, could add role sorting later if needed
            setEmployees(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Error fetching admin employees:", error);
            setError(`Failed to load employees: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, []); // No external dependencies needed for this fetch logic itself

    // Fetch employees on component mount
    useEffect(() => {
        console.log("EmployeeManager mounting, fetching employees...");
        fetchEmployees();
    }, [fetchEmployees]); // Depend on the memoized fetchEmployees function


    // --- Form Handling ---
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            // Use checked for checkbox, value otherwise
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleShowAddForm = () => {
        setEditingEmployee(null); // Ensure it's an add operation
        setFormData(getInitialFormData()); // Reset form
        setShowForm(true);
        setError(null); // Clear previous form errors
    };

    const handleShowEditForm = (employee) => {
        console.log("Editing employee:", employee); // Log the employee being edited
        setEditingEmployee(employee);
        // Pre-fill form data from the employee object
        setFormData({
            name: employee.name || '',
            email: employee.email || '',
            phone: employee.phone || '',
            role: employee.role || 'employee',
            hire_date: employee.hire_date || '', // Assumes ISO string YYYY-MM-DD format
            end_date: employee.end_date || '', // Assumes ISO string YYYY-MM-DD format
            status: employee.status || 'active',
            seniority_level: employee.seniority_level !== null ? String(employee.seniority_level) : '', // Handle null
            max_hours_per_week: employee.max_hours_per_week !== null ? String(employee.max_hours_per_week) : '',
            min_hours_per_week: employee.min_hours_per_week !== null ? String(employee.min_hours_per_week) : '',
            show_on_schedule: employee.show_on_schedule !== undefined ? employee.show_on_schedule : true,
            password: '', // Clear password field for edits - DO NOT pre-fill hash
        });
        setShowForm(true);
        setError(null); // Clear previous form errors
    };

    const handleCancelForm = () => {
        setShowForm(false);
        setEditingEmployee(null);
        setError(null); // Clear any form errors
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
            ? `/api/employees/${editingEmployee.id}` // PUT for update
            : '/api/employees'; // POST for create
        const method = editingEmployee ? 'PUT' : 'POST';

        // Prepare data, remove empty password for PUT unless it's being changed
        // Convert potentially empty string numbers to null or integer
        const dataToSend = {
            ...formData,
            seniority_level: formData.seniority_level ? parseInt(formData.seniority_level, 10) : null,
            max_hours_per_week: formData.max_hours_per_week ? parseInt(formData.max_hours_per_week, 10) : null,
            min_hours_per_week: formData.min_hours_per_week ? parseInt(formData.min_hours_per_week, 10) : null,
            end_date: formData.end_date || null, // Ensure null if empty string
        };

        // Remove password from payload if editing and password field is empty
        if (method === 'PUT' && !dataToSend.password) {
            delete dataToSend.password;
        }
        // Ensure password is included if creating
        if (method === 'POST' && !dataToSend.password) {
             setError("Password is required for new employees.");
             setIsSubmitting(false);
             return;
        }

        console.log(`Submitting ${method} to ${url} with data:`, JSON.stringify(dataToSend, null, 2)); // Pretty print payload

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(dataToSend)
            });

            const result = await response.json(); // Try to parse response regardless of status

            if (!response.ok) {
                 // Use error message from backend if available
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
        // Optional: Add extra confirmation or prevent deleting self/active employees
        if (window.confirm(`Are you sure you want to delete employee "${employeeName}"? This action might be irreversible depending on backend logic (delete vs terminate).`)) {
            setError(null); // Clear previous errors
            const token = localStorage.getItem('accessToken');
            if (!token) {
                setError("Authentication required.");
                return;
            }

            console.log("Attempting to delete employee:", employeeId);

            try {
                 const response = await fetch(`/api/employees/${employeeId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                 });

                 // Check for success (200 OK with message or 204 No Content)
                 if (response.status === 204) {
                    console.log(`Employee ${employeeId} deleted successfully (204).`);
                 } else if (response.ok) {
                    const result = await response.json(); // Assume 200 OK has message
                    console.log(`Employee ${employeeId} deleted successfully:`, result.message);
                 } else {
                     // Try to parse error from non-ok response
                     const result = await response.json().catch(() => ({}));
                     throw new Error(result.error || `Failed to delete (${response.status})`);
                 }

                 fetchEmployees(); // Refresh list on success

            } catch (err) {
                 console.error("Error deleting employee:", err);
                 setError(err.message || "Failed to delete employee.");
            }
        }
    };


    // --- Render Logic ---
    if (loading && employees.length === 0) return <div className="loading-container">Loading Employees...</div>;
    // Display error prominently if it occurs outside the form context and prevents loading
    if (error && employees.length === 0 && !showForm) return <div className="error error-message">Error: {error} <button onClick={fetchEmployees}>Retry</button></div>;


    return (
        <div className="employee-manager">
            <h2>Manage Employees</h2>

             {/* Show general errors (like delete failure) that don't block the whole view */}
             {error && !showForm && employees.length > 0 && (
                <div className="error error-message error-inline">{error}</div>
             )}


            {!showForm && (
                <button onClick={handleShowAddForm} className="add-button">
                    + Add New Employee
                </button>
            )}

            {/* --- Add/Edit Form (Conditional) --- */}
            {showForm && (
                <div className="employee-form-container">
                    <h3>{editingEmployee ? `Edit Employee: ${editingEmployee.name}` : 'Add New Employee'}</h3>
                    {/* Display form-specific errors */}
                    {error && <div className="form-error error-message">{error}</div>}
                    <form onSubmit={handleSubmitForm}>
                        {/* Use grid or flexbox for better layout if needed */}
                        {/* Name */}
                        <div className="form-group">
                            <label htmlFor="name">Name:</label>
                            <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} required disabled={isSubmitting}/>
                        </div>
                         {/* Email */}
                         <div className="form-group">
                            <label htmlFor="email">Email:</label>
                            <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} required disabled={isSubmitting}/>
                        </div>
                         {/* Phone */}
                         <div className="form-group">
                            <label htmlFor="phone">Phone:</label>
                            <input type="tel" id="phone" name="phone" value={formData.phone || ''} onChange={handleInputChange} disabled={isSubmitting}/>
                        </div>
                        {/* Role */}
                        <div className="form-group">
                            <label htmlFor="role">Role:</label>
                            <select id="role" name="role" value={formData.role} onChange={handleInputChange} required disabled={isSubmitting}>
                                <option value="employee">Employee</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="police">Police</option>
                                <option value="security">Security</option>
                                {/* Add other valid roles */}
                            </select>
                        </div>
                         {/* Hire Date */}
                         <div className="form-group">
                            <label htmlFor="hire_date">Hire Date:</label>
                            <input type="date" id="hire_date" name="hire_date" value={formData.hire_date} onChange={handleInputChange} required disabled={isSubmitting}/>
                        </div>
                         {/* End Date */}
                         <div className="form-group">
                            <label htmlFor="end_date">End Date:</label>
                            <input type="date" id="end_date" name="end_date" value={formData.end_date || ''} onChange={handleInputChange} disabled={isSubmitting}/>
                        </div>
                         {/* Status */}
                         <div className="form-group">
                            <label htmlFor="status">Status:</label>
                            <select id="status" name="status" value={formData.status} onChange={handleInputChange} required disabled={isSubmitting}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="on_leave">On Leave</option>
                                {/* Only allow setting terminated via specific action? */}
                                {/* <option value="terminated">Terminated</option> */}
                            </select>
                        </div>
                         {/* Show on Schedule */}
                         <div className="form-group checkbox-group">
                            <label htmlFor="show_on_schedule">Show on Schedule:</label>
                            <input type="checkbox" id="show_on_schedule" name="show_on_schedule" checked={formData.show_on_schedule} onChange={handleInputChange} disabled={isSubmitting}/>
                        </div>
                         {/* Password (only required for Add) */}
                         <div className="form-group">
                            <label htmlFor="password">Password:</label>
                            <input type="password" id="password" name="password" value={formData.password} onChange={handleInputChange} required={!editingEmployee} placeholder={editingEmployee ? '(Leave blank to keep unchanged)' : 'Required for new employee'} disabled={isSubmitting}/>
                            {!editingEmployee && <small>Password is required when adding a new employee.</small>}
                            {editingEmployee && <small>Leave blank to keep the current password.</small>}
                         </div>

                        {/* Optional Fields */}
                         <div className="form-group">
                            <label htmlFor="seniority_level">Seniority Level:</label>
                            <input type="number" id="seniority_level" name="seniority_level" value={formData.seniority_level || ''} onChange={handleInputChange} disabled={isSubmitting}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="max_hours_per_week">Max Hours/Week:</label>
                            <input type="number" id="max_hours_per_week" name="max_hours_per_week" value={formData.max_hours_per_week || ''} onChange={handleInputChange} disabled={isSubmitting}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="min_hours_per_week">Min Hours/Week:</label>
                            <input type="number" id="min_hours_per_week" name="min_hours_per_week" value={formData.min_hours_per_week || ''} onChange={handleInputChange} disabled={isSubmitting}/>
                        </div>

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
                            <th>Role</th>
                            <th>Shows on Schedule?</th> {/* Added column */}
                            <th>Status</th> {/* Added column */}
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map(emp => (
                            <tr key={emp.id}>
                                <td>{emp.name}</td>
                                <td>{emp.email}</td>
                                <td>{emp.role || 'N/A'}</td>
                                <td>{emp.show_on_schedule ? 'Yes' : 'No'}</td> {/* Display value */}
                                <td>{emp.status || 'N/A'}</td> {/* Display value */}
                                <td className="action-buttons">
                                    <button onClick={() => handleShowEditForm(emp)} className="edit-button">Edit</button>
                                    {/* Prevent deleting self? Add logic if needed */}
                                    <button onClick={() => handleDeleteEmployee(emp.id, emp.name)} className="delete-button">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {employees.length === 0 && !loading && (
                            <tr>
                                <td colSpan="6">No employees found.</td> {/* Adjusted colspan */}
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default EmployeeManager;