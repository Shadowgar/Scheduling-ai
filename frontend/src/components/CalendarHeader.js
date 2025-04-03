import React from 'react';

const CalendarHeader = ({ monthName, year, goToPreviousMonth, goToNextMonth }) => {
  return (
    <div className="calendar-header">
      <button onClick={goToPreviousMonth}>&#60; Prev</button>
      <h2>{monthName} {year}</h2>
      <button onClick={goToNextMonth}>Next &#62;</button>
    </div>
  );
};

export default CalendarHeader;
