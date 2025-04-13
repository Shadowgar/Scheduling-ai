import React from 'react';
import { getDayName, formatDateKey, getWeekParity } from '../utils/dateUtils';
import { roleOrder, formatShiftDisplay } from '../utils/formatUtils';

const CalendarGrid = ({
  employees,
  datesInMonth,
  shiftLookup,
  userAccessRole,
  handleCellClick,
  firstDayOfMonth,
  todayDateStr,
  conflictMap = {},
}) => {
  // Grid layout constants
  const HEADER_ROW_COUNT = 2; // Rows for Day Name and Date Number
  const ROWS_PER_EMPLOYEE = 2; // Rows for Name/Title + Shift/CellText
  const EMPLOYEE_NAME_COL = 1; // First column for employee info
  const DATE_START_COL = 2; // Column where dates begin
  const totalDataColumns = datesInMonth.length;
  const gridTemplateColumns = `minmax(150px, 15%) repeat(${totalDataColumns}, minmax(35px, 1fr))`;

  let currentGridRow = HEADER_ROW_COUNT + 1;
  let previousRoleGroup = null;

  return (
    <div className="calendar-grid" style={{ gridTemplateColumns: gridTemplateColumns }}>
      {/* --- Header Rows (Day Names, Date Numbers) --- */}
      {/* Top-left empty corner */}
      <div className="grid-cell grid-header top-left-corner" style={{ gridRow: 1, gridColumn: EMPLOYEE_NAME_COL }}></div>
      {/* Day Names */}
      {datesInMonth.map((date, index) => {
        const isToday = formatDateKey(date) === todayDateStr;
        const todayClass = isToday ? 'today-highlight' : '';
        return (
          <div key={`day-name-${index}`} className={`grid-cell grid-header week-day ${todayClass}`} style={{ gridRow: 1, gridColumn: DATE_START_COL + index }}>
            {getDayName(date)}
          </div>
        );
      })}
      {/* Second row, first column empty */}
      <div className="grid-cell grid-header" style={{ gridRow: 2, gridColumn: EMPLOYEE_NAME_COL }}></div>
      {/* Date Numbers */}
      {datesInMonth.map((date, index) => {
        const dayNumber = date.getDate();
        const isToday = formatDateKey(date) === todayDateStr;
        const todayClass = isToday ? 'today-highlight' : '';
        return (
          <div key={`date-num-${index}`} className={`grid-cell grid-header date-number ${todayClass}`} style={{ gridRow: 2, gridColumn: DATE_START_COL + index }}>
            {dayNumber}
          </div>
        );
      })}

      {/* --- Employee Rows & Shift Cells --- */}
      {employees.map((employee) => {
        // Determine current grid row positions for this employee
        let nameRow = currentGridRow;
        let titleRow = currentGridRow + 1;
        let shiftDataRow = currentGridRow; // Data cells span both rows

        // Check if a role group separator is needed
        const currentRoleGroup = roleOrder.find(role => employee.job_title?.toLowerCase().includes(role)) || 'other';
        let separatorRow = null;
        if (previousRoleGroup !== null && currentRoleGroup !== previousRoleGroup) {
          // Insert separator row
          separatorRow = (
            <div key={`sep-${currentGridRow}`} className="grid-cell separator-row" style={{ gridRow: currentGridRow, gridColumn: `1 / ${totalDataColumns + 2}` }} ></div>
          );
          currentGridRow++; // Increment row index for the separator
          // Update row indices for the actual employee data
          nameRow = currentGridRow;
          titleRow = currentGridRow + 1;
          shiftDataRow = currentGridRow;
        }
        previousRoleGroup = currentRoleGroup; // Update for next iteration

        // --- Render Employee Info and Cells for the row ---
        const employeeElements = (
          <React.Fragment key={employee.id}>
            {/* Column 1: Employee Name & Title */}
            <div className="grid-cell employee-name-cell" style={{ gridRow: nameRow, gridColumn: EMPLOYEE_NAME_COL }} >
              {employee.name}
            </div>
            <div className="grid-cell employee-title-cell" style={{ gridRow: titleRow, gridColumn: EMPLOYEE_NAME_COL }} >
              {employee.job_title || 'N/A'}
            </div>

            {/* Columns 2+: Data Cells for each date */}
            {datesInMonth.map((date, index) => {
              const shift = shiftLookup.get(employee.id)?.get(formatDateKey(date)); // Get shift data
              const currentDataColumn = DATE_START_COL + index; // Calculate current column

              // --- Cell Styling Classes ---
              const weekParity = getWeekParity(date, firstDayOfMonth);
              const weekColorClass = `week-color-${weekParity}`;
              const isToday = formatDateKey(date) === todayDateStr;
              const todayClass = isToday ? 'today-highlight' : '';
              // Make cell clickable only for supervisors
              const clickableClass = userAccessRole === 'supervisor' ? 'clickable-cell' : '';

              // --- Determine shift number for conflict highlighting ---
              let shiftNumber = null;
              if (shift && shift.start_time && shift.end_time) {
                const start = new Date(shift.start_time);
                const end = new Date(shift.end_time);
                const startH = start.getHours();
                const endH = end.getHours();
                const durationMs = end.getTime() - start.getTime();
                if (startH === 7 && endH === 15) shiftNumber = 1;
                else if (startH === 15 && endH === 23) shiftNumber = 2;
                else if (startH === 23 && endH === 7 && durationMs > 6 * 3600 * 1000 && durationMs < 10 * 3600 * 1000) shiftNumber = 3;
              }
              const dateKey = formatDateKey(date);
              const isConflict = shiftNumber && conflictMap[dateKey] && conflictMap[dateKey][shiftNumber];

              // --- Tooltip Text ---
              let titleText = shift?.notes && shift.notes.trim().length > 0
                ? `Notes: ${shift.notes}` + (shift?.cell_text ? `\nCell: ${shift.cell_text}` : '')
                : shift?.cell_text
                  ? `Cell: ${shift.cell_text}`
                  : (userAccessRole === 'supervisor' ? `Assign shift for ${employee.name} on ${formatDateKey(date)}` : `${employee.name} - ${formatDateKey(date)}`);
              if (isConflict) {
                titleText = `CONFLICT: No Police assigned to Shift ${shiftNumber} on ${dateKey}\n` + titleText;
              }

              // --- Check for Notes Indicator ---
              const hasNotes = shift?.notes && shift.notes.trim().length > 0;

              // --- Render the Cell Group ---
              return (
                <div
                  key={`cell-group-${employee.id}-${index}`}
                  className={`grid-cell-group ${weekColorClass} ${todayClass} ${clickableClass} ${isConflict ? 'conflict-cell' : ''}`}
                  style={{
                    gridRow: `${shiftDataRow} / span ${ROWS_PER_EMPLOYEE}`,
                    gridColumn: currentDataColumn,
                    display: 'flex', flexDirection: 'column',
                    justifyContent: 'center', alignItems: 'center',
                    padding: '5px',
                    borderRight: 'none', borderBottom: 'none',
                    boxShadow: isConflict ? '0 0 0 2px #e74c3c' : '0 1px 3px rgba(0, 0, 0, 0.1)',
                    borderRadius: '5px',
                    backgroundColor: isConflict ? '#ffeaea' : '#fff',
                    overflow: 'hidden',
                    lineHeight: '1.1', fontSize: '0.8em',
                    position: 'relative',
                    textAlign: 'center',
                  }}
                  onClick={() => handleCellClick(employee, date, shift)}
                  title={titleText}
                >
                  {/* Top part: Main shift display (code/time) */}
                  <div className={`grid-cell shift-cell`} style={{ border: 'none', flexShrink: 0, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} >
                    {formatShiftDisplay(shift)}
                  </div>
                  {/* Bottom part: Directly display cell_text */}
                  <div className={`grid-cell cell-text-display`} style={{ border: 'none', flexShrink: 0 }} >
                    {shift?.cell_text || ''}
                  </div>
                  {/* *** ADD NOTE INDICATOR conditionally *** */}
                  {hasNotes && <div className="note-indicator"></div>}
                  {isConflict && (
                    <div style={{
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      color: '#e74c3c',
                      fontWeight: 'bold',
                      fontSize: '1.1em',
                      pointerEvents: 'none',
                      zIndex: 2,
                    }} title="Shift conflict: No Police assigned">&#9888;</div>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        );

        // Increment grid row index for the next employee (accounts for 2 rows per employee)
        currentGridRow += ROWS_PER_EMPLOYEE;

        // Return the separator (if any) and the employee elements
        return (
          <React.Fragment key={`emp-group-${employee.id}`}>
            {separatorRow}
            {employeeElements}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default CalendarGrid;
