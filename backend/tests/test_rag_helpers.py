import pytest
from datetime import date, datetime, timezone, timedelta
from backend.utils.rag_helpers import parse_date_from_query, parse_shift_type_from_query, get_shifts_for_context
from backend.models import Shift, Employee, AccessRole, EmployeeStatus

def test_parse_date_from_query():
    # Test various date formats
    assert parse_date_from_query("March 1st") == date(datetime.now(timezone.utc).year, 3, 1)
    assert parse_date_from_query("April 15") == date(datetime.now(timezone.utc).year, 4, 15)
    assert parse_date_from_query("today") == datetime.now(timezone.utc).date()
    assert parse_date_from_query("tomorrow") == (datetime.now(timezone.utc) + timedelta(days=1)).date()

    # Test case-insensitivity and invalid dates
    assert parse_date_from_query("jAnUaRy 20") == date(datetime.now(timezone.utc).year, 1, 20)
    assert parse_date_from_query("Invalid Date") is None

def test_parse_shift_type_from_query():
    # Test various shift type keywords
    assert parse_shift_type_from_query("morning") == "Morning"
    assert parse_shift_type_from_query("AM shift") == "Morning"
    assert parse_shift_type_from_query("evening") == "Evening"
    assert parse_shift_type_from_query("PM shift") == "Evening"
    assert parse_shift_type_from_query("night") == "Night"
    assert parse_shift_type_from_query("overnight") == "Night"

    # Test case-insensitivity and no match
    assert parse_shift_type_from_query("MoRnInG") == "Morning"
    assert parse_shift_type_from_query("Invalid Shift") is None

@pytest.mark.parametrize("query,expected", [
    ("March 1st", date(datetime.now(timezone.utc).year, 3, 1)),
    ("today", datetime.now(timezone.utc).date()),
    ("nonsense", None),
])
def test_date_parsing(query, expected):
    assert parse_date_from_query(query) == expected

@pytest.mark.parametrize("query,expected", [
    ("morning", "Morning"),
    ("evening", "Evening"),
    ("nonsense", None),
])
def test_shift_parsing(query, expected):
    assert parse_shift_type_from_query(query) == expected

# Need to mock the database and Shift/Employee models for a proper unit test
# This is just a placeholder
def test_get_shifts_for_context():
    assert get_shifts_for_context(date.today()) == "No specific date identified in the query."