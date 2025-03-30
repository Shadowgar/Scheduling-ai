import React, { useState, useEffect } from 'react';

// Accept modalStyle and backdropStyle as props here
function EventModal({ isOpen, onClose, onSave, slotInfo, modalStyle, backdropStyle }) {
  const [title, setTitle] = useState(''); // State for the event title input

  // Reset title when modal opens with new slotInfo
  useEffect(() => {
    if (isOpen) {
      setTitle(''); // Clear title on open
    }
  }, [isOpen]); // Dependency array ensures this runs when isOpen changes

  // Don't render anything if not open or no slot selected
  if (!isOpen || !slotInfo) {
    return null;
  }

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

  // The JSX uses the modalStyle and backdropStyle props passed in
  return (
    <>
      <div style={backdropStyle} onClick={onClose}></div> {/* Use backdropStyle prop */}
      <div style={modalStyle}> {/* Use modalStyle prop */}
        <h2>Add New Event</h2>
        <p>
          Time: {slotInfo.start.toLocaleString()} - {slotInfo.end.toLocaleString()}
        </p>
        <div>
          <label htmlFor="eventTitle" style={{ marginRight: '5px' }}>Title:</label>
          <input
            id="eventTitle"
            type="text"
            placeholder="Event Title"
            value={title} // Controlled input
            onChange={(e) => setTitle(e.target.value)} // Update state on change
            style={{ width: '80%', marginBottom: '15px', padding: '5px' }} // Basic styling
            autoFocus // Focus the input when modal opens
          />
        </div>
        <hr style={{ margin: '15px 0' }}/>
        <button onClick={handleInternalSave}>Save Event</button>
        <button onClick={onClose} style={{ marginLeft: '10px' }}>Cancel</button>
      </div>
    </>
  );
}

// Default props define the styles if they aren't overridden by the parent
// These styles are crucial for the modal overlay behavior
EventModal.defaultProps = {
    modalStyle: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: '20px 40px',
        border: '1px solid #ccc',
        borderRadius: '8px',
        zIndex: 1000, // Ensure it's above other content
        boxShadow: '0 5px 15px rgba(0, 0, 0, 0.2)',
        minWidth: '300px', // Minimum width
    },
    backdropStyle: {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.6)', // Semi-transparent backdrop
        zIndex: 999, // Below modal, above everything else
    }
};


export default EventModal;