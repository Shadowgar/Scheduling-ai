// frontend/src/components/EmployeeManager.js
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import './EmployeeManager.css';

const EmployeeManager = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for Add/Edit Form
    const [showForm, setShowForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '', // Add email
        phone: '', // Add phone
        role: 'employee',
        hire_date: '', // Add hire_date
        show_on_schedule: true, // Add show_on_schedule
        // Add other fields as needed (status, end_date, etc.)
    });
    const [isSubmitting, setIsSubmitting] = useState(false); // For form submission loading state

    // --- Fetch Employees ---
    // Use useCallback to memoize fetchEmployees if it were passed as a prop or used in another effect
    const fetchEmployees = useCallback(async () => {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('accessToken'); // *** GET TOKEN ***

        // *** Basic check if token exists - needed for protected routes ***
        if (!token) {
            setError("Authentication required to manage employees.");
            setLoading(false);
            // Optionally redirect to login here if needed, though App.js routing should handle it
            return;
        }

        try {
            // *** USE RELATIVE URL FOR PROXY ***
            const response = await fetch('/api/employees', {
                headers: {
                    // *** ADD AUTHORIZATION HEADER ***
                    'Authorization': `Bearer ${token}`
                }
            });

            // Check for auth errors specifically
            if (response.status === 401 || response.status === 403) {
                 throw new Error(`Authorization failed (${response.status}). Please log in again.`);
            }
            if (response.status === 422) { // Handle potential JWT processing errors
                 const errData = await response.json();
                 throw new Error(`Error processing request: ${errData.msg || response.statusText}`);
            }
            if (!response.ok) {
                 throw new Error(`Network response was not ok (${response.status})`);
            }

            const data = await response.json();
            setEmployees(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Error fetching employees:", error);
            setError(`Failed to load employees: ${error.message}`);
            // If auth fails, clear potentially bad token? Risky, maybe just show error.
            // if (error.message.includes("Authorization failed")) {
            //     localStorage.removeItem('accessToken');
            // }
        } finally {
            setLoading(false);
        }
    // No dependencies needed if it only runs on mount and doesn't rely on props/state
    // However, if you add filtering based on state later, add those state vars here.
    }, []); // fetchEmployees itself is memoized

    // Fetch employees on component mount
    useEffect(() => {
        console.log("EmployeeManager mounting or fetchEmployees changed, fetching data...");
        fetchEmployees();
    }, [fetchEmployees]); // Depend on the memoized fetchEmployees function


    // --- Form Handling ---
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const getInitialFormData = () => ({
        name: '',
        email: '',
        phone: '',
        role: 'employee',
        hire_date: new Date().toISOString().split('T')[0], // Default to today
        show_on_schedule: true,
        password: '', // Only for adding, clear on edit load
        // Add other defaults
    });


    const handleShowAddForm = () => {
        setEditingEmployee(null);
        setFormData(getInitialFormData());
        setShowForm(true);
        setError(null);
    };

    const handleShowEditForm = (employee) => {
        setEditingEmployee(employee);
        setFormData({
            name: employee.name || '',
            email: employee.email || '',
            phone: employee.phone || '',
            role: employee.role || 'employee',
            hire_date: employee.hire_date || '', // Assumes ISO string format from backend
            show_on_schedule: employee.show_on_schedule !== undefined ? employee.show_on_schedule : true,
            password: '', // Clear password field for edits
            // Map other fields from employee.to_dict()
        });
        setShowForm(true);
        setError(null);
    };

    const handleCancelForm = () => {
        setShowForm(false);
        setEditingEmployee(null);
        setError(null);
    };

    const handleSubmitForm = async (e) => {
        e.preventDefault();
        setError(null);
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
        const dataToSend = { ...formData };
        if (method === 'PUT' && !dataToSend.password) {
            delete dataToSend.password;
        }
        // Ensure boolean is sent correctly
        dataToSend.show_on_schedule = !!dataToSend.show_on_schedule;

        console.log(`Submitting ${method} to ${url} with data:`, dataToSend);

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(dataToSend)
            });

            const result = await response.json(); // Try to parse response

            if (!response.ok) {
                 // Use error message from backend if available
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
        if (window.confirm(`Are you sure you want to delete employee "${employeeName}"? This cannot be undone.`)) {
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

                 // DELETE might return 200 OK with message or 204 No Content
                 if (response.status === 204) { // Handle 204 No Content
                    console.log(`Employee ${employeeId} deleted successfully (204).`);
                 } else {
                    const result = await response.json(); // Assume 200 OK has message
                    if (!response.ok) {
                         throw new Error(result.error || `Failed to delete (${response.status})`);
                    }
                    console.log(`Employee ${employeeId} deleted successfully:`, result.message);
                 }

                 fetchEmployees(); // Refresh list on success

            } catch (err) {
                 console.error("Error deleting employee:", err);
                 setError(err.message || "Failed to delete employee.");
            }
        }
    };


    // --- Render Logic ---
    if (loading && employees.length === 0) return <div>Loading Employees...</div>;
    // Display error prominently if it occurs outside the form context and prevents loading
    if (error && employees.length === 0 && !showForm) return <div className="error">{error} <button onClick={fetchEmployees}>Retry</button></div>;


    return (
        <div className="employee-manager">
            <h2>Manage Employees</h2>

             {/* Show general errors that don't block the whole view */}
             {error && employees.length > 0 && !showForm && (
                <div className="error-inline">{error}</div>
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
                            </select>
                        </div>
                         {/* Hire Date */}
                         <div className="form-group">
                            <label htmlFor="hire_date">Hire Date:</label>
                            <input type="date" id="hire_date" name="hire_date" value={formData.hire_date} onChange={handleInputChange} required disabled={isSubmitting}/>
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
                        </div>

                        {/* Add other fields here */}

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
                            <th>Shows on Schedule?</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map(emp => (
                            <tr key={emp.id}>
                                <td>{emp.name}</td>
                                <td>{emp.email}</td>
                                <td>{emp.role || 'N/A'}</td>
                                <td>{emp.show_on_schedule ? 'Yes' : 'No'}</td>
                                <td>
                                    <button onClick={() => handleShowEditForm(emp)} className="edit-button">Edit</button>
                                    <button onClick={() => handleDeleteEmployee(emp.id, emp.name)} className="delete-button">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {employees.length === 0 && !loading && (
                            <tr>
                                <td colSpan="5">No employees found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default EmployeeManager;