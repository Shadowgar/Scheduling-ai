import React, { useState, useEffect } from 'react'; // Added useState, useEffect

function EventModal({ isOpen, onClose, onSave, slotInfo }) {
  const [title, setTitle] = useState(''); // State for the event title input

  // Reset title when modal opens with new slotInfo
  useEffect(() => {
    if (isOpen) {
      setTitle(''); // Clear title on open
    }
  }, [isOpen]); // Dependency array ensures this runs when isOpen changes

  if (!isOpen || !slotInfo) {
    return null;
  }

  // Styles remain the same
  const modalStyle = { /* ... (keep existing style object) ... */ };
  const backdropStyle = { /* ... (keep existing style object) ... */ };

   // Function to handle the save action
  const handleInternalSave = () => {
    if (!title.trim()) { // Basic validation: don't save if title is empty
        alert("Please enter an event title.");
        return;
    }
    const eventData = {
      title: title, // Use title from state
      start: slotInfo.start,
      end: slotInfo.end,
      // Basic guess for allDay based on selection type
      // You might want more robust logic here
      allDay: slotInfo.action === 'click' && slotInfo.slots.length === 1
    };
    onSave(eventData); // Pass data up to App component
  };

  return (
    <>
      <div style={backdropStyle} onClick={onClose}></div>
      <div style={modalStyle}>
        <h2>Add New Event</h2>
        <p>
          Time: {slotInfo.start.toLocaleString()} - {slotInfo.end.toLocaleString()}
        </p>
        <div>
          <label htmlFor="eventTitle">Title: </label>
          <input
            id="eventTitle"
            type="text"
            placeholder="Event Title"
            value={title} // Controlled input
            onChange={(e) => setTitle(e.target.value)} // Update state on change
            style={{ width: '80%', marginBottom: '15px' }} // Basic styling
            autoFocus // Focus the input when modal opens
          />
        </div>
        <hr />
        <button onClick={handleInternalSave}>Save Event</button>
        <button onClick={onClose} style={{ marginLeft: '10px' }}>Cancel</button>
      </div>
    </>
  );
}
// Need to copy the actual style objects back in
EventModal.defaultProps = {
    modalStyle: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: '20px 40px', // More padding
        border: '1px solid #ccc',
        borderRadius: '8px', // Slightly more rounded
        zIndex: 1000,
        boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)', // Softer shadow
        minWidth: '300px', // Minimum width
    },
    backdropStyle: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.6)', // Darker backdrop
        zIndex: 999,
    }
};


export default EventModal;