import React from 'react'; // Removed useState import
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';

// Setup the localizer (remains the same)
const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// Accept events and onSelectSlot props from App component
function CalendarComponent({ events, onSelectSlot }) { // Removed local event state

  // Removed the console.log for setEvents as it's no longer here

  return (
    <div style={{ height: '70vh' }}>
      <Calendar
        localizer={localizer}
        events={events} // Use the events prop passed from App
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        selectable={true}
        onSelectSlot={onSelectSlot}
        // Add unique key prop for better rendering performance (optional but recommended)
        eventPropGetter={(event) => ({ key: event.id })}
      />
    </div>
  );
}

export default CalendarComponent;