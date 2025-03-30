# backend/app.py
import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime, date # Ensure date is imported
import enum

# --- Add these imports ---
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, current_user, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
# --- End added imports ---

# Load environment variables from .env file
load_dotenv()

# --- Flask App Initialization ---
app = Flask(__name__) # Define app instance EARLY
CORS(app) # Enable CORS for all routes

# --- Database Configuration ---
db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise ValueError("DATABASE_URL environment variable not set.")
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- JWT Configuration ---
jwt_secret = os.getenv('JWT_SECRET_KEY')
if not jwt_secret:
    raise ValueError("No JWT_SECRET_KEY set in environment variables")
app.config['JWT_SECRET_KEY'] = jwt_secret
# --- End JWT Configuration ---

# --- Extensions Initialization ---
db = SQLAlchemy(app) # Initialize SQLAlchemy extension
migrate = Migrate(app, db) # Initialize Flask-Migrate extension
jwt = JWTManager(app) # Initialize JWTManager

# --- Database Models ---

# Using an Enum for status for better validation
class EmployeeStatus(enum.Enum):
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    ON_LEAVE = 'on_leave'
    TERMINATED = 'terminated'

class Employee(db.Model):
    __tablename__ = 'employees'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20), nullable=True)
    role = db.Column(db.String(50), nullable=False) # e.g., 'Police', 'Security', 'supervisor', 'employee'
    hire_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.Enum(EmployeeStatus), nullable=False, default=EmployeeStatus.ACTIVE)
    seniority_level = db.Column(db.Integer, nullable=True)
    max_hours_per_week = db.Column(db.Integer, nullable=True)
    min_hours_per_week = db.Column(db.Integer, nullable=True)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    shifts = db.relationship('Shift', backref='employee', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        if not password:
             raise ValueError("Password cannot be empty")
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<Employee {self.id}: {self.name} ({self.status.value})>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'role': self.role,
            'hire_date': self.hire_date.isoformat() if self.hire_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'status': self.status.value,
            'seniority_level': self.seniority_level,
            'max_hours_per_week': self.max_hours_per_week,
            'min_hours_per_week': self.min_hours_per_week,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            # --- DO NOT INCLUDE password_hash here ---
        }

class Shift(db.Model):
    __tablename__ = 'shifts'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Shift id={self.id} start={self.start_time} employee_id={self.employee_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': self.employee.name if self.employee else None,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    @db.validates('start_time', 'end_time')
    def validate_end_time(self, key, value):
        start = self.start_time
        end = self.end_time
        if key == 'end_time':
            end = value
        elif key == 'start_time':
            start = value

        if isinstance(start, datetime) and isinstance(end, datetime) and end <= start:
            raise ValueError("End time must be after start time.")
        return value

# --- JWT User Loading Callback ---
@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"]
    return Employee.query.get(identity)

# --- Basic Test Route ---
@app.route('/')
def index():
    return jsonify({"message": "Welcome to the Scheduling AI Backend!"})

# --- Authentication API Endpoints ---
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    employee = Employee.query.filter_by(email=email).first()

    if employee and employee.check_password(password):
        access_token = create_access_token(identity=employee.id)
        return jsonify(
            access_token=access_token,
            user=employee.to_dict()
        ), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user_info():
    if not current_user:
         return jsonify({"error": "User not found"}), 404
    return jsonify(user=current_user.to_dict()), 200

# --- Employee API Endpoints (Protected) ---
@app.route('/api/employees', methods=['GET', 'POST'])
@jwt_required()
def handle_employees():
    is_supervisor = current_user.role == 'supervisor'

    if request.method == 'POST':
        if not is_supervisor:
            return jsonify({"error": "Permission denied: Only supervisors can create employees"}), 403

        data = request.get_json()
        password = data.get('password')
        if not password:
            return jsonify({"error": "Password is required for new employees"}), 400
        if 'email' not in data or not data['email']:
             return jsonify({"error": "Email is required"}), 400

        required_fields = ['name', 'role', 'hire_date', 'email', 'password']
        if not all(field in data for field in required_fields):
            return jsonify({"error": f"Missing required fields: {required_fields}"}), 400

        if Employee.query.filter_by(email=data['email']).first():
            return jsonify({"error": "Email address already registered"}), 409

        try:
            hire_date_obj = datetime.strptime(data['hire_date'], '%Y-%m-%d').date()
            end_date_obj = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data.get('end_date') else None
            status_enum = EmployeeStatus(data['status']) if data.get('status') else EmployeeStatus.ACTIVE

            new_employee = Employee(
                name=data['name'],
                email=data['email'],
                phone=data.get('phone'),
                role=data['role'],
                hire_date=hire_date_obj,
                end_date=end_date_obj,
                status=status_enum,
                seniority_level=data.get('seniority_level'),
                max_hours_per_week=data.get('max_hours_per_week'),
                min_hours_per_week=data.get('min_hours_per_week')
            )
            new_employee.set_password(password)
            db.session.add(new_employee)
            db.session.commit()
            return jsonify(new_employee.to_dict()), 201
        except ValueError as e:
            db.session.rollback()
            return jsonify({"error": f"Invalid data format: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            print(f"Error creating employee: {e}")
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'GET':
        # Add filtering/permissions later if needed
        try:
            all_employees = Employee.query.all()
            return jsonify([employee.to_dict() for employee in all_employees]), 200
        except Exception as e:
            print(f"Error fetching employees: {e}")
            return jsonify({"error": "Internal server error"}), 500

@app.route('/api/employees/<int:employee_id>', methods=['GET', 'PUT', 'DELETE'])
@jwt_required()
def handle_employee(employee_id):
    employee = Employee.query.get_or_404(employee_id, description=f"Employee with ID {employee_id} not found.")
    is_supervisor = current_user.role == 'supervisor'
    is_self = current_user.id == employee_id

    if request.method == 'GET' and not (is_supervisor or is_self):
         return jsonify({"error": "Permission denied: Cannot view this employee's details"}), 403
    if request.method == 'PUT' and not (is_supervisor or is_self):
         return jsonify({"error": "Permission denied: Cannot update this employee"}), 403
    if request.method == 'DELETE' and not is_supervisor:
         return jsonify({"error": "Permission denied: Only supervisors can delete employees"}), 403

    if request.method == 'GET':
        return jsonify(employee.to_dict()), 200

    elif request.method == 'PUT':
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid input"}), 400

        try:
            if not is_supervisor:
                restricted_fields = ['role', 'hire_date', 'end_date', 'status', 'seniority_level', 'max_hours_per_week', 'min_hours_per_week']
                for field in restricted_fields:
                    if field in data and str(getattr(employee, field, '')) != str(data[field]):
                        return jsonify({"error": f"Permission denied: Cannot change '{field}'"}), 403

            if 'name' in data: employee.name = data['name']
            if 'email' in data:
                if data['email'] != employee.email and Employee.query.filter(Employee.email == data['email'], Employee.id != employee_id).first():
                     return jsonify({"error": "Email address already registered by another user"}), 409
                employee.email = data.get('email')
            if 'phone' in data: employee.phone = data.get('phone')
            if 'role' in data and is_supervisor: employee.role = data['role']
            if 'hire_date' in data and is_supervisor: employee.hire_date = datetime.strptime(data['hire_date'], '%Y-%m-%d').date()
            if 'end_date' in data and is_supervisor: employee.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data.get('end_date') else None
            if 'status' in data and is_supervisor: employee.status = EmployeeStatus(data['status'])
            if 'seniority_level' in data and is_supervisor: employee.seniority_level = data.get('seniority_level')
            if 'max_hours_per_week' in data and is_supervisor: employee.max_hours_per_week = data.get('max_hours_per_week')
            if 'min_hours_per_week' in data and is_supervisor: employee.min_hours_per_week = data.get('min_hours_per_week')

            if 'password' in data and data['password']:
                 if not is_self and not is_supervisor:
                     return jsonify({"error": "Permission denied: Cannot change password for other users"}), 403
                 employee.set_password(data['password'])

            db.session.commit()
            return jsonify(employee.to_dict()), 200
        except ValueError as e:
            db.session.rollback()
            return jsonify({"error": f"Invalid data format: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            print(f"Error updating employee {employee_id}: {e}")
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'DELETE':
        try:
            db.session.delete(employee)
            db.session.commit()
            return jsonify({"message": f"Employee with ID {employee_id} deleted successfully."}), 200
        except Exception as e:
            db.session.rollback()
            print(f"Error deleting employee {employee_id}: {e}")
            return jsonify({"error": "Internal server error"}), 500

# --- Shift API Routes (Protected) ---
@app.route('/api/shifts', methods=['GET', 'POST'])
@jwt_required()
def handle_shifts():
    is_supervisor = current_user.role == 'supervisor'

    if request.method == 'POST':
        if not is_supervisor:
            return jsonify({"error": "Permission denied: Only supervisors can create shifts"}), 403

        data = request.get_json()
        required_fields = ['start_time', 'end_time']
        if not all(field in data for field in required_fields):
            return jsonify({"error": "Missing required fields (start_time, end_time)"}), 400

        try:
            start_time_dt = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
            end_time_dt = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))

            if end_time_dt <= start_time_dt:
                return jsonify({"error": "End time must be after start time"}), 400

            employee_id = data.get('employee_id')
            if employee_id:
                 employee = Employee.query.get(employee_id)
                 if not employee:
                     return jsonify({"error": f"Employee with ID {employee_id} not found."}), 404

            new_shift = Shift(
                start_time=start_time_dt,
                end_time=end_time_dt,
                employee_id=employee_id,
                notes=data.get('notes')
            )
            db.session.add(new_shift)
            db.session.commit()
            return jsonify(new_shift.to_dict()), 201
        except ValueError as e:
            db.session.rollback()
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            print(f"Error creating shift: {e}")
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'GET':
        try:
            year = request.args.get('year', type=int)
            month = request.args.get('month', type=int)
            query = Shift.query.order_by(Shift.start_time)
            if year and month:
                if not 1 <= month <= 12:
                    return jsonify({"error": "Invalid month parameter."}), 400
                start_datetime = datetime(year, month, 1, 0, 0, 0)
                end_datetime = datetime(year + 1, 1, 1, 0, 0, 0) if month == 12 else datetime(year, month + 1, 1, 0, 0, 0)
                query = query.filter( Shift.start_time < end_datetime, Shift.end_time > start_datetime )
            shifts = query.all()
            return jsonify([shift.to_dict() for shift in shifts]), 200
        except ValueError:
            return jsonify({"error": "Invalid year or month parameter."}), 400
        except Exception as e:
            print(f"Error fetching shifts: {e}")
            return jsonify({"error": "Could not fetch shifts", "details": str(e)}), 500

@app.route('/api/shifts/<int:shift_id>', methods=['GET', 'PUT', 'DELETE'])
@jwt_required()
def handle_shift(shift_id):
    shift = Shift.query.get_or_404(shift_id, description=f"Shift with ID {shift_id} not found.")
    is_supervisor = current_user.role == 'supervisor'

    if request.method in ['PUT', 'DELETE'] and not is_supervisor:
         return jsonify({"error": "Permission denied: Only supervisors can modify or delete shifts"}), 403

    if request.method == 'GET':
        return jsonify(shift.to_dict()), 200

    elif request.method == 'PUT':
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid input"}), 400
        try:
            if 'start_time' in data: shift.start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
            if 'end_time' in data: shift.end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
            if 'employee_id' in data:
                new_employee_id = data.get('employee_id')
                if new_employee_id:
                    employee = Employee.query.get(new_employee_id)
                    if not employee: return jsonify({"error": f"Employee with ID {new_employee_id} not found."}), 404
                    shift.employee_id = new_employee_id
                else:
                    shift.employee_id = None # Allows unassigning if employee_id is nullable
            if 'notes' in data: shift.notes = data.get('notes')

            # Re-validate time constraint
            if shift.end_time <= shift.start_time: raise ValueError("End time must be after start time.")

            db.session.commit()
            return jsonify(shift.to_dict()), 200
        except ValueError as e:
            db.session.rollback()
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            print(f"Error updating shift {shift_id}: {e}")
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'DELETE':
        try:
            db.session.delete(shift)
            db.session.commit()
            return jsonify({"message": f"Shift with ID {shift_id} deleted successfully."}), 200
        except Exception as e:
            db.session.rollback()
            print(f"Error deleting shift {shift_id}: {e}")
            return jsonify({"error": "Internal server error"}), 500


# --- Custom Flask CLI Commands ---


# --- Main Execution Block ---
if __name__ == '__main__':
    # Recommended way to run Flask app for development:
    # Use 'flask run' command instead of app.run() directly inside if __name__
    # Set FLASK_DEBUG=1 environment variable for debug mode
    # Example:
    # $ export FLASK_APP=app.py
    # $ export FLASK_DEBUG=1
    # $ flask run
    #
    # The app.run() below is kept for potential direct execution scenarios,
    # but 'flask run' is generally preferred as it integrates better with Flask's tooling.
    app.run(debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true')