import React, { useState } from 'react';
import './App.css';
import Header from './Header';
import CalendarComponent from './CalendarComponent';
import EventModal from './EventModal';

// Define initial events here (moved from CalendarComponent)
const initialEvents = [
  { title: 'Meeting with Team', start: new Date(2025, 2, 28, 10, 0, 0), end: new Date(2025, 2, 28, 11, 0, 0), allDay: false, id: 1 }, // Add unique IDs
  { title: 'Project Deadline', start: new Date(2025, 2, 29), end: new Date(2025, 2, 29), allDay: true, id: 2 },
  { title: 'Lunch Break', start: new Date(2025, 2, 31, 12, 0, 0), end: new Date(2025, 2, 31, 13, 0, 0), id: 3 }
];
// Simple counter for unique IDs (replace with better method later if needed)
let eventIdCounter = initialEvents.length + 1;

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [events, setEvents] = useState(initialEvents); // Manage events state here

  const handleSelectSlot = (slotInfo) => {
    setSelectedSlot(slotInfo);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSlot(null);
  };

  // Update handleSaveEvent to add the event to the state
  const handleSaveEvent = (eventData) => {
    const newEvent = {
      ...eventData,
      id: eventIdCounter++, // Assign a simple unique ID
    };
    setEvents(prevEvents => [...prevEvents, newEvent]); // Add new event to the array
    console.log("Saving event:", newEvent);
    closeModal();
  };

  return (
    <div className="App">
      <Header />
      <main>
        {/* Pass events state and the handler down */}
        <CalendarComponent
          events={events} // Pass current events
          onSelectSlot={handleSelectSlot}
        />
      </main>
      <EventModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSaveEvent} // Pass the updated save handler
        slotInfo={selectedSlot}
      />
    </div>
  );
}

export default App;