// frontend/src/utils/dateUtils.js

export const getDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
};

export const formatDateKey = (date) => {
    if (!(date instanceof Date) || isNaN(date)) { return null; }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const getWeekParity = (date, firstDayOfMonth) => {
    const firstDayOfMonthDayOfWeek = firstDayOfMonth.getDay(); // 0=Sun, 6=Sat
    const msPerDay = 1000 * 60 * 60 * 24;
    const startOfWeekMonthStarts = new Date(firstDayOfMonth.getTime() - firstDayOfMonthDayOfWeek * msPerDay);
    const diffInTime = date.getTime() - startOfWeekMonthStarts.getTime();
    const diffInDays = Math.floor(diffInTime / msPerDay);
    const weekNumber = Math.floor(diffInDays / 7);
    return weekNumber % 2 === 0 ? 'even' : 'odd';
};
