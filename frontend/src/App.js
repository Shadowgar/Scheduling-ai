// frontend/src/App.js
import React from 'react'; // Removed useState, useEffect if only using calendar
import './App.css';
import ScheduleCalendar from './components/ScheduleCalendar'; // Import the new component

function App() {

  // Removed previous state and useEffect hooks for employees/shifts
  // as ScheduleCalendar now handles its own data fetching.

  return (
    <div className="App">
      <header className="App-header">
        {/* You can customize this header */}
        <h1>Scheduling Application</h1>
      </header>
      <main>
        {/* Render the ScheduleCalendar component */}
        {/* All the logic for displaying the schedule is now inside ScheduleCalendar */}
        <ScheduleCalendar />
      </main>
      <footer>
         {/* Optional footer */}
         <p><i>(Calendar View)</i></p>
      </footer>
    </div>
  );
}

export default App;