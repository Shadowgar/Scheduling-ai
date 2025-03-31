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
            job_title: 'Employee', // Default job title
            access_role: 'member', // *** CORRECTED: Default access role (lowercase) ***
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

            const response = await fetch(adminEmployeesApiUrl, {
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
            // Data contains job_title and access_role (lowercase string)
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
        console.log("Editing employee:", employee); // Should have job_title, access_role
        setEditingEmployee(employee);
        // Pre-fill form data from the employee object
        setFormData({
            name: employee.name || '',
            email: employee.email || '',
            phone: employee.phone || '',
            job_title: employee.job_title || 'Employee',
            // *** CORRECTED: Use lowercase default if missing ***
            access_role: employee.access_role || 'member',
            hire_date: employee.hire_date || '', // Should be YYYY-MM-DD from API
            end_date: employee.end_date || '', // Should be YYYY-MM-DD from API or null
            status: employee.status || 'active',
            seniority_level: employee.seniority_level !== null ? String(employee.seniority_level) : '',
            max_hours_per_week: employee.max_hours_per_week !== null ? String(employee.max_hours_per_week) : '',
            min_hours_per_week: employee.min_hours_per_week !== null ? String(employee.min_hours_per_week) : '',
            show_on_schedule: employee.show_on_schedule !== undefined ? employee.show_on_schedule : true,
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
        // Convert numeric fields correctly, handle null for optional ones
        const dataToSend = {
            ...formData,
            // access_role is already lowercase from state/select
            access_role: formData.access_role,
            // Convert potentially empty strings for numeric fields to null or integer
            seniority_level: formData.seniority_level ? parseInt(formData.seniority_level, 10) : null,
            max_hours_per_week: formData.max_hours_per_week ? parseInt(formData.max_hours_per_week, 10) : null,
            min_hours_per_week: formData.min_hours_per_week ? parseInt(formData.min_hours_per_week, 10) : null,
            // Send end_date as null if empty string
            end_date: formData.end_date || null,
            // show_on_schedule is already boolean from checkbox
        };

        // Validate numeric conversions (optional but good practice)
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
            const response = await fetch(url, {
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
                 // Use the error message from the backend response if available
                 throw new Error(result.error || `Request failed with status ${response.status}`);
            }

            console.log(`Employee ${editingEmployee ? 'updated' : 'added'} successfully:`, result);
            fetchEmployees(); // Refresh the list
            handleCancelForm(); // Close the form

        } catch (err) {
            console.error(`Error ${editingEmployee ? 'updating' : 'adding'} employee:`, err);
            // Display the caught error message
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
                 const response = await fetch(`/api/employees/${employeeId}`, {
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
                    <h3>{editingEmployee ? `Edit Employee: ${editingEmployee.name}` : 'Add New Employee'}</h3>
                    {/* Display form-specific errors */}
                    {error && <div className="form-error error-message">{error}</div>}
                    <form onSubmit={handleSubmitForm}>
                        {/* --- Required Fields --- */}
                        <div className="form-group">
                            <label htmlFor="name">Name:</label>
                            <input type="text" id="name" name="name" value={formData.name} onChange={handleInputChange} required disabled={isSubmitting}/>
                        </div>
                         <div className="form-group">
                            <label htmlFor="email">Email:</label>
                            <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} required disabled={isSubmitting}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="job_title">Job Title:</label>
                            <select id="job_title" name="job_title" value={formData.job_title} onChange={handleInputChange} required disabled={isSubmitting}>
                                <option value="Employee">Employee</option>
                                <option value="Supervisor">Supervisor</option>
                                <option value="Police">Police</option>
                                <option value="Security">Security</option>
                                {/* Add other valid job titles as needed */}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="access_role">Access Role:</label>
                            {/* Use lowercase values */}
                            <select id="access_role" name="access_role" value={formData.access_role} onChange={handleInputChange} required disabled={isSubmitting}>
                                <option value="member">Member</option>
                                <option value="supervisor">Supervisor</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="hire_date">Hire Date:</label>
                            <input type="date" id="hire_date" name="hire_date" value={formData.hire_date} onChange={handleInputChange} required disabled={isSubmitting}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="status">Status:</label>
                            <select id="status" name="status" value={formData.status} onChange={handleInputChange} required disabled={isSubmitting}>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="on_leave">On Leave</option>
                                {/* Avoid showing 'terminated' as an option to set */}
                            </select>
                        </div>
                        <div className="form-group checkbox-group">
                            <label htmlFor="show_on_schedule">Show on Schedule:</label>
                            <input type="checkbox" id="show_on_schedule" name="show_on_schedule" checked={formData.show_on_schedule} onChange={handleInputChange} disabled={isSubmitting}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">Password:</label>
                            <input type="password" id="password" name="password" value={formData.password} onChange={handleInputChange} required={!editingEmployee} placeholder={editingEmployee ? '(Leave blank to keep unchanged)' : 'Required for new employee'} disabled={isSubmitting}/>
                            {!editingEmployee && <small>Password is required when adding a new employee.</small>}
                            {editingEmployee && <small>Leave blank to keep the current password.</small>}
                        </div>

                        {/* --- Optional Fields --- */}
                         <div className="form-group">
                            <label htmlFor="phone">Phone:</label>
                            <input type="tel" id="phone" name="phone" value={formData.phone || ''} onChange={handleInputChange} disabled={isSubmitting}/>
                        </div>
                         <div className="form-group">
                            <label htmlFor="end_date">End Date (Optional):</label>
                            <input type="date" id="end_date" name="end_date" value={formData.end_date || ''} onChange={handleInputChange} disabled={isSubmitting}/>
                        </div>
                         <div className="form-group">
                            <label htmlFor="seniority_level">Seniority Level (Optional):</label>
                            <input type="number" id="seniority_level" name="seniority_level" value={formData.seniority_level || ''} onChange={handleInputChange} min="0" step="1" disabled={isSubmitting}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="max_hours_per_week">Max Hours/Week (Optional):</label>
                            <input type="number" id="max_hours_per_week" name="max_hours_per_week" value={formData.max_hours_per_week || ''} onChange={handleInputChange} min="0" step="1" disabled={isSubmitting}/>
                        </div>
                        <div className="form-group">
                            <label htmlFor="min_hours_per_week">Min Hours/Week (Optional):</label>
                            <input type="number" id="min_hours_per_week" name="min_hours_per_week" value={formData.min_hours_per_week || ''} onChange={handleInputChange} min="0" step="1" disabled={isSubmitting}/>
                        </div>

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
                            <th>Job Title</th> {/* Display Job Title */}
                            <th>Access Role</th> {/* Display Access Role */}
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
                                <td>{emp.job_title || 'N/A'}</td> {/* Show Job Title */}
                                <td>{emp.access_role || 'N/A'}</td> {/* Show Access Role (lowercase) */}
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