from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime, timezone
from models import Employee, EmployeeStatus, AccessRole, db

employee_bp = Blueprint('employee', __name__)

@employee_bp.route('/api/admin/employees', methods=['GET'])
@jwt_required()
def handle_admin_employees():
    current_app.logger.info(f"Request received for /api/admin/employees by user: {current_user.email if current_user else 'Unknown'}")
    if not current_user or current_user.access_role != AccessRole.SUPERVISOR:
        current_app.logger.warning(f"Permission denied for /api/admin/employees. User: {current_user.email if current_user else 'None'}, Role: {current_user.access_role.value if current_user else 'N/A'}")
        return jsonify({"error": "Permission denied: Only supervisors can access the full employee list"}), 403
    try:
        admin_employees = Employee.query.filter(
            Employee.status != EmployeeStatus.TERMINATED
        ).order_by(Employee.name).all()
        current_app.logger.info(f"Returning {len(admin_employees)} employees for admin view.")
        return jsonify([employee.to_dict() for employee in admin_employees]), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching admin employees: {e}", exc_info=True)
        return jsonify({"error": "Internal server error fetching admin employees"}), 500

@employee_bp.route('/api/employees', methods=['GET', 'POST'])
@jwt_required(optional=True)
def handle_employees():
    if request.method == 'POST':
        if not current_user:
            current_app.logger.warning("Attempt to POST /api/employees without authentication.")
            return jsonify({"error": "Authentication required to create employees"}), 401
        if current_user.access_role != AccessRole.SUPERVISOR:
            current_app.logger.warning(f"Attempt to POST /api/employees by non-supervisor: {current_user.email} (Role: {current_user.access_role.value})")
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
                show_on_schedule=str(show_on_schedule_val).lower() in ['true', '1', 'yes'],
                preferred_shifts=data.get('preferred_shifts'),
                preferred_days=data.get('preferred_days'),
                days_off=[datetime.strptime(d, '%Y-%m-%d').date() for d in data.get('days_off', [])] if data.get('days_off') else None,
                max_hours=data.get('max_hours'),
                max_shifts_in_a_row=data.get('max_shifts_in_a_row')
            )
            new_employee.set_password(data['password'])
            db.session.add(new_employee)
            db.session.commit()
            current_app.logger.info(f"New employee created: {new_employee.email} (ID: {new_employee.id}) by {current_user.email}")
            return jsonify(new_employee.to_dict()), 201
        except ValueError as e:
            db.session.rollback()
            current_app.logger.error(f"ValueError creating employee: {e}")
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error creating employee: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'GET':
        try:
            schedulable_employees = Employee.query.filter_by(
                show_on_schedule=True,
                status=EmployeeStatus.ACTIVE
            ).order_by(Employee.name).all()
            return jsonify([employee.to_dict() for employee in schedulable_employees]), 200
        except Exception as e:
            current_app.logger.error(f"Error fetching schedulable employees: {e}", exc_info=True)
            return jsonify({"error": "Internal server error fetching schedulable employees"}), 500

@employee_bp.route('/api/employees/<int:employee_id>', methods=['GET', 'PUT', 'DELETE'])
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
                 current_app.logger.warning(f"Self-edit attempt denied for field '{field}' by user {current_user.email}")
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
                if 'preferred_shifts' in data and employee.preferred_shifts != data.get('preferred_shifts'): employee.preferred_shifts = data.get('preferred_shifts'); updated = True
                if 'preferred_days' in data and employee.preferred_days != data.get('preferred_days'): employee.preferred_days = data.get('preferred_days'); updated = True
                if 'days_off' in data:
                    try:
                        new_days_off = [datetime.strptime(d, '%Y-%m-%d').date() for d in data.get('days_off', [])] if data.get('days_off') else None
                        if employee.days_off != new_days_off: employee.days_off = new_days_off; updated = True
                    except (ValueError, TypeError): return jsonify({"error": "Invalid days_off format (YYYY-MM-DD)"}), 400
                if 'max_hours' in data and employee.max_hours != data.get('max_hours'): employee.max_hours = data.get('max_hours'); updated = True
                if 'max_shifts_in_a_row' in data and employee.max_shifts_in_a_row != data.get('max_shifts_in_a_row'): employee.max_shifts_in_a_row = data.get('max_shifts_in_a_row'); updated = True

            if updated:
                db.session.commit()
                current_app.logger.info(f"Employee {employee_id} updated by {current_user.email}")
            else:
                current_app.logger.info(f"Employee {employee_id} update request by {current_user.email}, but no changes detected.")
            return jsonify(employee.to_dict()), 200
        except ValueError as e:
            db.session.rollback()
            current_app.logger.error(f"ValueError updating employee {employee_id}: {e}")
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating employee {employee_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'DELETE':
        try:
            email_deleted = employee.email
            db.session.delete(employee)
            db.session.commit()
            current_app.logger.info(f"Employee {employee_id} ({email_deleted}) deleted by {current_user.email}")
            return jsonify({"message": f"Employee with ID {employee_id} deleted successfully."}), 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error deleting employee {employee_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500