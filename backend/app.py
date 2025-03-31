# backend/app.py
import os
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime, date # Ensure date is imported
import enum
import logging # Import logging

# --- Add these imports ---
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, current_user, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
# --- End added imports ---

# Load environment variables from .env file
load_dotenv()

# --- Flask App Initialization ---
app = Flask(__name__) # Define app instance EARLY
CORS(app) # Enable CORS for all routes

# --- Configure Logging ---
# Configure logging to show info level messages
logging.basicConfig(level=logging.INFO)
# You can also configure Flask's logger specifically if needed
# app.logger.setLevel(logging.INFO)


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
    show_on_schedule = db.Column(db.Boolean, nullable=False, default=True, server_default='true') # Show by default
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
            'show_on_schedule': self.show_on_schedule,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
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
        employee_name = None
        if self.employee_id:
             emp = db.session.get(Employee, self.employee_id)
             if emp:
                 employee_name = emp.name
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': employee_name,
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
        if key == 'end_time': end = value
        elif key == 'start_time': start = value
        if isinstance(start, datetime) and isinstance(end, datetime) and end <= start:
            raise ValueError("End time must be after start time.")
        return value

# --- JWT User Loading Callback ---
@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity_str = jwt_data["sub"] # The 'sub' claim is now a string
    try:
        identity_int = int(identity_str)
    except ValueError:
        app.logger.warning(f"Invalid non-integer subject found in JWT: {identity_str}")
        return None # Cannot look up user if ID isn't an integer string
    return db.session.get(Employee, identity_int)


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
        access_token = create_access_token(identity=str(employee.id))
        app.logger.info(f"User logged in successfully: {employee.email} (ID: {employee.id})") # Log success
        return jsonify(
            access_token=access_token,
            user=employee.to_dict() # Contains the role
        ), 200
    else:
        app.logger.warning(f"Failed login attempt for email: {email}") # Log failure
        return jsonify({"error": "Invalid credentials"}), 401


@app.route('/api/auth/me', methods=['GET'])
@jwt_required() # Keep this required - need token to know who 'me' is
def get_current_user_info():
    if not current_user:
         app.logger.error("get_current_user_info called but current_user is None (token might be valid but user deleted?)")
         return jsonify({"error": "User not found for token"}), 404
    # app.logger.info(f"Returning user info for: {current_user.email}") # Can be noisy
    return jsonify(user=current_user.to_dict()), 200

# --- Employee API Endpoints ---

# --- NEW: Endpoint for Admin/Management View ---
@app.route('/api/admin/employees', methods=['GET'])
@jwt_required() # Require login
def handle_admin_employees():
    app.logger.info(f"Request received for /api/admin/employees by user: {current_user.email if current_user else 'Unknown'}")

    # --- Permission Check: Ensure only supervisors can access ---
    if not current_user or current_user.role != 'supervisor':
        app.logger.warning(f"Permission denied for /api/admin/employees. User: {current_user.email if current_user else 'None'}, Role: {current_user.role if current_user else 'N/A'}")
        return jsonify({"error": "Permission denied: Only supervisors can access the full employee list"}), 403

    # --- Fetch Employees for Admin View ---
    if request.method == 'GET':
        try:
            # Fetch all employees EXCEPT 'terminated' status
            admin_employees = Employee.query.filter(
                Employee.status != EmployeeStatus.TERMINATED
            ).order_by(Employee.name).all()

            # Alternative: Fetch ALL employees regardless of status
            # admin_employees = Employee.query.order_by(Employee.name).all()

            app.logger.info(f"Returning {len(admin_employees)} employees for admin view.")
            return jsonify([employee.to_dict() for employee in admin_employees]), 200
        except Exception as e:
            app.logger.error(f"Error fetching admin employees: {e}", exc_info=True)
            return jsonify({"error": "Internal server error fetching admin employees"}), 500


# --- ORIGINAL Endpoint for Schedule View & Creating Employees ---
@app.route('/api/employees', methods=['GET', 'POST'])
@jwt_required(optional=True) # Allows anonymous GET for schedule, requires token for POST
def handle_employees():
    # current_user is None if no token or invalid token provided
    # current_user is Employee object if valid token provided

    if request.method == 'POST':
        # --- POST requires authentication AND supervisor role ---
        if not current_user:
            app.logger.warning("Attempt to POST /api/employees without authentication.")
            return jsonify({"error": "Authentication required to create employees"}), 401
        if current_user.role != 'supervisor':
            app.logger.warning(f"Attempt to POST /api/employees by non-supervisor: {current_user.email} (Role: {current_user.role})")
            return jsonify({"error": "Permission denied: Only supervisors can create employees"}), 403

        data = request.get_json()
        password = data.get('password')
        # Basic validation (add more as needed)
        if not password: return jsonify({"error": "Password is required for new employees"}), 400
        if not data.get('email'): return jsonify({"error": "Email is required"}), 400
        if not data.get('name'): return jsonify({"error": "Name is required"}), 400
        if not data.get('role'): return jsonify({"error": "Role is required"}), 400
        if not data.get('hire_date'): return jsonify({"error": "Hire date is required"}), 400

        if Employee.query.filter_by(email=data['email']).first():
            return jsonify({"error": "Email address already registered"}), 409

        try:
            hire_date_obj = datetime.strptime(data['hire_date'], '%Y-%m-%d').date()
            end_date_obj = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data.get('end_date') else None
            status_enum = EmployeeStatus(data['status']) if data.get('status') else EmployeeStatus.ACTIVE
            show_on_schedule_val = data.get('show_on_schedule', True) # Default to True if not provided

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
                min_hours_per_week=data.get('min_hours_per_week'),
                # Ensure boolean conversion from potentially varied inputs
                show_on_schedule=str(show_on_schedule_val).lower() in ['true', '1', 'yes']
            )
            new_employee.set_password(password)
            db.session.add(new_employee)
            db.session.commit()
            app.logger.info(f"New employee created: {new_employee.email} (ID: {new_employee.id}) by {current_user.email}")
            return jsonify(new_employee.to_dict()), 201
        except ValueError as e:
            db.session.rollback()
            app.logger.error(f"ValueError creating employee: {e}")
            return jsonify({"error": f"Invalid data format: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error creating employee: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'GET':
        # This endpoint is for the SCHEDULE VIEW - keep the filter!
        try:
            # Fetch only employees meant to be shown on the schedule AND are active
            schedulable_employees = Employee.query.filter_by(
                show_on_schedule=True,
                status=EmployeeStatus.ACTIVE # Only show active employees on schedule
            ).order_by(Employee.name).all()
            # app.logger.info(f"Returning {len(schedulable_employees)} employees for schedule view.") # Can be noisy
            return jsonify([employee.to_dict() for employee in schedulable_employees]), 200
        except Exception as e:
            app.logger.error(f"Error fetching schedulable employees: {e}", exc_info=True)
            return jsonify({"error": "Internal server error fetching schedulable employees"}), 500

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

    # Permission checks
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

        # Prevent non-supervisors from changing restricted fields
        if not is_supervisor:
            restricted_fields = ['role', 'hire_date', 'end_date', 'status', 'seniority_level', 'max_hours_per_week', 'min_hours_per_week', 'show_on_schedule']
            for field in restricted_fields:
                if field in data and data[field] != getattr(employee, field):
                    # Handle boolean comparison carefully
                    if field == 'show_on_schedule':
                         current_val = getattr(employee, field)
                         new_val = str(data[field]).lower() in ['true', '1', 'yes']
                         if current_val != new_val:
                              return jsonify({"error": f"Permission denied: Cannot change '{field}'"}), 403
                    elif field == 'status':
                         current_val = getattr(employee, field)
                         try:
                              new_val = EmployeeStatus(data[field])
                              if current_val != new_val:
                                   return jsonify({"error": f"Permission denied: Cannot change '{field}'"}), 403
                         except ValueError: pass # Let main validation handle bad enum value
                    elif data[field] != getattr(employee, field):
                         return jsonify({"error": f"Permission denied: Cannot change '{field}'"}), 403


        try:
            # Apply updates (allow self-update for non-restricted fields)
            if 'name' in data: employee.name = data['name']
            if 'email' in data:
                 if data['email'] != employee.email and Employee.query.filter(Employee.email == data['email'], Employee.id != employee_id).first():
                     return jsonify({"error": "Email address already registered by another user"}), 409
                 employee.email = data['email']
            if 'phone' in data: employee.phone = data.get('phone') # Allow clearing phone

            # Supervisor-only fields
            if is_supervisor:
                if 'role' in data: employee.role = data['role']
                if 'hire_date' in data: employee.hire_date = datetime.strptime(data['hire_date'], '%Y-%m-%d').date()
                if 'end_date' in data: employee.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data.get('end_date') else None
                if 'status' in data: employee.status = EmployeeStatus(data['status']) # Validate enum
                if 'seniority_level' in data: employee.seniority_level = data.get('seniority_level')
                if 'max_hours_per_week' in data: employee.max_hours_per_week = data.get('max_hours_per_week')
                if 'min_hours_per_week' in data: employee.min_hours_per_week = data.get('min_hours_per_week')
                # Handle show_on_schedule carefully for boolean conversion
                if 'show_on_schedule' in data:
                    employee.show_on_schedule = str(data['show_on_schedule']).lower() in ['true', '1', 'yes']

            # Password change (allowed by self or supervisor)
            if 'password' in data and data['password']:
                 if not is_self and not is_supervisor:
                     # This check is technically redundant due to the PUT permission check above, but safe to keep
                     return jsonify({"error": "Permission denied: Cannot change password for other users"}), 403
                 employee.set_password(data['password'])

            employee.updated_at = datetime.utcnow() # Manually update timestamp if needed
            db.session.commit()
            app.logger.info(f"Employee {employee_id} updated by {current_user.email}")
            return jsonify(employee.to_dict()), 200
        except ValueError as e: # Catches bad date formats or bad enum values
            db.session.rollback()
            app.logger.error(f"ValueError updating employee {employee_id}: {e}")
            return jsonify({"error": f"Invalid data format: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error updating employee {employee_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'DELETE':
        # Permission check already done (only supervisor)
        try:
            # Consider setting status to 'terminated' instead of deleting?
            # employee.status = EmployeeStatus.TERMINATED
            # employee.end_date = date.today()
            # db.session.commit()
            # Or, proceed with actual deletion:
            email_deleted = employee.email # Log email before deleting
            db.session.delete(employee)
            db.session.commit()
            app.logger.info(f"Employee {employee_id} ({email_deleted}) deleted by {current_user.email}")
            return jsonify({"message": f"Employee with ID {employee_id} deleted successfully."}), 200 # 200 OK with message
            # return '', 204 # Or 204 No Content
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting employee {employee_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500


# --- Shift API Routes ---
@app.route('/api/shifts', methods=['GET', 'POST'])
@jwt_required(optional=True) # Allow anonymous GET, require supervisor POST
def handle_shifts():
    if request.method == 'POST':
        if not current_user or current_user.role != 'supervisor':
            return jsonify({"error": "Permission denied: Only supervisors can create shifts"}), 403

        data = request.get_json()
        required_fields = ['employee_id', 'start_time', 'end_time']
        if not all(field in data for field in required_fields):
            missing = [f for f in required_fields if f not in data]
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        try:
            start_time_obj = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00')) # Handle Z timezone
            end_time_obj = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))

            # Check if employee exists
            if not db.session.get(Employee, data['employee_id']):
                 return jsonify({"error": f"Employee with ID {data['employee_id']} not found"}), 404

            new_shift = Shift(
                employee_id=data['employee_id'],
                start_time=start_time_obj,
                end_time=end_time_obj,
                notes=data.get('notes')
            )
            db.session.add(new_shift)
            db.session.commit()
            app.logger.info(f"Shift created for employee {data['employee_id']} by {current_user.email}")
            return jsonify(new_shift.to_dict()), 201
        except ValueError as e: # Catches bad ISO formats or end <= start from model validation
            db.session.rollback()
            app.logger.error(f"ValueError creating shift: {e}")
            return jsonify({"error": f"Invalid data format: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error creating shift: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'GET':
        # Handles GET /api/shifts?year=YYYY&month=MM
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)

        if not year or not month:
            return jsonify({"error": "Year and month query parameters are required"}), 400
        if not (1 <= month <= 12):
             return jsonify({"error": "Invalid month parameter"}), 400

        try:
            start_of_month = datetime(year, month, 1)
            if month == 12: end_of_month = datetime(year + 1, 1, 1)
            else: end_of_month = datetime(year, month + 1, 1)

            shifts_in_month = Shift.query.filter(
                Shift.start_time >= start_of_month,
                Shift.start_time < end_of_month
            ).order_by(Shift.start_time).all()

            # Return empty list if no shifts found, not 404
            # app.logger.info(f"Returning {len(shifts_in_month)} shifts for {year}-{month}") # Can be noisy
            return jsonify([shift.to_dict() for shift in shifts_in_month]), 200

        except Exception as e:
            app.logger.error(f"Error fetching shifts for {year}-{month}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error fetching shifts"}), 500


@app.route('/api/shifts/<int:shift_id>', methods=['PUT', 'DELETE'])
@jwt_required() # Require JWT for modification/deletion
def handle_shift(shift_id):
    shift = db.session.get(Shift, shift_id)
    if not shift:
        return jsonify({"error": f"Shift with ID {shift_id} not found."}), 404

    # Only supervisors can modify/delete shifts
    if current_user.role != 'supervisor':
        return jsonify({"error": "Permission denied: Only supervisors can modify or delete shifts"}), 403

    if request.method == 'PUT':
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid input"}), 400

        try:
            updated = False
            if 'employee_id' in data:
                 if not db.session.get(Employee, data['employee_id']):
                     return jsonify({"error": f"Employee with ID {data['employee_id']} not found"}), 404
                 if shift.employee_id != data['employee_id']:
                      shift.employee_id = data['employee_id']
                      updated = True
            if 'start_time' in data:
                new_start = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
                if shift.start_time != new_start:
                     shift.start_time = new_start
                     updated = True
            if 'end_time' in data:
                new_end = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
                if shift.end_time != new_end:
                     shift.end_time = new_end
                     updated = True
            if 'notes' in data:
                if shift.notes != data.get('notes'): # Allow notes to be cleared
                     shift.notes = data.get('notes')
                     updated = True

            if updated:
                 shift.updated_at = datetime.utcnow() # Manually update timestamp
                 db.session.commit()
                 app.logger.info(f"Shift {shift_id} updated by {current_user.email}")
            else:
                 app.logger.info(f"Shift {shift_id} update requested by {current_user.email}, but no changes detected.")


            return jsonify(shift.to_dict()), 200
        except ValueError as e: # Catches bad ISO formats or end <= start from model validation
            db.session.rollback()
            app.logger.error(f"ValueError updating shift {shift_id}: {e}")
            return jsonify({"error": f"Invalid data format: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error updating shift {shift_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'DELETE':
        try:
            db.session.delete(shift)
            db.session.commit()
            app.logger.info(f"Shift {shift_id} deleted by {current_user.email}")
            return jsonify({"message": f"Shift with ID {shift_id} deleted successfully."}), 200 # 200 OK with message
            # return '', 204 # Or 204 No Content
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting shift {shift_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500


# --- Main Execution Block ---
if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on the network if needed
    app.run(debug=True, host='0.0.0.0', port=5000) # Use port 5000 for Flask dev server