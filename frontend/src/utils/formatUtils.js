// frontend/src/utils/formatUtils.js

export const roleOrder = ['supervisor', 'police', 'security']; // Adjust as needed

export const formatShiftDisplay = (shift) => {
    if (!shift || !shift.start_time || !shift.end_time) return ''; // No shift or missing times

    try {
        const start = new Date(shift.start_time);
        const end = new Date(shift.end_time);
        const startH = start.getHours();
        const endH = end.getHours();
        const durationMs = end.getTime() - start.getTime(); // Duration in milliseconds

        // Check for standard shifts (adjust hours precisely)
        // Shift 1: 7 AM - 3 PM (07:00 - 15:00)
        if (startH === 7 && endH === 15) return '1';
        // Shift 2: 3 PM - 11 PM (15:00 - 23:00)
        if (startH === 15 && endH === 23) return '2';
        // Shift 3: 11 PM - 7 AM (23:00 - 07:00 next day) - Check start hour and duration (~8 hours)
        if (startH === 23 && endH === 7 && durationMs > 6 * 3600 * 1000 && durationMs < 10 * 3600 * 1000) return '3';

        // Fallback: Format as ha-ha (e.g., 8a-4p)
        const formatTime = (d) => {
            return d.toLocaleTimeString('en-US', {
                hour: 'numeric',
                // minute: '2-digit', // Omit minutes if they are :00
                hour12: true
            }).toLowerCase().replace(':00', '').replace(' am', 'a').replace(' pm', 'p'); // Remove :00
        };
        return `${formatTime(start)}-${formatTime(end)}`;

    } catch (e) {
        console.error("Error formatting shift time:", e);
        return 'Err'; // Indicate error
    }
};
