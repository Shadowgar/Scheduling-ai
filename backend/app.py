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
    # ... (Employee model definition - unchanged) ...
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
        }


class Shift(db.Model):
    # ... (Shift model definition - unchanged) ...
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
        # Include employee name if available
        employee_name = Employee.query.get(self.employee_id).name if self.employee_id else None
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': employee_name, # Added for convenience
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
    # Use get instead of query.get to handle potential None if user deleted after token issued
    return db.session.get(Employee, identity)

# --- Basic Test Route ---
@app.route('/')
def index():
    return jsonify({"message": "Welcome to the Scheduling AI Backend!"})

# --- Authentication API Endpoints ---
@app.route('/api/auth/login', methods=['POST'])
def login():
    # ... (login logic - unchanged) ...
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    employee = Employee.query.filter_by(email=email).first()

    if employee and employee.check_password(password):
        # Include user role in the token's additional claims if needed elsewhere,
        # or just return it in the response body. Returning it here is simpler.
        access_token = create_access_token(identity=employee.id)
        return jsonify(
            access_token=access_token,
            user=employee.to_dict() # Contains the role
        ), 200
    else:
        return jsonify({"error": "Invalid credentials"}), 401


@app.route('/api/auth/me', methods=['GET'])
@jwt_required() # Keep this required - need token to know who 'me' is
def get_current_user_info():
    # current_user is guaranteed to be non-None here due to @jwt_required()
    return jsonify(user=current_user.to_dict()), 200

# --- Employee API Endpoints ---
# *** MODIFIED DECORATOR HERE ***
@app.route('/api/employees', methods=['GET', 'POST'])
@jwt_required(optional=True) # Allows anonymous GET, requires token for POST
def handle_employees():
    # current_user is None if no token or invalid token provided
    # current_user is Employee object if valid token provided

    if request.method == 'POST':
        # --- POST requires authentication AND supervisor role ---
        if not current_user:
            return jsonify({"error": "Authentication required to create employees"}), 401
        if current_user.role != 'supervisor':
            return jsonify({"error": "Permission denied: Only supervisors can create employees"}), 403

        # --- Existing POST logic ---
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
            app.logger.error(f"Error creating employee: {e}", exc_info=True) # Log full error
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'GET':
        # --- GET is allowed for anyone (logged in or anonymous) ---
        # No permission check needed here for basic viewing
        try:
            # Consider filtering which fields are returned for anonymous users if needed
            # For now, return all details for simplicity
            all_employees = Employee.query.order_by(Employee.name).all()
            return jsonify([employee.to_dict() for employee in all_employees]), 200
        except Exception as e:
            app.logger.error(f"Error fetching employees: {e}", exc_info=True)
            return jsonify({"error": "Internal server error fetching employees"}), 500

# --- Individual Employee Routes (Keep Protected) ---
@app.route('/api/employees/<int:employee_id>', methods=['GET', 'PUT', 'DELETE'])
@jwt_required() # Keep required - needs auth to know who can access/modify
def handle_employee(employee_id):
    employee = db.session.get(Employee, employee_id)
    if not employee:
        return jsonify({"error": f"Employee with ID {employee_id} not found."}), 404

    # current_user is guaranteed here
    is_supervisor = current_user.role == 'supervisor'
    is_self = current_user.id == employee_id

    # Permission checks remain the same
    if request.method == 'GET' and not (is_supervisor or is_self):
         return jsonify({"error": "Permission denied: Cannot view this employee's details"}), 403
    if request.method == 'PUT' and not (is_supervisor or is_self):
         return jsonify({"error": "Permission denied: Cannot update this employee"}), 403
    if request.method == 'DELETE' and not is_supervisor:
         return jsonify({"error": "Permission denied: Only supervisors can delete employees"}), 403

    if request.method == 'GET':
        return jsonify(employee.to_dict()), 200

    elif request.method == 'PUT':
        # --- Existing PUT logic ---
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid input"}), 400

        try:
            # Role/Sensitive field checks based on is_supervisor
            if not is_supervisor:
                restricted_fields = ['role', 'hire_date', 'end_date', 'status', 'seniority_level', 'max_hours_per_week', 'min_hours_per_week']
                for field in restricted_fields:
                    # Check if field is present in data and is different from current value
                    current_value = getattr(employee, field, None)
                    new_value = data.get(field)
                    # Handle date comparison correctly
                    if isinstance(current_value, date) and isinstance(new_value, str):
                        try: new_value_date = datetime.strptime(new_value, '%Y-%m-%d').date()
                        except ValueError: pass # Let main update logic handle format error
                        else: new_value = new_value_date
                    elif isinstance(current_value, EmployeeStatus) and isinstance(new_value, str):
                        new_value = EmployeeStatus(new_value) # Compare enum values

                    if field in data and current_value != new_value:
                         return jsonify({"error": f"Permission denied: Cannot change '{field}'"}), 403

            # Apply updates (unchanged logic, relies on is_supervisor where needed)
            if 'name' in data: employee.name = data['name']
            if 'email' in data:
                if data['email'] != employee.email and Employee.query.filter(Employee.email == data['email'], Employee.id != employee_id).first():
                     return jsonify({"error": "Email address already registered by another user"}), 409
                employee.email = data.get('email')
            if 'phone' in data: employee.phone = data.get('phone')
            # Only supervisor can change role and sensitive fields
            if 'role' in data and is_supervisor: employee.role = data['role']
            if 'hire_date' in data and is_supervisor: employee.hire_date = datetime.strptime(data['hire_date'], '%Y-%m-%d').date()
            if 'end_date' in data and is_supervisor: employee.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data.get('end_date') else None
            if 'status' in data and is_supervisor: employee.status = EmployeeStatus(data['status'])
            if 'seniority_level' in data and is_supervisor: employee.seniority_level = data.get('seniority_level')
            if 'max_hours_per_week' in data and is_supervisor: employee.max_hours_per_week = data.get('max_hours_per_week')
            if 'min_hours_per_week' in data and is_supervisor: employee.min_hours_per_week = data.get('min_hours_per_week')

            # Password change check
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
            app.logger.error(f"Error updating employee {employee_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500


    elif request.method == 'DELETE':
        # --- Existing DELETE logic (requires supervisor) ---
        try:
            db.session.delete(employee)
            db.session.commit()
            return jsonify({"message": f"Employee with ID {employee_id} deleted successfully."}), 200
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting employee {employee_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500


# --- Shift API Routes ---
# *** MODIFIED DECORATOR HERE ***
@app.route('/api/shifts', methods=['GET', 'POST'])
@jwt_required(optional=True) # Allows anonymous GET, requires token for POST
def handle_shifts():
    # current_user is None if no token or invalid token provided
    # current_user is Employee object if valid token provided

    if request.method == 'POST':
        # --- POST requires authentication AND supervisor role ---
        if not current_user:
            return jsonify({"error": "Authentication required to create shifts"}), 401
        if current_user.role != 'supervisor':
            return jsonify({"error": "Permission denied: Only supervisors can create shifts"}), 403

        # --- Existing POST logic ---
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
                 employee = db.session.get(Employee, employee_id) # Use db.session.get
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
            # Refresh the object to potentially get relationship data like employee_name
            db.session.refresh(new_shift)
            return jsonify(new_shift.to_dict()), 201
        except ValueError as e:
            db.session.rollback()
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error creating shift: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'GET':
        # --- GET is allowed for anyone (logged in or anonymous) ---
        try:
            year = request.args.get('year', type=int)
            month = request.args.get('month', type=int)

            # Basic validation for year and month
            if not (year and month and 1 <= month <= 12 and year > 1900 and year < 3000):
                 # Return empty list or error if params are missing/invalid for anonymous view
                 # Adjust this behavior as needed
                 return jsonify({"error": "Valid year and month parameters are required."}), 400

            start_datetime = datetime(year, month, 1, 0, 0, 0)
            # Calculate end_datetime correctly for December
            end_month = month + 1
            end_year = year
            if end_month > 12:
                end_month = 1
                end_year += 1
            end_datetime = datetime(end_year, end_month, 1, 0, 0, 0)

            # Query shifts within the date range
            query = Shift.query.filter(
                Shift.start_time >= start_datetime,
                Shift.start_time < end_datetime
            ).order_by(Shift.start_time)

            shifts = query.all()
            return jsonify([shift.to_dict() for shift in shifts]), 200
        except ValueError: # Catch potential errors from date creation if needed
            return jsonify({"error": "Invalid year or month parameter value."}), 400
        except Exception as e:
            app.logger.error(f"Error fetching shifts: {e}", exc_info=True)
            return jsonify({"error": "Could not fetch shifts", "details": str(e)}), 500


# --- Individual Shift Routes (Keep Protected) ---
@app.route('/api/shifts/<int:shift_id>', methods=['GET', 'PUT', 'DELETE'])
@jwt_required() # Keep required - needs auth to modify/view specific shift
def handle_shift(shift_id):
    shift = db.session.get(Shift, shift_id) # Use db.session.get
    if not shift:
        return jsonify({"error": f"Shift with ID {shift_id} not found."}), 404

    # current_user is guaranteed here
    is_supervisor = current_user.role == 'supervisor'

    # Allow GET for any authenticated user (can adjust if needed)
    # Require supervisor for PUT/DELETE
    if request.method in ['PUT', 'DELETE'] and not is_supervisor:
         return jsonify({"error": "Permission denied: Only supervisors can modify or delete shifts"}), 403

    if request.method == 'GET':
        return jsonify(shift.to_dict()), 200

    elif request.method == 'PUT':
        # --- Existing PUT logic ---
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid input"}), 400
        try:
            # Only supervisors can change these fields
            if 'start_time' in data: shift.start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
            if 'end_time' in data: shift.end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
            if 'employee_id' in data:
                new_employee_id = data.get('employee_id')
                if new_employee_id is not None: # Allow setting to null or valid ID
                    if new_employee_id > 0: # Check if it's a positive ID
                        employee = db.session.get(Employee, new_employee_id)
                        if not employee: return jsonify({"error": f"Employee with ID {new_employee_id} not found."}), 404
                        shift.employee_id = new_employee_id
                    else: # Treat 0 or negative as unassigning
                         shift.employee_id = None
                else: # Explicitly setting to null
                    shift.employee_id = None
            if 'notes' in data: shift.notes = data.get('notes')

            # Re-validate time constraint after potential updates
            if shift.start_time and shift.end_time and shift.end_time <= shift.start_time:
                 raise ValueError("End time must be after start time.")

            db.session.commit()
            db.session.refresh(shift) # Refresh to get updated relationship data if needed
            return jsonify(shift.to_dict()), 200
        except ValueError as e:
            db.session.rollback()
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error updating shift {shift_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500


    elif request.method == 'DELETE':
        # --- Existing DELETE logic (requires supervisor) ---
        try:
            db.session.delete(shift)
            db.session.commit()
            return jsonify({"message": f"Shift with ID {shift_id} deleted successfully."}), 200
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting shift {shift_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500


# --- Custom Flask CLI Commands ---
# (Add any custom commands like creating users here if needed)


# --- Main Execution Block ---
if __name__ == '__main__':
    # Configure basic logging if not already done elsewhere
    if not app.debug:
        import logging
        from logging.handlers import RotatingFileHandler
        # Example: Log to a file
        if not os.path.exists('logs'):
            os.mkdir('logs')
        file_handler = RotatingFileHandler('logs/scheduler.log', maxBytes=10240, backupCount=10)
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        app.logger.setLevel(logging.INFO)
        app.logger.info('Scheduler backend startup')

    # Use 'flask run' command for development (recommended)
    # The app.run() below is a fallback
    port = int(os.environ.get("PORT", 5000)) # Use PORT env var if available
    app.run(host='0.0.0.0', port=port, debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true')