import pytest
import pytest
from ..models import Employee, AccessRole, EmployeeStatus
from datetime import date

def test_new_employee():
    """
    GIVEN a Employee model
    WHEN a new Employee object is created
    THEN check if the fields are defined correctly
    """
    employee = Employee(
        name='Test Employee',
        email='test@example.com',
        phone='123-456-7890',
        job_title='Engineer',
        access_role=AccessRole.MEMBER,
        hire_date=date(2024, 1, 1),
        status=EmployeeStatus.ACTIVE,
        seniority_level=5,
        max_hours_per_week=40,
        min_hours_per_week=20,
        show_on_schedule=True,
        preferred_shifts=['morning', 'afternoon'],
        preferred_days=['Monday', 'Tuesday'],
        days_off=[date(2024, 12, 25)],
        max_hours=40,
        max_shifts_in_a_row=5
    )
    assert employee.name == 'Test Employee'
    assert employee.email == 'test@example.com'
    assert employee.phone == '123-456-7890'
    assert employee.job_title == 'Engineer'
    assert employee.access_role == AccessRole.MEMBER
    assert employee.hire_date == date(2024, 1, 1)
    assert employee.status == EmployeeStatus.ACTIVE
    assert employee.seniority_level == 5
    assert employee.max_hours_per_week == 40
    assert employee.min_hours_per_week == 20
    assert employee.show_on_schedule == True
    assert employee.preferred_shifts == ['morning', 'afternoon']
    assert employee.preferred_days == ['Monday', 'Tuesday']
    assert employee.days_off == [date(2024, 12, 25)]
    assert employee.max_hours == 40
    assert employee.max_shifts_in_a_row == 5