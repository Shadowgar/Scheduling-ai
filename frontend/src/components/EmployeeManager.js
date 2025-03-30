// frontend/src/components/EmployeeManager.js
import React, { useState, useEffect } from 'react';
import './EmployeeManager.css'; // We'll create this CSS file next

const EmployeeManager = () => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // State for Add/Edit Form (initially hidden)
    const [showForm, setShowForm] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null); // null for Add, employee object for Edit
    const [formData, setFormData] = useState({ name: '', role: '' }); // Add other fields later

    // --- Fetch Employees ---
    const fetchEmployees = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('http://127.0.0.1:5000/api/employees');
            if (!response.ok) {
                throw new Error(`Network response was not ok (${response.status})`);
            }
            const data = await response.json();
            // Sort alphabetically for consistent display
            setEmployees(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Error fetching employees:", error);
            setError(`Failed to load employees: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Fetch employees on component mount
    useEffect(() => {
        fetchEmployees();
    }, []); // Empty dependency array means run once on mount

    // --- Form Handling ---
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleShowAddForm = () => {
        setEditingEmployee(null); // Ensure it's an add operation
        setFormData({ name: '', role: 'employee' }); // Reset form with defaults
        setShowForm(true);
        setError(null); // Clear previous form errors
    };

    const handleShowEditForm = (employee) => {
        setEditingEmployee(employee);
        setFormData({ name: employee.name, role: employee.role || 'employee' }); // Pre-fill form
        setShowForm(true);
        setError(null); // Clear previous form errors
    };

    const handleCancelForm = () => {
        setShowForm(false);
        setEditingEmployee(null);
        setError(null);
    };

    const handleSubmitForm = async (e) => {
        e.preventDefault();
        setError(null);
        const { name, role } = formData;

        if (!name || !role) {
            setError("Name and Role are required.");
            return;
        }

        // *** Placeholder for API Call ***
        console.log("Submitting form data:", { id: editingEmployee?.id, ...formData });
        alert(`Placeholder: ${editingEmployee ? 'Updating' : 'Adding'} employee...\nImplement API call here.`);
        // TODO: Implement POST/PUT API call in the next step
        // If successful:
        // fetchEmployees(); // Refresh the list
        // handleCancelForm(); // Close the form
        // Else:
        // setError("API Error Message");
    };

    // --- Delete Handling ---
    const handleDeleteEmployee = async (employeeId, employeeName) => {
        if (window.confirm(`Are you sure you want to delete employee "${employeeName}"? This cannot be undone.`)) {
            // *** Placeholder for API Call ***
            console.log("Deleting employee:", employeeId);
            alert(`Placeholder: Deleting employee ${employeeName}...\nImplement API call here.`);
            // TODO: Implement DELETE API call in the next step
            // If successful:
            // fetchEmployees(); // Refresh the list
            // Else:
            // setError("API Error deleting");
        }
    };


    // --- Render Logic ---
    if (loading && employees.length === 0) return <div>Loading Employees...</div>;
    // Display error prominently if it occurs outside the form context
    if (error && !showForm) return <div className="error">{error}</div>;

    return (
        <div className="employee-manager">
            <h2>Manage Employees</h2>

            {!showForm && (
                <button onClick={handleShowAddForm} className="add-button">
                    + Add New Employee
                </button>
            )}

            {/* --- Add/Edit Form (Conditional) --- */}
            {showForm && (
                <div className="employee-form-container">
                    <h3>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h3>
                    {error && <div className="form-error">{error}</div>} {/* Display form-specific errors */}
                    <form onSubmit={handleSubmitForm}>
                        <div className="form-group">
                            <label htmlFor="name">Name:</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="role">Role:</label>
                            <select
                                id="role"
                                name="role"
                                value={formData.role}
                                onChange={handleInputChange}
                                required
                            >
                                <option value="employee">Employee</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="police">Police</option> {/* Add other roles as needed */}
                                <option value="security">Security</option>
                                {/* Add more roles if necessary */}
                            </select>
                        </div>
                        {/* Add fields for preferences, qualifications etc. later */}
                        <div className="form-actions">
                            <button type="submit" className="save-button">
                                {editingEmployee ? 'Update Employee' : 'Save Employee'}
                            </button>
                            <button type="button" onClick={handleCancelForm} className="cancel-button">
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
                            <th>Role</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map(emp => (
                            <tr key={emp.id}>
                                <td>{emp.name}</td>
                                <td>{emp.role || 'N/A'}</td>
                                <td>
                                    <button onClick={() => handleShowEditForm(emp)} className="edit-button">Edit</button>
                                    <button onClick={() => handleDeleteEmployee(emp.id, emp.name)} className="delete-button">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {employees.length === 0 && !loading && (
                            <tr>
                                <td colSpan="3">No employees found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default EmployeeManager;