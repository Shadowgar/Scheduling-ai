# backend/app.py
import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime # Import datetime for timestamp columns

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# --- Database Configuration ---
db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise ValueError("DATABASE_URL environment variable not set.")

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False # Disable modification tracking

db = SQLAlchemy(app) # Initialize SQLAlchemy extension
migrate = Migrate(app, db) # Initialize Flask-Migrate extension

# --- Database Models ---

# Using an Enum for status for better validation (optional but good practice)
import enum
class EmployeeStatus(enum.Enum):
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    ON_LEAVE = 'on_leave'
    TERMINATED = 'terminated'

class Employee(db.Model):
    __tablename__ = 'employees' # Explicitly name the table

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True) # Optional email
    phone = db.Column(db.String(20), nullable=True) # Optional phone
    role = db.Column(db.String(50), nullable=False) # e.g., 'Police', 'Security'
    # We used 'type' before, let's stick to 'role' as in the schema
    hire_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=True) # Nullable for active employees
    status = db.Column(db.Enum(EmployeeStatus), nullable=False, default=EmployeeStatus.ACTIVE)
    seniority_level = db.Column(db.Integer, nullable=True) # Optional
    max_hours_per_week = db.Column(db.Integer, nullable=True) # Optional
    min_hours_per_week = db.Column(db.Integer, nullable=True) # Optional

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # --- Relationships (will be added later) ---
    # preferences = db.relationship('EmployeePreference', backref='employee', lazy=True)
    # skills = db.relationship('EmployeeSkill', backref='employee', lazy=True)
    # shifts = db.relationship('Shift', backref='employee', lazy=True)

    # --- Method to represent the object (optional but helpful) ---
    def __repr__(self):
        return f'<Employee {self.id}: {self.name} ({self.status.value})>'

    # --- Method to convert object to dictionary (for JSON responses) ---
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
            'hire_date': self.hire_date.isoformat() if self.hire_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'status': self.status.value, # Return the string value of the enum
            'seniority_level': self.seniority_level,
            'max_hours_per_week': self.max_hours_per_week,
            'min_hours_per_week': self.min_hours_per_week,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
# --- Shift Model ---
class Shift(db.Model):
    __tablename__ = 'shifts'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True) # Can be initially unassigned
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    role_required = db.Column(db.String(100), nullable=True) # Role needed for this shift (could differ from assigned employee's default role)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # --- Relationships ---
    # Define the relationship to Employee (one shift belongs to one employee, potentially)
    # backref='shifts' creates a convenient 'employee.shifts' attribute to get all shifts for an employee
    employee = db.relationship('Employee', backref=db.backref('shifts', lazy=True)) # lazy=True means shifts aren't loaded until accessed

    # Representation for debugging/logging
    def __repr__(self):
        return f'<Shift id={self.id} start={self.start_time} employee_id={self.employee_id}>'

    # Method to convert Shift object to a dictionary (for JSON responses)
    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': self.employee.name if self.employee else None, # Include employee name if assigned
            'start_time': self.start_time.isoformat() if self.start_time else None, # Use ISO format for consistency
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'role_required': self.role_required,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    # Constraint to ensure end_time is after start_time (optional but good practice)
    # Note: Database-level constraints might be more robust depending on the DB engine.
    # This is a simple application-level check example.
    @db.validates('start_time', 'end_time')
    def validate_end_time(self, key, value):
        if key == 'end_time':
            start = self.start_time
            end = value
            # Ensure both are datetime objects before comparing
            if isinstance(start, datetime) and isinstance(end, datetime) and end <= start:
                raise ValueError("End time must be after start time.")
        elif key == 'start_time':
             # If start_time is being set, check against existing end_time (if any)
            start = value
            end = self.end_time
            if isinstance(start, datetime) and isinstance(end, datetime) and end <= start:
                 raise ValueError("Start time must be before end time.")
        return value # Must return the value

# --- Basic Test Route ---
@app.route('/')
def index():
    return jsonify({"message": "Welcome to the Scheduling AI Backend!"})

# --- API Endpoints ---

# Route to get all employees and create a new employee
@app.route('/api/employees', methods=['GET', 'POST'])
def handle_employees():
    if request.method == 'POST':
        # --- Create a new employee ---
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid input"}), 400

        # Basic validation (can be expanded)
        required_fields = ['name', 'role', 'hire_date']
        if not all(field in data for field in required_fields):
            return jsonify({"error": f"Missing required fields: {required_fields}"}), 400

        try:
            # Convert hire_date string to date object
            hire_date_obj = datetime.strptime(data['hire_date'], '%Y-%m-%d').date()
            # Convert end_date if provided
            end_date_obj = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data.get('end_date') else None
            # Convert status string to Enum if provided, else use default
            status_enum = EmployeeStatus(data['status']) if data.get('status') else EmployeeStatus.ACTIVE

            new_employee = Employee(
                name=data['name'],
                email=data.get('email'), # Use .get for optional fields
                phone=data.get('phone'),
                role=data['role'],
                hire_date=hire_date_obj,
                end_date=end_date_obj,
                status=status_enum,
                seniority_level=data.get('seniority_level'),
                max_hours_per_week=data.get('max_hours_per_week'),
                min_hours_per_week=data.get('min_hours_per_week')
            )
            db.session.add(new_employee)
            db.session.commit()
            return jsonify(new_employee.to_dict()), 201 # 201 Created status

        except ValueError as e:
             # Handle potential errors during date conversion or invalid status enum
            db.session.rollback() # Rollback in case of error during processing
            return jsonify({"error": f"Invalid data format: {e}"}), 400
        except Exception as e:
            db.session.rollback() # Rollback on any other database error
            # Log the error in a real application
            print(f"Error creating employee: {e}")
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'GET':
        # --- Get all employees ---
        try:
            all_employees = Employee.query.all()
            return jsonify([employee.to_dict() for employee in all_employees]), 200
        except Exception as e:
            # Log the error in a real application
            print(f"Error fetching employees: {e}")
            return jsonify({"error": "Internal server error"}), 500

# Placeholder for specific employee operations (GET by ID, PUT, DELETE)
# @app.route('/api/employees/<int:employee_id>', methods=['GET', 'PUT', 'DELETE'])
# def handle_employee(employee_id):
#     # Logic for specific employee will go here
#     pass
# Route to get, update, or delete a specific employee by ID
@app.route('/api/employees/<int:employee_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_employee(employee_id):
    # --- Find the employee by ID ---
    # Use get_or_404 to automatically return a 404 response if not found
    employee = Employee.query.get_or_404(employee_id, description=f"Employee with ID {employee_id} not found.")

    if request.method == 'GET':
        # --- Get specific employee ---
        return jsonify(employee.to_dict()), 200

    elif request.method == 'PUT':
        # --- Update specific employee ---
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid input"}), 400

        try:
            # Update fields if they are provided in the request data
            if 'name' in data:
                employee.name = data['name']
            if 'email' in data:
                employee.email = data.get('email') # Allow setting email to null
            if 'phone' in data:
                employee.phone = data.get('phone') # Allow setting phone to null
            if 'role' in data:
                employee.role = data['role']
            if 'hire_date' in data:
                employee.hire_date = datetime.strptime(data['hire_date'], '%Y-%m-%d').date()
            if 'end_date' in data:
                # Handle potential null value for end_date
                employee.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data.get('end_date') else None
            if 'status' in data:
                employee.status = EmployeeStatus(data['status']) # Validate enum value
            if 'seniority_level' in data:
                employee.seniority_level = data.get('seniority_level')
            if 'max_hours_per_week' in data:
                employee.max_hours_per_week = data.get('max_hours_per_week')
            if 'min_hours_per_week' in data:
                employee.min_hours_per_week = data.get('min_hours_per_week')

            # Note: updated_at is handled automatically by onupdate=datetime.utcnow

            db.session.commit() # Save changes to the database
            return jsonify(employee.to_dict()), 200 # Return updated employee

        except ValueError as e:
             # Handle potential errors during date conversion or invalid status enum
            db.session.rollback()
            return jsonify({"error": f"Invalid data format: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            print(f"Error updating employee {employee_id}: {e}") # Log the error
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'DELETE':
        # --- Delete specific employee ---
        try:
            db.session.delete(employee)
            db.session.commit()
            # Option 1: Return No Content (standard for DELETE)
            # return '', 204
            # Option 2: Return a confirmation message
            return jsonify({"message": f"Employee with ID {employee_id} deleted successfully."}), 200

        except Exception as e:
            db.session.rollback()
            print(f"Error deleting employee {employee_id}: {e}") # Log the error
            return jsonify({"error": "Internal server error"}), 500
        
# --- Shift API Routes ---

# Route to get all shifts or create a new shift
@app.route('/api/shifts', methods=['GET', 'POST'])
def handle_shifts():
    if request.method == 'POST':
        # --- Create a new shift ---
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid input"}), 400

        # Basic validation
        required_fields = ['start_time', 'end_time']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields (start_time, end_time)"}), 400

        try:
            # Parse datetime strings (assuming ISO format like YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS)
            # More robust parsing might be needed depending on frontend format
            start_time_dt = datetime.fromisoformat(data['start_time'])
            end_time_dt = datetime.fromisoformat(data['end_time'])

            new_shift = Shift(
                start_time=start_time_dt,
                end_time=end_time_dt,
                # Optional fields:
                employee_id=data.get('employee_id'), # Allow assigning employee on creation
                role_required=data.get('role_required'),
                notes=data.get('notes')
            )

            # Validate end_time > start_time (using the validator we added)
            # The validation happens implicitly when setting attributes if using @db.validates
            # Or we can explicitly check here if not using the validator:
            # if new_shift.end_time <= new_shift.start_time:
            #    return jsonify({"error": "End time must be after start time"}), 400

            # Check if employee_id exists, if provided
            if new_shift.employee_id:
                 employee = Employee.query.get(new_shift.employee_id)
                 if not employee:
                     return jsonify({"error": f"Employee with ID {new_shift.employee_id} not found."}), 404 # Not Found

            db.session.add(new_shift)
            db.session.commit()

            return jsonify(new_shift.to_dict()), 201 # Return created shift with 201 status

        except ValueError as e:
            db.session.rollback()
            # Handle potential errors during date conversion or validation
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            print(f"Error creating shift: {e}") # Log the error
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'GET':
        # --- Get all shifts ---
        try:
            # Add filtering/sorting later if needed
            shifts = Shift.query.order_by(Shift.start_time).all()
            return jsonify([shift.to_dict() for shift in shifts]), 200
        except Exception as e:
            print(f"Error getting shifts: {e}") # Log the error
            return jsonify({"error": "Internal server error"}), 500

# Route to get, update, or delete a specific shift by ID
@app.route('/api/shifts/<int:shift_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_shift(shift_id):
    # --- Find the shift by ID ---
    # Use get_or_404 to automatically return a 404 response if not found
    shift = Shift.query.get_or_404(shift_id, description=f"Shift with ID {shift_id} not found.")

    if request.method == 'GET':
        # --- Get specific shift ---
        return jsonify(shift.to_dict()), 200

    elif request.method == 'PUT':
        # --- Update specific shift ---
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid input"}), 400

        try:
            # Update fields if they are provided in the request data
            if 'start_time' in data:
                shift.start_time = datetime.fromisoformat(data['start_time'])
            if 'end_time' in data:
                shift.end_time = datetime.fromisoformat(data['end_time'])

            # Handle potential null value or change for employee_id
            if 'employee_id' in data:
                new_employee_id = data.get('employee_id') # Can be None or an ID
                if new_employee_id:
                    # Check if the new employee ID exists
                    employee = Employee.query.get(new_employee_id)
                    if not employee:
                        return jsonify({"error": f"Employee with ID {new_employee_id} not found."}), 404
                    shift.employee_id = new_employee_id
                else:
                    # Allow unassigning the shift
                    shift.employee_id = None

            if 'role_required' in data:
                shift.role_required = data.get('role_required') # Allow setting to null
            if 'notes' in data:
                shift.notes = data.get('notes') # Allow setting to null

            # Re-validate time constraint after potential updates
            # The @db.validates decorator should handle this automatically on commit,
            # but explicit check can be added here if needed before commit.
            if shift.end_time <= shift.start_time:
                 raise ValueError("End time must be after start time.")

            # Note: updated_at is handled automatically by onupdate=datetime.utcnow

            db.session.commit() # Save changes to the database
            return jsonify(shift.to_dict()), 200 # Return updated shift

        except ValueError as e:
             # Handle potential errors during date conversion or validation
            db.session.rollback()
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            print(f"Error updating shift {shift_id}: {e}") # Log the error
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'DELETE':
        # --- Delete specific shift ---
        try:
            db.session.delete(shift)
            db.session.commit()
            # Option 1: Return No Content
            # return '', 204
            # Option 2: Return a confirmation message
            return jsonify({"message": f"Shift with ID {shift_id} deleted successfully."}), 200

        except Exception as e:
            db.session.rollback()
            print(f"Error deleting shift {shift_id}: {e}") # Log the error
            return jsonify({"error": "Internal server error"}), 500

# --- Main Execution ---
if __name__ == '__main__':
    # Ensure database tables are created (using Flask-Migrate is better)
    # with app.app_context():
    #     db.create_all() # We will replace this with migrations
    app.run(debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true')