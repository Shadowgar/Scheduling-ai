import re
from datetime import datetime, timezone, timedelta
from flask import current_app
from models import Shift, Employee, db
from sqlalchemy.orm import joinedload

def parse_date_from_query(text):
    """
    Very basic date parser. Looks for Month Day (e.g., March 1st, April 15).
    Returns a date object or None. Needs significant improvement for real use.
    """
    # Try formats like "March 1", "March 1st", "Jan 22nd"
    month_day_match = re.search(r"(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\s+(\d{1,2})(?:st|nd|rd|th)?", text, re.IGNORECASE)
    if month_day_match:
        month_str, day_str = month_day_match.groups()
        try:
            # Assume current year - this is a major simplification!
            current_year = datetime.now(timezone.utc).year
            # Try parsing month abbreviation/name
            month_num = datetime.strptime(month_str, "%b").month if len(month_str) == 3 else datetime.strptime(month_str, "%B").month
            parsed_dt = datetime(current_year, month_num, int(day_str))
            return parsed_dt.date() # Return only the date part
        except ValueError as e:
            current_app.logger.warning(f"Date parsing failed for '{month_str} {day_str}': {e}")
            return None

    # Add more parsing logic here (e.g., for "today", "tomorrow")
    if "today" in text.lower():
        return datetime.now(timezone.utc).date()
    if "tomorrow" in text.lower():
        return (datetime.now(timezone.utc) + timedelta(days=1)).date()

    return None

def parse_shift_type_from_query(text):
    """
    Basic shift type parser. Looks for keywords.
    Returns a string like 'Morning', 'Evening', 'Night' or None.
    Needs adjustment based on your actual shift definitions.
    """
    text_lower = text.lower()
    # Define keywords for different shifts
    if "morning" in text_lower or "am shift" in text_lower or "day shift" in text_lower:
        return "Morning"
    elif "evening" in text_lower or "pm shift" in text_lower or "afternoon" in text_lower:
        return "Evening"
    elif "night" in text_lower or "overnight" in text_lower:
        return "Night"
    return None

def get_shifts_for_context(target_date, target_shift_type=None):
    """
    Queries the database for shifts based on extracted date and optional type.
    Returns a formatted string context or an error message.
    """
    if not target_date:
        return "No specific date identified in the query."

    context = f"No shifts found for {target_date.strftime('%B %d, %Y')}{f' matching type {target_shift_type}' if target_shift_type else ''}."

    try:
        # Database Query
        start_of_day = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
        end_of_day = start_of_day + timedelta(days=1)

        query_builder = Shift.query.filter(
            Shift.start_time >= start_of_day,
            Shift.start_time < end_of_day
        )

        # Filter by Shift Type (if needed)
        if target_shift_type:
            if target_shift_type == "Morning":
                 morning_start = start_of_day.replace(hour=5)
                 morning_end = start_of_day.replace(hour=12)
                 query_builder = query_builder.filter(Shift.start_time >= morning_start, Shift.start_time < morning_end)
            elif target_shift_type == "Evening":
                 evening_start = start_of_day.replace(hour=16)
                 evening_end = start_of_day.replace(hour=21)
                 query_builder = query_builder.filter(Shift.start_time >= evening_start, Shift.start_time < evening_end)
            elif target_shift_type == "Night":
                 night_start = start_of_day.replace(hour=21)
                 query_builder = query_builder.filter(Shift.start_time >= night_start)

        relevant_shifts = query_builder.join(Employee, isouter=True).options(joinedload(Shift.employee)).order_by(Shift.start_time).all()
        
        if relevant_shifts:
            context_lines = [f"Context: Schedule Information for {target_date.strftime('%B %d, %Y')}{f' ({target_shift_type} shifts)' if target_shift_type else ''}:"]
            for shift in relevant_shifts:
                emp_name = shift.employee.name if shift.employee else "Unassigned"
                start_str = shift.start_time.strftime('%I:%M %p %Z')
                end_str = shift.end_time.strftime('%I:%M %p %Z')
                context_lines.append(f"- {emp_name} scheduled from {start_str} to {end_str}.")
            
            # Incorporate employee preferences into the context
            for shift in relevant_shifts:
                emp = shift.employee
                if emp:
                    pref_shifts = emp.preferred_shifts
                    pref_days = emp.preferred_days
                    days_off = emp.days_off
                    max_hours = emp.max_hours
                    max_shifts_in_a_row = emp.max_shifts_in_a_row

                    if pref_shifts:
                        context_lines.append(f"- {emp.name}'s preferred shifts: {', '.join(pref_shifts)}")
                    if pref_days:
                        context_lines.append(f"- {emp.name}'s preferred days: {', '.join(pref_days)}")
                    if days_off:
                        context_lines.append(f"- {emp.name}'s days off: {', '.join([d.strftime('%Y-%m-%d') for d in days_off])}")
                    if max_hours:
                        context_lines.append(f"- {emp.name}'s maximum hours per week: {max_hours}")
                    if max_shifts_in_a_row:
                        context_lines.append(f"- {emp.name}'s maximum shifts in a row: {max_shifts_in_a_row}")

            context = "\n".join(context_lines)

    except Exception as db_err:
        current_app.logger.error(f"Database query error for context: {db_err}", exc_info=True)
        context = "Error retrieving schedule data from the database."

    return context