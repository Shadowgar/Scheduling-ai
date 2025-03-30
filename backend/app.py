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

# --- Main Execution ---
if __name__ == '__main__':
    # Ensure database tables are created (using Flask-Migrate is better)
    # with app.app_context():
    #     db.create_all() # We will replace this with migrations
    app.run(debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true')