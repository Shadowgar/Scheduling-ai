import os
import requests # --- Added requests import ---
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from dotenv import load_dotenv
# --- Ensure datetime, date, and timezone are imported ---
from datetime import datetime, date, timezone
# --- End datetime imports ---
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
logging.basicConfig(level=logging.INFO)

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

# --- Ollama Configuration ---
OLLAMA_API_URL = os.environ.get('OLLAMA_API_URL', 'http://localhost:11434/api')
DEFAULT_MODEL = os.environ.get('OLLAMA_DEFAULT_MODEL', 'llama3')
# --- End Ollama Configuration ---

# --- Extensions Initialization ---
db = SQLAlchemy(app) # Initialize SQLAlchemy extension
migrate = Migrate(app, db) # Initialize Flask-Migrate extension
jwt = JWTManager(app) # Initialize JWTManager

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
    __tablename__ = 'employees'

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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    shifts = db.relationship('Shift', backref='employee', lazy=True, cascade="all, delete-orphan")
    # --- Added Ollama Relationship ---
    ollama_queries = db.relationship('OllamaQuery', backref='employee', lazy=True, cascade="all, delete-orphan")
    # --- End Added Ollama Relationship ---

    def set_password(self, password):
        if not password:
             raise ValueError("Password cannot be empty")
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash:
            return False
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<Employee {self.id}: {self.name} ({self.job_title} - {self.access_role.value})>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'phone': self.phone,
            'job_title': self.job_title,
            'access_role': self.access_role.value, # Still send lowercase string value
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
    cell_text = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
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

    # --- MODIFIED VALIDATOR ---
    @db.validates('start_time', 'end_time')
    def validate_end_time(self, key, value):
        # Get current start/end times from the instance
        start = self.start_time
        end = self.end_time

        # Get the new value being validated
        new_value = value

        # Temporarily assign the new value to the correct variable for comparison
        if key == 'start_time':
            start = new_value
        elif key == 'end_time':
            end = new_value

        # Ensure both are actual datetime objects before proceeding
        if not isinstance(start, datetime) or not isinstance(end, datetime):
             # If one is None or not a datetime (e.g., during initial creation),
             # skip the comparison logic for now.
             return value # Return the original value being validated

        # --- Make both timezone-aware (UTC) before comparing ---
        # If start time is naive (likely from DB), assume UTC and make aware
        if start.tzinfo is None:
            start_aware_utc = start.replace(tzinfo=timezone.utc)
        else:
            # If already aware, ensure it's converted to UTC
            start_aware_utc = start.astimezone(timezone.utc)

        # If end time is naive, assume UTC and make aware
        if end.tzinfo is None:
            end_aware_utc = end.replace(tzinfo=timezone.utc)
        else:
            # If already aware, ensure it's converted to UTC
            end_aware_utc = end.astimezone(timezone.utc)

        # --- Compare the aware UTC times ---
        if end_aware_utc <= start_aware_utc:
            raise ValueError("End time must be after start time.")

        # Return the original value that was passed in for validation
        return value
    # --- END MODIFIED VALIDATOR ---


# --- Ollama Query Model ---
class OllamaQuery(db.Model):
    __tablename__ = 'ollama_queries'

    id = db.Column(db.Integer, primary_key=True)
    employee_id = db.Column(db.Integer, db.ForeignKey('employees.id'), nullable=False)
    query = db.Column(db.Text, nullable=False)
    response = db.Column(db.Text, nullable=False)
    model_used = db.Column(db.String(50), default=DEFAULT_MODEL) # Use DEFAULT_MODEL as default
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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
        app.logger.info(f"User logged in successfully: {employee.email} (ID: {employee.id})")
        return jsonify(
            access_token=access_token,
            user=employee.to_dict() # Sends 'supervisor' or 'member'
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

# --- Employee API Endpoints ---

@app.route('/api/admin/employees', methods=['GET'])
@jwt_required()
def handle_admin_employees():
    app.logger.info(f"Request received for /api/admin/employees by user: {current_user.email if current_user else 'Unknown'}")
    # Permission Check using lowercase enum member
    if not current_user or current_user.access_role != AccessRole.SUPERVISOR:
        app.logger.warning(f"Permission denied for /api/admin/employees. User: {current_user.email if current_user else 'None'}, Role: {current_user.access_role.value if current_user else 'N/A'}")
        return jsonify({"error": "Permission denied: Only supervisors can access the full employee list"}), 403
    if request.method == 'GET':
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
@jwt_required(optional=True) # Allow GET without JWT for public schedule? Reconsider if needed.
def handle_employees():
    if request.method == 'POST':
        # --- Create Employee Logic ---
        if not current_user:
            app.logger.warning("Attempt to POST /api/employees without authentication.")
            return jsonify({"error": "Authentication required to create employees"}), 401
        if current_user.access_role != AccessRole.SUPERVISOR:
            app.logger.warning(f"Attempt to POST /api/employees by non-supervisor: {current_user.email} (Role: {current_user.access_role.value})")
            return jsonify({"error": "Permission denied: Only supervisors can create employees"}), 403
        data = request.get_json()
        # ... (validation for required fields: password, email, name, job_title, hire_date) ...
        password = data.get('password')
        if not password: return jsonify({"error": "Password is required for new employees"}), 400
        if not data.get('email'): return jsonify({"error": "Email is required"}), 400
        if not data.get('name'): return jsonify({"error": "Name is required"}), 400
        if not data.get('job_title'): return jsonify({"error": "Job title is required"}), 400
        if not data.get('hire_date'): return jsonify({"error": "Hire date is required"}), 400

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
            new_employee.set_password(password)
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
        # --- Get Schedulable Employees Logic ---
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

    # Permission checks
    if request.method == 'GET' and not (is_supervisor or is_self):
         return jsonify({"error": "Permission denied: Cannot view this employee's details"}), 403
    if request.method == 'PUT' and not (is_supervisor or is_self):
         # Allow self-edit for specific fields, deny others
         data = request.get_json()
         allowed_self_edit_fields = ['name', 'email', 'phone', 'password'] # Define fields users can edit for themselves
         for field in data:
             if field not in allowed_self_edit_fields:
                 # Check if the value is actually changing before denying
                 current_value = getattr(employee, field, None)
                 # Simple check: if field exists in data and is not allowed for self-edit, deny
                 # More robust check needed if we want to allow setting to the *same* value
                 app.logger.warning(f"Self-edit attempt denied for field '{field}' by user {current_user.email}")
                 return jsonify({"error": f"Permission denied: Cannot change '{field}' for yourself"}), 403


    if request.method == 'DELETE' and not is_supervisor:
         return jsonify({"error": "Permission denied: Only supervisors can delete employees"}), 403

    if request.method == 'GET':
        return jsonify(employee.to_dict()), 200

    elif request.method == 'PUT':
        # --- Update Employee Logic ---
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid input"}), 400

        # --- Apply Updates ---
        try:
            updated = False # Track if any changes were made

            # Fields anyone can potentially update (if allowed by permission check above)
            if 'name' in data and employee.name != data['name']:
                 employee.name = data['name']
                 updated = True
            if 'email' in data and employee.email != data['email']:
                 if Employee.query.filter(Employee.email == data['email'], Employee.id != employee_id).first():
                     return jsonify({"error": "Email address already registered by another user"}), 409
                 employee.email = data['email']
                 updated = True
            if 'phone' in data and employee.phone != data.get('phone'):
                 employee.phone = data.get('phone')
                 updated = True
            if 'password' in data and data['password']:
                 # Password check is implicit in permission logic, just set it
                 employee.set_password(data['password'])
                 # Setting password always counts as an update for logging/timestamp
                 updated = True # Consider if setting same password should update timestamp

            # Fields only supervisors can change
            if is_supervisor:
                if 'job_title' in data and employee.job_title != data['job_title']:
                    employee.job_title = data['job_title']
                    updated = True
                if 'access_role' in data:
                    try:
                        new_role = AccessRole(data['access_role'])
                        if employee.access_role != new_role:
                             employee.access_role = new_role
                             updated = True
                    except ValueError: return jsonify({"error": f"Invalid access_role value: {data['access_role']}"}), 400
                if 'hire_date' in data:
                     try:
                         new_hire_date = datetime.strptime(data['hire_date'], '%Y-%m-%d').date()
                         if employee.hire_date != new_hire_date:
                              employee.hire_date = new_hire_date
                              updated = True
                     except (ValueError, TypeError): return jsonify({"error": "Invalid hire_date format (YYYY-MM-DD)"}), 400
                if 'end_date' in data:
                    try:
                        new_end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data.get('end_date') else None
                        if employee.end_date != new_end_date:
                             employee.end_date = new_end_date
                             updated = True
                    except (ValueError, TypeError): return jsonify({"error": "Invalid end_date format (YYYY-MM-DD)"}), 400
                if 'status' in data:
                    try:
                        new_status = EmployeeStatus(data['status'])
                        if employee.status != new_status:
                             employee.status = new_status
                             updated = True
                    except ValueError: return jsonify({"error": f"Invalid status value: {data['status']}"}), 400
                if 'seniority_level' in data and employee.seniority_level != data.get('seniority_level'):
                     employee.seniority_level = data.get('seniority_level')
                     updated = True
                if 'max_hours_per_week' in data and employee.max_hours_per_week != data.get('max_hours_per_week'):
                     employee.max_hours_per_week = data.get('max_hours_per_week')
                     updated = True
                if 'min_hours_per_week' in data and employee.min_hours_per_week != data.get('min_hours_per_week'):
                     employee.min_hours_per_week = data.get('min_hours_per_week')
                     updated = True
                if 'show_on_schedule' in data:
                     new_show = str(data['show_on_schedule']).lower() in ['true', '1', 'yes']
                     if employee.show_on_schedule != new_show:
                          employee.show_on_schedule = new_show
                          updated = True

            # --- Commit if changes were made ---
            if updated:
                employee.updated_at = datetime.utcnow()
                db.session.commit()
                app.logger.info(f"Employee {employee_id} updated by {current_user.email}")
            else:
                app.logger.info(f"Employee {employee_id} update request by {current_user.email}, but no changes detected.")

            return jsonify(employee.to_dict()), 200
        except ValueError as e: # Catch potential validation errors within model setters/validators
            db.session.rollback()
            app.logger.error(f"ValueError updating employee {employee_id}: {e}")
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error updating employee {employee_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'DELETE':
        # --- Delete Employee Logic ---
        try:
            email_deleted = employee.email
            db.session.delete(employee)
            db.session.commit()
            app.logger.info(f"Employee {employee_id} ({email_deleted}) deleted by {current_user.email}")
            # Return 200 OK with message instead of 204 for consistency if preferred
            return jsonify({"message": f"Employee with ID {employee_id} deleted successfully."}), 200
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Error deleting employee {employee_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500


# --- Shift API Routes ---
@app.route('/api/shifts', methods=['GET', 'POST'])
@jwt_required(optional=True) # Allow GET without JWT? Consider security.
def handle_shifts():
    if request.method == 'POST':
        # --- Create Shift Logic ---
        if not current_user: return jsonify({"error": "Authentication required"}), 401
        if current_user.access_role != AccessRole.SUPERVISOR:
            return jsonify({"error": "Permission denied: Only supervisors can create shifts"}), 403

        data = request.get_json()
        required_fields = ['employee_id', 'start_time', 'end_time']
        if not all(field in data for field in required_fields):
            missing = [f for f in required_fields if f not in data]
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        try:
            # Parse incoming ISO strings into aware datetime objects
            start_time_obj = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
            end_time_obj = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))

            if data['employee_id'] and not db.session.get(Employee, data['employee_id']): # Check if employee_id is provided and exists
                 return jsonify({"error": f"Employee with ID {data['employee_id']} not found"}), 404

            new_shift = Shift(
                employee_id=data.get('employee_id'), # Allow null employee_id
                start_time=start_time_obj, # Store aware datetime
                end_time=end_time_obj,   # Store aware datetime
                notes=data.get('notes'),
                cell_text=data.get('cell_text') # Get cell_text or None
            )
            # The validator will now correctly compare aware datetimes
            db.session.add(new_shift)
            db.session.commit()
            app.logger.info(f"Shift created (Employee ID: {data.get('employee_id')}) by {current_user.email}")
            return jsonify(new_shift.to_dict()), 201
        except ValueError as e: # Catches validation errors (end_time, format)
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
                end_of_month = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end_of_month = datetime(year, month + 1, 1, tzinfo=timezone.utc)

            # Filter shifts based on the aware UTC range
            # Assumes shift times are stored consistently (ideally as UTC or with timezone)
            shifts_in_month = Shift.query.filter(
                Shift.start_time >= start_of_month,
                Shift.start_time < end_of_month
            ).order_by(Shift.start_time).all()

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
                # Parse incoming string to aware datetime
                new_start = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
                # Compare based on aware times (or convert existing if needed, though validator handles comparison)
                if shift.start_time != new_start: # Direct comparison might work if DB stores TZ
                     shift.start_time = new_start # Let validator handle comparison logic
                     updated = True
            if 'end_time' in data:
                # Parse incoming string to aware datetime
                new_end = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
                if shift.end_time != new_end: # Direct comparison might work if DB stores TZ
                     shift.end_time = new_end # Let validator handle comparison logic
                     updated = True
            if 'notes' in data:
                new_notes = data.get('notes') # Allows setting notes to "" or null/None
                if shift.notes != new_notes:
                     shift.notes = new_notes
                     updated = True
            if 'cell_text' in data:
                new_cell_text = data.get('cell_text') # Allows setting cell_text to "" or null/None
                if shift.cell_text != new_cell_text:
                     shift.cell_text = new_cell_text
                     updated = True

            # --- Commit if changes were made ---
            if updated:
                 # The validator @db.validates('start_time', 'end_time') already checks end > start
                 # It will raise ValueError if the condition isn't met during the commit prep phase
                 shift.updated_at = datetime.utcnow() # Use naive UTC for timestamp
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

# --- Ollama API Routes ---
@app.route('/api/ollama/models', methods=['GET'])
@jwt_required()
def get_ollama_models():
    """Get available models from Ollama"""
    try:
        # Use the configured OLLAMA_API_URL
        api_endpoint = f"{OLLAMA_API_URL}/tags"
        app.logger.info(f"Requesting models from Ollama: {api_endpoint}")
        response = requests.get(api_endpoint)
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

        models_data = response.json()
        models = models_data.get('models', [])
        app.logger.info(f"Successfully retrieved {len(models)} models from Ollama.")
        return jsonify(models), 200

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Error connecting to Ollama at {OLLAMA_API_URL}: {str(e)}", exc_info=True)
        return jsonify({'error': f"Error connecting to Ollama: {str(e)}"}), 503 # Service Unavailable
    except Exception as e:
        app.logger.error(f"Unexpected error getting Ollama models: {str(e)}", exc_info=True)
        return jsonify({'error': f"An unexpected error occurred: {str(e)}"}), 500

@app.route('/api/ollama/query', methods=['POST'])
@jwt_required()
def query_ollama():
    """Send a query to Ollama and store the result"""
    data = request.get_json()

    if not data or not data.get('query'):
        return jsonify({'error': 'Missing query in request'}), 400

    # Use the current user's ID
    employee_id = current_user.id

    # Prepare the query for Ollama
    model = data.get('model', DEFAULT_MODEL)
    query_text = data['query']

    # Call Ollama API
    try:
        ollama_payload = {
            "model": model,
            "prompt": query_text,
            "stream": False # Keep stream false for simple response handling
        }

        api_endpoint = f"{OLLAMA_API_URL}/generate"
        app.logger.info(f"Sending query to Ollama: model={model}, user={current_user.email}, endpoint={api_endpoint}")
        response = requests.post(api_endpoint, json=ollama_payload)
        response.raise_for_status() # Raise HTTPError for bad responses

        # Extract the response
        ollama_response = response.json()
        response_text = ollama_response.get('response', '').strip() # Trim whitespace

        if not response_text:
             app.logger.warning(f"Ollama returned an empty response for query from user {current_user.email}")
             # Decide if empty response is an error or just empty
             # return jsonify({'error': 'Ollama returned an empty response'}), 500

        # Store the query and response
        new_query = OllamaQuery(
            employee_id=employee_id,
            query=query_text,
            response=response_text,
            model_used=model # Store the actual model used for the query
        )

        db.session.add(new_query)
        db.session.commit()
        app.logger.info(f"Stored Ollama query from user {current_user.email}, ID: {new_query.id}")

        return jsonify({
            'query': query_text,
            'response': response_text,
            'model': model,
            'query_id': new_query.id
        }), 200

    except requests.exceptions.RequestException as e:
        app.logger.error(f"Error connecting to Ollama or Ollama API error: {str(e)}", exc_info=True)
        # Try to get more detail from response if available
        error_detail = str(e)
        if e.response is not None:
            try:
                error_detail = e.response.json().get('error', error_detail)
            except ValueError: # Not JSON
                error_detail = e.response.text
        return jsonify({'error': f"Ollama API error: {error_detail}"}), 502 # Bad Gateway or similar
    except Exception as e:
        db.session.rollback() # Rollback DB changes if storing failed
        app.logger.error(f"Error processing Ollama query: {str(e)}", exc_info=True)
        return jsonify({'error': f"Error processing Ollama query: {str(e)}"}), 500

@app.route('/api/ollama/history', methods=['GET'])
@jwt_required()
def get_ollama_history():
    """Get the Ollama query history for the current user"""
    try:
        # Query history only for the currently logged-in user
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
    # Use get_or_404 to automatically handle not found cases
    query = db.get_or_404(OllamaQuery, query_id, description=f"Ollama query with ID {query_id} not found.")

    # Check if the query belongs to the current user OR if the user is a supervisor
    if query.employee_id != current_user.id and current_user.access_role != AccessRole.SUPERVISOR:
        app.logger.warning(f"User {current_user.email} (Role: {current_user.access_role.value}) attempted to delete query {query_id} belonging to user ID {query.employee_id}")
        return jsonify({'error': 'Permission denied: Cannot delete this query'}), 403

    try:
        db.session.delete(query)
        db.session.commit()
        app.logger.info(f"Deleted Ollama query {query_id} by user {current_user.email}")
        return jsonify({'message': 'Query deleted from history'}), 200
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error deleting Ollama query {query_id}: {str(e)}", exc_info=True)
        return jsonify({'error': f"Error deleting query: {str(e)}"}), 500
# --- End Ollama API Routes ---


# --- Main Execution Block ---
if __name__ == '__main__':
    # Consider environment variables for host/port/debug
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() in ['true', '1', 't']
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0') # Listen on all interfaces
    app.logger.info(f"Starting Flask server on {host}:{port} (Debug: {debug_mode})")
    app.run(debug=debug_mode, host=host, port=port)