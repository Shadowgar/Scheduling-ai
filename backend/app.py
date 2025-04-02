import os
import requests
import re # --- Added regex import for parsing ---
import traceback # Import traceback for detailed error logging
import enum
import logging # Import logging

from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from dotenv import load_dotenv
# --- Ensure datetime, date, and timezone are imported ---
from datetime import datetime, date, timezone, timedelta # Added timedelta
# --- End datetime imports ---
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, current_user, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash


# Load environment variables from .env file
load_dotenv()

# --- Flask App Initialization ---
app = Flask(__name__) # Fixed: Use __name__
CORS(app) # Enable CORS for all routes
# --- End Flask App Initialization ---

# --- Configure Logging ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
app.logger.setLevel(logging.INFO) # Ensure app logger level is set
# --- End Configure Logging ---

# --- Database Configuration ---
db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise ValueError("DATABASE_URL environment variable not set.")
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
# --- End Database Configuration ---

# --- JWT Configuration ---
jwt_secret = os.getenv('JWT_SECRET_KEY')
if not jwt_secret:
    raise ValueError("No JWT_SECRET_KEY set in environment variables")
app.config['JWT_SECRET_KEY'] = jwt_secret
# --- End JWT Configuration ---

# --- Ollama Configuration ---
OLLAMA_API_URL = os.environ.get('OLLAMA_API_URL', 'http://localhost:11434/api')
DEFAULT_MODEL = os.environ.get('OLLAMA_DEFAULT_MODEL', 'llama3:8b') # Use the correct default model name
# --- End Ollama Configuration ---

# --- Extensions Initialization ---
db = SQLAlchemy(app) # Initialize SQLAlchemy extension
migrate = Migrate(app, db) # Initialize Flask-Migrate extension
jwt = JWTManager(app) # Initialize JWTManager
# --- End Extensions Initialization ---


# --- Database Models ---

class EmployeeStatus(enum.Enum):
    ACTIVE = 'active'
    INACTIVE = 'inactive'
    ON_LEAVE = 'on_leave'
    TERMINATED = 'terminated'

# --- Enum for Access Role (Using lowercase values) ---
class AccessRole(enum.Enum):
    SUPERVISOR = 'supervisor'
    MEMBER = 'member'
# --- End Enum ---

class Employee(db.Model):
    __tablename__ = 'employees' # Fixed: Use __tablename__

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20), nullable=True)

    job_title = db.Column(db.String(100), nullable=False)
    access_role = db.Column(
        db.Enum(
            AccessRole,
            name='accessroleenum',
            values_callable=lambda x: [e.value for e in x] # Explicitly use enum values for DB mapping
        ),
        nullable=False,
        default=AccessRole.MEMBER,
        server_default=AccessRole.MEMBER.value
    )

    hire_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.Enum(EmployeeStatus), nullable=False, default=EmployeeStatus.ACTIVE)
    seniority_level = db.Column(db.Integer, nullable=True)
    max_hours_per_week = db.Column(db.Integer, nullable=True)
    min_hours_per_week = db.Column(db.Integer, nullable=True)
    password_hash = db.Column(db.String(256), nullable=False)
    show_on_schedule = db.Column(db.Boolean, nullable=False, default=True, server_default='true')
    # Use timezone aware defaults
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    shifts = db.relationship('Shift', backref='employee', lazy=True, cascade="all, delete-orphan")
    ollama_queries = db.relationship('OllamaQuery', backref='employee', lazy=True, cascade="all, delete-orphan")

    def set_password(self, password):
        if not password:
             raise ValueError("Password cannot be empty")
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def __repr__(self): # Fixed: Use __repr__
        return f'<Employee {self.id}: {self.name} ({self.job_title} - {self.access_role.value})>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'job_title': self.job_title,
            'access_role': self.access_role.value,
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
    __tablename__ = 'shifts' # Fixed: Use __tablename__

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=True)
    # Store datetimes as timezone-aware UTC
    start_time = db.Column(db.DateTime(timezone=True), nullable=False)
    end_time = db.Column(db.DateTime(timezone=True), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    cell_text = db.Column(db.String(20), nullable=True)
    # Add a shift_type column if needed for filtering (e.g., 'Morning', 'Evening')
    # shift_type = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


    def __repr__(self): # Fixed: Use __repr__
        return f'<Shift id={self.id} start={self.start_time} cell={self.cell_text} employee_id={self.employee_id}>'

    def to_dict(self):
        employee_name = None
        employee_job_title = None
        if self.employee_id:
             emp = db.session.get(Employee, self.employee_id)
             if emp:
                 employee_name = emp.name
                 employee_job_title = emp.job_title
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': employee_name,
            'employee_job_title': employee_job_title,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'notes': self.notes,
            'cell_text': self.cell_text,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    # --- Validator should work with aware datetimes ---
    @db.validates('start_time', 'end_time')
    def validate_end_time(self, key, value):
        # Ensure the value being validated is timezone-aware
        if isinstance(value, datetime) and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc) # Assume UTC if naive
        elif not isinstance(value, datetime):
             return value # Allow None etc.

        start = self.start_time
        end = self.end_time

        # Ensure existing values are aware
        if isinstance(start, datetime) and start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        if isinstance(end, datetime) and end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)

        if key == 'start_time':
            start = value
        elif key == 'end_time':
            end = value

        if isinstance(start, datetime) and isinstance(end, datetime):
            if end <= start:
                raise ValueError("End time must be after start time.")
        return value
    # --- END VALIDATOR ---


# --- Ollama Query Model ---
class OllamaQuery(db.Model):
    __tablename__ = 'ollama_queries' # Fixed: Use __tablename__

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    query = db.Column(db.Text, nullable=False) # Original user query
    # prompt_sent = db.Column(db.Text, nullable=True) # Optional: Store the full augmented prompt
    response = db.Column(db.Text, nullable=False) # Final AI response
    model_used = db.Column(db.String(50), default=DEFAULT_MODEL)
    created_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'employee_name': self.employee.name if self.employee else None,
            'query': self.query,
            'response': self.response,
            'model_used': self.model_used,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
# --- End Ollama Query Model ---


# --- JWT User Loading Callback ---
@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity_str = jwt_data["sub"]
    try:
        identity_int = int(identity_str)
    except ValueError:
        app.logger.warning(f"Invalid non-integer subject found in JWT: {identity_str}")
        return None
    return db.session.get(Employee, identity_int)
# --- End JWT User Loading Callback ---

# --- Basic Test Route ---
@app.route('/')
def index():
    return jsonify({"message": "Welcome to the Scheduling AI Backend!"})
# --- End Basic Test Route ---


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
        app.logger.info(f"User logged in successfully: {employee.email} (ID: {employee.id})")
        return jsonify(
            access_token=access_token,
            user=employee.to_dict()
        ), 200
    else:
        app.logger.warning(f"Failed login attempt for email: {email}")
        return jsonify({"error": "Invalid credentials"}), 401


@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user_info():
    if not current_user:
         app.logger.error("get_current_user_info called but current_user is None")
         return jsonify({"error": "User not found for token"}), 404
    return jsonify(user=current_user.to_dict()), 200
# --- End Authentication API Endpoints ---


# --- Employee API Endpoints ---
# (Employee endpoints remain largely the same, ensure logging and error handling are consistent)
# ... (handle_admin_employees, handle_employees, handle_employee endpoints) ...
# NOTE: These were truncated in the previous response, assuming they are mostly correct.
# Ensure they use app.logger and consistent error handling.
# Add them back here if you need them fully checked/updated.
@app.route('/api/admin/employees', methods=['GET'])
@jwt_required()
def handle_admin_employees():
    app.logger.info(f"Request received for /api/admin/employees by user: {current_user.email if current_user else 'Unknown'}")
    if not current_user or current_user.access_role != AccessRole.SUPERVISOR:
        app.logger.warning(f"Permission denied for /api/admin/employees. User: {current_user.email if current_user else 'None'}, Role: {current_user.access_role.value if current_user else 'N/A'}")
        return jsonify({"error": "Permission denied: Only supervisors can access the full employee list"}), 403
    try:
        admin_employees = Employee.query.filter(
            Employee.status != EmployeeStatus.TERMINATED
        ).order_by(Employee.name).all()
        app.logger.info(f"Returning {len(admin_employees)} employees for admin view.")
        return jsonify([employee.to_dict() for employee in admin_employees]), 200
    except Exception as e:
        app.logger.error(f"Error fetching admin employees: {e}", exc_info=True)
        return jsonify({"error": "Internal server error fetching admin employees"}), 500

@app.route('/api/employees', methods=['GET', 'POST'])
@jwt_required(optional=True)
def handle_employees():
    if request.method == 'POST':
        if not current_user:
            app.logger.warning("Attempt to POST /api/employees without authentication.")
            return jsonify({"error": "Authentication required to create employees"}), 401
        if current_user.access_role != AccessRole.SUPERVISOR:
            app.logger.warning(f"Attempt to POST /api/employees by non-supervisor: {current_user.email} (Role: {current_user.access_role.value})")
            return jsonify({"error": "Permission denied: Only supervisors can create employees"}), 403
        data = request.get_json()
        required_fields = ['name', 'email', 'password', 'job_title', 'hire_date']
        if not all(field in data and data[field] for field in required_fields):
            missing = [f for f in required_fields if f not in data or not data[f]]
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        access_role_str = data.get('access_role')
        if access_role_str and access_role_str not in [role.value for role in AccessRole]:
             return jsonify({"error": f"Invalid access_role value: {access_role_str}"}), 400
        if Employee.query.filter_by(email=data['email']).first():
            return jsonify({"error": "Email address already registered"}), 409
        try:
            hire_date_obj = datetime.strptime(data['hire_date'], '%Y-%m-%d').date()
            end_date_obj = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data.get('end_date') else None
            status_enum = EmployeeStatus(data['status']) if data.get('status') else EmployeeStatus.ACTIVE
            access_role_enum = AccessRole(access_role_str) if access_role_str else AccessRole.MEMBER
            show_on_schedule_val = data.get('show_on_schedule', True)

            new_employee = Employee(
                name=data['name'], email=data['email'], phone=data.get('phone'),
                job_title=data['job_title'], access_role=access_role_enum,
                hire_date=hire_date_obj, end_date=end_date_obj, status=status_enum,
                seniority_level=data.get('seniority_level'),
                max_hours_per_week=data.get('max_hours_per_week'),
                min_hours_per_week=data.get('min_hours_per_week'),
                show_on_schedule=str(show_on_schedule_val).lower() in ['true', '1', 'yes']
            )
            new_employee.set_password(data['password'])
            db.session.add(new_employee)
            db.session.commit()
            app.logger.info(f"New employee created: {new_employee.email} (ID: {new_employee.id}) by {current_user.email}")
            return jsonify(new_employee.to_dict()), 201
        except ValueError as e:
            db.session.rollback()
            app.logger.error(f"ValueError creating employee: {e}")
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error creating employee: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'GET':
        try:
            schedulable_employees = Employee.query.filter_by(
                show_on_schedule=True,
                status=EmployeeStatus.ACTIVE
            ).order_by(Employee.name).all()
            return jsonify([employee.to_dict() for employee in schedulable_employees]), 200
        except Exception as e:
            app.logger.error(f"Error fetching schedulable employees: {e}", exc_info=True)
            return jsonify({"error": "Internal server error fetching schedulable employees"}), 500

@app.route('/api/employees/<int:employee_id>', methods=['GET', 'PUT', 'DELETE'])
@jwt_required()
def handle_employee(employee_id):
    employee = db.session.get(Employee, employee_id)
    if not employee:
        return jsonify({"error": f"Employee with ID {employee_id} not found."}), 404

    is_supervisor = current_user.access_role == AccessRole.SUPERVISOR
    is_self = current_user.id == employee_id

    if request.method == 'GET' and not (is_supervisor or is_self):
         return jsonify({"error": "Permission denied: Cannot view this employee's details"}), 403
    if request.method == 'PUT' and not (is_supervisor or is_self):
         data = request.get_json()
         allowed_self_edit_fields = ['name', 'email', 'phone', 'password']
         for field in data:
             if field not in allowed_self_edit_fields:
                 app.logger.warning(f"Self-edit attempt denied for field '{field}' by user {current_user.email}")
                 return jsonify({"error": f"Permission denied: Cannot change '{field}' for yourself"}), 403
    if request.method == 'DELETE' and not is_supervisor:
         return jsonify({"error": "Permission denied: Only supervisors can delete employees"}), 403

    if request.method == 'GET':
        return jsonify(employee.to_dict()), 200

    elif request.method == 'PUT':
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid input"}), 400
        try:
            updated = False
            if 'name' in data and employee.name != data['name']: employee.name = data['name']; updated = True
            if 'email' in data and employee.email != data['email']:
                 if Employee.query.filter(Employee.email == data['email'], Employee.id != employee_id).first():
                     return jsonify({"error": "Email address already registered by another user"}), 409
                 employee.email = data['email']; updated = True
            if 'phone' in data and employee.phone != data.get('phone'): employee.phone = data.get('phone'); updated = True
            if 'password' in data and data['password']: employee.set_password(data['password']); updated = True

            if is_supervisor:
                if 'job_title' in data and employee.job_title != data['job_title']: employee.job_title = data['job_title']; updated = True
                if 'access_role' in data:
                    try:
                        new_role = AccessRole(data['access_role'])
                        if employee.access_role != new_role: employee.access_role = new_role; updated = True
                    except ValueError: return jsonify({"error": f"Invalid access_role value: {data['access_role']}"}), 400
                if 'hire_date' in data:
                     try:
                         new_hire_date = datetime.strptime(data['hire_date'], '%Y-%m-%d').date()
                         if employee.hire_date != new_hire_date: employee.hire_date = new_hire_date; updated = True
                     except (ValueError, TypeError): return jsonify({"error": "Invalid hire_date format (YYYY-MM-DD)"}), 400
                if 'end_date' in data:
                    try:
                        new_end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data.get('end_date') else None
                        if employee.end_date != new_end_date: employee.end_date = new_end_date; updated = True
                    except (ValueError, TypeError): return jsonify({"error": "Invalid end_date format (YYYY-MM-DD)"}), 400
                if 'status' in data:
                    try:
                        new_status = EmployeeStatus(data['status'])
                        if employee.status != new_status: employee.status = new_status; updated = True
                    except ValueError: return jsonify({"error": f"Invalid status value: {data['status']}"}), 400
                if 'seniority_level' in data and employee.seniority_level != data.get('seniority_level'): employee.seniority_level = data.get('seniority_level'); updated = True
                if 'max_hours_per_week' in data and employee.max_hours_per_week != data.get('max_hours_per_week'): employee.max_hours_per_week = data.get('max_hours_per_week'); updated = True
                if 'min_hours_per_week' in data and employee.min_hours_per_week != data.get('min_hours_per_week'): employee.min_hours_per_week = data.get('min_hours_per_week'); updated = True
                if 'show_on_schedule' in data:
                     new_show = str(data['show_on_schedule']).lower() in ['true', '1', 'yes']
                     if employee.show_on_schedule != new_show: employee.show_on_schedule = new_show; updated = True

            if updated:
                # employee.updated_at = datetime.now(timezone.utc) # Handled by onupdate
                db.session.commit()
                app.logger.info(f"Employee {employee_id} updated by {current_user.email}")
            else:
                app.logger.info(f"Employee {employee_id} update request by {current_user.email}, but no changes detected.")
            return jsonify(employee.to_dict()), 200
        except ValueError as e:
            db.session.rollback()
            app.logger.error(f"ValueError updating employee {employee_id}: {e}")
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error updating employee {employee_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'DELETE':
        try:
            email_deleted = employee.email
            db.session.delete(employee)
            db.session.commit()
            app.logger.info(f"Employee {employee_id} ({email_deleted}) deleted by {current_user.email}")
            return jsonify({"message": f"Employee with ID {employee_id} deleted successfully."}), 200
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting employee {employee_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500
# --- End Employee API Endpoints ---


# --- Shift API Routes ---
@app.route('/api/shifts', methods=['GET', 'POST'])
@jwt_required(optional=True)
def handle_shifts():
    if request.method == 'POST':
        if not current_user: return jsonify({"error": "Authentication required"}), 401
        if current_user.access_role != AccessRole.SUPERVISOR:
            return jsonify({"error": "Permission denied: Only supervisors can create shifts"}), 403

        data = request.get_json()
        # Allow employee_id to be nullable/optional for creating unassigned shifts
        required_fields = ['start_time', 'end_time']
        if not all(field in data for field in required_fields):
            missing = [f for f in required_fields if f not in data]
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        try:
            start_time_obj = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
            end_time_obj = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))

            employee_id_val = data.get('employee_id') # Get employee_id or None
            if employee_id_val and not db.session.get(Employee, employee_id_val):
                 return jsonify({"error": f"Employee with ID {employee_id_val} not found"}), 404

            new_shift = Shift(
                employee_id=employee_id_val,
                start_time=start_time_obj,
                end_time=end_time_obj,
                notes=data.get('notes'),
                cell_text=data.get('cell_text')
            )
            db.session.add(new_shift)
            db.session.commit()
            app.logger.info(f"Shift created (Employee ID: {employee_id_val}) by {current_user.email}")
            return jsonify(new_shift.to_dict()), 201
        except ValueError as e:
            db.session.rollback()
            app.logger.error(f"ValueError creating shift: {e}")
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error creating shift: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'GET':
        # --- Get Shifts Logic ---
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)

        if not year or not month:
            return jsonify({"error": "Year and month query parameters are required"}), 400
        if not (1 <= month <= 12):
             return jsonify({"error": "Invalid month parameter"}), 400

        try:
            # Define start and end of month as aware UTC datetimes for consistent filtering
            start_of_month = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                # Use timedelta to avoid issues with year rollover and different month lengths
                end_of_month = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end_of_month = datetime(year, month + 1, 1, tzinfo=timezone.utc)

            # Filter shifts based on the aware UTC range
            # Ensures that the start time falls within the requested month
            shifts_in_month = Shift.query.filter(
                Shift.start_time >= start_of_month,
                Shift.start_time < end_of_month
            ).options(db.joinedload(Shift.employee)).order_by(Shift.start_time).all() # Eager load employee

            app.logger.info(f"Fetched {len(shifts_in_month)} shifts for {year}-{month:02d}")
            return jsonify([shift.to_dict() for shift in shifts_in_month]), 200

        except Exception as e:
            app.logger.error(f"Error fetching shifts for {year}-{month}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error fetching shifts"}), 500


@app.route('/api/shifts/<int:shift_id>', methods=['PUT', 'DELETE'])
@jwt_required()
def handle_shift(shift_id):
    shift = db.session.get(Shift, shift_id)
    if not shift:
        return jsonify({"error": f"Shift with ID {shift_id} not found."}), 404

    # Check permissions (Only Supervisors can modify/delete)
    if current_user.access_role != AccessRole.SUPERVISOR:
        return jsonify({"error": "Permission denied: Only supervisors can modify or delete shifts"}), 403

    if request.method == 'PUT':
        # --- Update Shift Logic ---
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid input"}), 400

        try:
            updated = False # Track if changes occurred
            if 'employee_id' in data:
                 new_emp_id = data.get('employee_id') # Allow setting to null
                 if new_emp_id and not db.session.get(Employee, new_emp_id): # Check only if not null
                     return jsonify({"error": f"Employee with ID {new_emp_id} not found"}), 404
                 if shift.employee_id != new_emp_id:
                      shift.employee_id = new_emp_id
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
                new_notes = data.get('notes')
                if shift.notes != new_notes:
                     shift.notes = new_notes
                     updated = True
            if 'cell_text' in data:
                new_cell_text = data.get('cell_text')
                if shift.cell_text != new_cell_text:
                     shift.cell_text = new_cell_text
                     updated = True

            # --- Commit if changes were made ---
            if updated:
                 # Validator runs automatically before commit
                 # shift.updated_at = datetime.now(timezone.utc) # Handled by onupdate
                 db.session.commit()
                 app.logger.info(f"Shift {shift_id} updated by {current_user.email}")
            else:
                 app.logger.info(f"Shift {shift_id} update requested by {current_user.email}, but no changes detected.")

            return jsonify(shift.to_dict()), 200
        except ValueError as e: # Catches validation errors (end_time, format)
            db.session.rollback()
            app.logger.error(f"ValueError updating shift {shift_id}: {e}")
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error updating shift {shift_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'DELETE':
        # --- Delete Shift Logic ---
        try:
            db.session.delete(shift)
            db.session.commit()
            app.logger.info(f"Shift {shift_id} deleted by {current_user.email}")
            return jsonify({"message": f"Shift with ID {shift_id} deleted successfully."}), 200
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting shift {shift_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500
# --- End Shift API Routes ---


# --- RAG Helper Functions (Basic Examples - Needs Improvement!) ---
def parse_date_from_query(text):
    """
    Very basic date parser. Looks for Month Day (e.g., March 1st, April 15).
    Returns a date object or None. Needs significant improvement for real use.
    """
    # Try formats like "March 1", "March 1st", "Jan 22nd"
    # More robust parsing needed for "today", "tomorrow", "next Tuesday", "last week" etc.
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
            app.logger.warning(f"Date parsing failed for '{month_str} {day_str}': {e}")
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
        # You might need to map this to a specific time range or a 'shift_type' column value
        return "Morning"
    elif "evening" in text_lower or "pm shift" in text_lower or "afternoon" in text_lower:
        return "Evening"
    elif "night" in text_lower or "overnight" in text_lower:
        return "Night"
    # Add other shift types you use
    return None

def get_shifts_for_context(target_date, target_shift_type=None):
    """
    Queries the database for shifts based on extracted date and optional type.
    Returns a formatted string context or an error message.
    """
    if not target_date:
        return "No specific date identified in the query."

    context = f"No shifts found for {target_date.strftime('%B %d, %Y')}{f' matching type {target_shift_type}' if target_shift_type else ''}." # Default context

    try:
        # --- Database Query ---
        # Filter by the exact date
        start_of_day = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
        end_of_day = start_of_day + timedelta(days=1)

        query_builder = Shift.query.filter(
            Shift.start_time >= start_of_day,
            Shift.start_time < end_of_day
        )

        # --- Filter by Shift Type (Example - Adapt this logic!) ---
        if target_shift_type:
            # Option A: If you have a shift_type column:
            # query_builder = query_builder.filter(Shift.shift_type == target_shift_type)

            # Option B: Filter by time range (adjust times as needed)
            if target_shift_type == "Morning":
                 # Example: Shifts starting between 5 AM and 12 PM (noon) on the target date
                 morning_start = start_of_day.replace(hour=5)
                 morning_end = start_of_day.replace(hour=12)
                 query_builder = query_builder.filter(Shift.start_time >= morning_start, Shift.start_time < morning_end)
            elif target_shift_type == "Evening":
                 # Example: Shifts starting between 4 PM (16:00) and 9 PM (21:00)
                 evening_start = start_of_day.replace(hour=16)
                 evening_end = start_of_day.replace(hour=21)
                 query_builder = query_builder.filter(Shift.start_time >= evening_start, Shift.start_time < evening_end)
            elif target_shift_type == "Night":
                 # Example: Shifts starting between 9 PM (21:00) and 5 AM the *next* day
                 # This requires careful handling of date boundaries
                 night_start = start_of_day.replace(hour=21)
                 # Night shifts might span across midnight, query needs adjustment if looking for shifts *ending* on target_date
                 # Simplification: only look for shifts starting >= 9pm on the target date
                 query_builder = query_builder.filter(Shift.start_time >= night_start)
            # Add logic for other shift types
        # --- End Shift Type Filter ---

        # Eager load employee data and order
        relevant_shifts = query_builder.join(Employee).options(db.joinedload(Shift.employee)).order_by(Shift.start_time).all()
        # --- End Database Query ---

        if relevant_shifts:
            # Format the retrieved data for the LLM context
            context_lines = [f"Context: Schedule Information for {target_date.strftime('%B %d, %Y')}{f' ({target_shift_type} shifts)' if target_shift_type else ''}:"]
            for shift in relevant_shifts:
                # Ensure start/end times are formatted in a readable way (e.g., local time if needed, but UTC is safer)
                # For simplicity, using ISO format or basic time format. Adjust as needed.
                emp_name = shift.employee.name if shift.employee else "Unassigned"
                start_str = shift.start_time.strftime('%I:%M %p %Z') # Example: 09:00 AM UTC
                end_str = shift.end_time.strftime('%I:%M %p %Z')   # Example: 05:00 PM UTC
                context_lines.append(f"- {emp_name} scheduled from {start_str} to {end_str}.")
            context = "\n".join(context_lines)
        # else: context remains the "No shifts found..." message

    except Exception as db_err:
        app.logger.error(f"Database query error for context: {db_err}", exc_info=True)
        context = "Error retrieving schedule data from the database."

    return context
# --- End RAG Helper Functions ---


# --- Ollama API Routes ---

@app.route('/api/ollama/models', methods=['GET'])
@jwt_required()
def get_ollama_models():
    """Get available models from Ollama"""
    try:
        api_endpoint = f"{OLLAMA_API_URL}/tags"
        app.logger.info(f"Requesting models from Ollama: {api_endpoint}")
        response = requests.get(api_endpoint, timeout=10) # Add timeout
        response.raise_for_status()
        models_data = response.json()
        models = models_data.get('models', [])
        app.logger.info(f"Successfully retrieved {len(models)} models from Ollama.")
        return jsonify(models), 200
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Error connecting to Ollama at {OLLAMA_API_URL}: {str(e)}", exc_info=True)
        return jsonify({'error': f"Error connecting to Ollama: {str(e)}"}), 503
    except Exception as e:
        app.logger.error(f"Unexpected error getting Ollama models: {str(e)}", exc_info=True)
        return jsonify({'error': f"An unexpected error occurred: {str(e)}"}), 500


@app.route('/api/ollama/query', methods=['POST'])
@jwt_required()
def query_ollama():
    """
    Handles user queries, performs RAG to fetch context, sends augmented
    prompt to Ollama, and stores the interaction.
    """
    data = request.get_json()
    if not data or not data.get('query'):
        return jsonify({'error': 'Missing query in request'}), 400

    user_query = data['query']
    employee_id = current_user.id
    model_to_use = data.get('model', DEFAULT_MODEL) # Allow overriding default model

    app.logger.info(f"Received Ollama query from user {current_user.email}: '{user_query}'")

    # --- RAG Implementation ---
    # 1. Analyze Intent & Extract Entities (Using basic helpers)
    target_date = parse_date_from_query(user_query)
    target_shift_type = parse_shift_type_from_query(user_query)
    app.logger.info(f"Parsed entities: Date={target_date}, ShiftType={target_shift_type}")

    # 2. Retrieve Relevant Data from DB
    context = get_shifts_for_context(target_date, target_shift_type)
    app.logger.info(f"Generated Context: {context[:200]}...") # Log start of context

    # 3. Construct Augmented Prompt
    # Refine this prompt based on experimentation!
    system_prompt = "You are a helpful scheduling assistant. Your goal is to answer the user's question about the work schedule based *only* on the provided context. Do not make assumptions or use external knowledge. If the context does not contain the answer, clearly state that the information is not available in the provided schedule data."
    augmented_prompt = f"{system_prompt}\n\n{context}\n\nUser Question: {user_query}\n\nAnswer:"

    # --- End RAG Implementation ---


    # 4. Call Ollama API with Augmented Prompt
    try:
        ollama_payload = {
            "model": model_to_use,
            "prompt": augmented_prompt, # Send the full prompt with context
            "stream": False,
            # Optional: Some models might benefit from a separate system prompt field
            # "system": system_prompt
        }

        api_endpoint = f"{OLLAMA_API_URL}/generate"
        app.logger.info(f"Sending augmented query to Ollama: model={model_to_use}, user={current_user.email}")
        # Increased timeout for potentially longer RAG processing
        response = requests.post(api_endpoint, json=ollama_payload, timeout=90)
        response.raise_for_status()

        ollama_response = response.json()
        ai_response_text = ollama_response.get('response', '').strip()

        if not ai_response_text:
             app.logger.warning(f"Ollama returned an empty response for augmented query from user {current_user.email}")
             ai_response_text = "The assistant did not provide a response." # Provide a default

        app.logger.info(f"Received Ollama response for user {current_user.email}: '{ai_response_text[:100]}...'")

    except requests.exceptions.Timeout:
        app.logger.error(f"Ollama API request timed out for user {current_user.email}", exc_info=True)
        return jsonify({'error': "The request to the AI assistant timed out."}), 504 # Gateway Timeout
    except requests.exceptions.RequestException as e:
        app.logger.error(f"Ollama API request failed: {str(e)}", exc_info=True)
        error_detail = str(e)
        if e.response is not None:
            try: error_detail = e.response.json().get('error', error_detail)
            except ValueError: error_detail = e.response.text
        return jsonify({'error': f"Ollama API error: {error_detail}"}), 502
    except Exception as e: # Catch other potential errors
        app.logger.error(f"Unexpected error during Ollama call: {str(e)}", exc_info=True)
        return jsonify({'error': f"An unexpected error occurred while contacting the AI assistant."}), 500


    # 5. Store Original Query and Final AI Response
    try:
        new_query_log = OllamaQuery(
            employee_id=employee_id,
            query=user_query, # Store the original user query
            # prompt_sent=augmented_prompt, # Optionally store the full prompt sent
            response=ai_response_text, # Store the final AI response
            model_used=model_to_use
        )
        db.session.add(new_query_log)
        db.session.commit()
        app.logger.info(f"Stored Ollama interaction log ID: {new_query_log.id} for user {current_user.email}")

    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Database logging error for Ollama query: {str(e)}", exc_info=True)
        # Log the error but still return the response to the user
        # Decide if this should be a 500 error or just a warning


    # 6. Return AI Response to Frontend
    return jsonify({
        # 'query': user_query, # Return original query if needed by frontend
        'response': ai_response_text,
        # 'model': model_to_use,
        # 'query_id': new_query_log.id # Return log ID if needed
    }), 200


@app.route('/api/ollama/history', methods=['GET'])
@jwt_required()
def get_ollama_history():
    """Get the Ollama query history for the current user"""
    try:
        queries = OllamaQuery.query.filter_by(employee_id=current_user.id).order_by(OllamaQuery.created_at.desc()).all()
        app.logger.info(f"Fetched {len(queries)} Ollama history entries for user {current_user.email}")
        return jsonify([query.to_dict() for query in queries]), 200
    except Exception as e:
        app.logger.error(f"Error fetching Ollama history for user {current_user.email}: {str(e)}", exc_info=True)
        return jsonify({'error': f"Error fetching Ollama history: {str(e)}"}), 500


@app.route('/api/ollama/history/<int:query_id>', methods=['DELETE'])
@jwt_required()
def delete_ollama_query(query_id):
    """Delete a specific Ollama query from history"""
    query = db.get_or_404(OllamaQuery, query_id, description=f"Ollama query with ID {query_id} not found.")

    if query.employee_id != current_user.id and current_user.access_role != AccessRole.SUPERVISOR:
        app.logger.warning(f"User {current_user.email} (Role: {current_user.access_role.value}) attempted to delete query {query_id} belonging to user ID {query.employee_id}")
        return jsonify({'error': 'Permission denied: Cannot delete this query'}), 403

    try:
        db.session.delete(query)
        db.session.commit()
        app.logger.info(f"Deleted Ollama query {query_id} by user {current_user.email}")
        # --- Continuing from here ---
        return jsonify({'message': 'Query deleted from history'}), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting Ollama query {query_id}: {str(e)}", exc_info=True)
        return jsonify({'error': f"Error deleting query: {str(e)}"}), 500
# --- End Ollama API Routes ---


# --- Main Execution Block ---
if __name__ == '__main__':
    # Consider environment variables for host/port/debug
    # Default to False if FLASK_DEBUG is not set or not 'true'/'1'/'t'
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() in ['true', '1', 't']
    # Default to port 5000 if PORT environment variable is not set
    port = int(os.getenv('PORT', 5000))
    # Default to '0.0.0.0' to listen on all available network interfaces
    host = os.getenv('HOST', '0.0.0.0')

    app.logger.info(f"Starting Flask server on {host}:{port} (Debug: {debug_mode})")
    # Run the Flask development server
    # Note: For production, use a production-ready WSGI server like Gunicorn or Waitress
    app.run(debug=debug_mode, host=host, port=port)
        