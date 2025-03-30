import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  // State to store the list of employees
  const [employees, setEmployees] = useState([]);
  // State to track loading status
  const [loading, setLoading] = useState(true);
  // State to store any error messages
  const [error, setError] = useState(null);

  // useEffect hook to fetch data when the component mounts
  useEffect(() => {
    // Define the function to fetch employees
    const fetchEmployees = async () => {
      try {
        // Make the API call to the backend
        // Ensure your Flask backend is running at http://127.0.0.1:5000
        const response = await fetch('http://127.0.0.1:5000/api/employees');

        // Check if the response was successful
        if (!response.ok) {
          // If not okay, throw an error with the status text
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Parse the JSON response
        const data = await response.json();
        // Update the employees state with the fetched data
        setEmployees(data);
        // Clear any previous errors
        setError(null);
      } catch (err) {
        // If an error occurs, update the error state
        console.error("Fetch error:", err);
        setError(`Failed to fetch employees: ${err.message}. Is the backend server running?`);
        // Set employees to empty array in case of error
        setEmployees([]);
      } finally {
        // Set loading to false regardless of success or failure
        setLoading(false);
      }
    };

    // Call the fetch function
    fetchEmployees();

    // The empty dependency array [] means this effect runs only once when the component mounts
  }, []);

  // --- Render Logic ---

  // Display a loading message while data is being fetched
  if (loading) {
    return <div className="App">Loading employees...</div>;
  }

  // Display an error message if fetching failed
  if (error) {
    return <div className="App">Error: {error}</div>;
  }

  // Display the list of employees if data was fetched successfully
  return (
    <div className="App">
      <header className="App-header">
        <h1>Employee List</h1>
      </header>
      <main>
        {employees.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Hire Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.id}</td>
                  <td>{employee.name}</td>
                  <td>{employee.email || 'N/A'}</td> {/* Handle potentially null email */}
                  <td>{employee.role}</td>
                  <td>{employee.hire_date}</td>
                  <td>{employee.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No employees found. Add some via the API!</p>
        )}

        {/* We can add buttons/forms here later to add/edit employees */}
        <hr />
        <p><i>(Data fetched from Flask backend)</i></p>

      </main>
    </div>
  );
}

export default App;