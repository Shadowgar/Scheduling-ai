from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime, timezone, timedelta
from models import Shift, Employee, AccessRole, db
from sqlalchemy.orm import joinedload

shift_bp = Blueprint('shift', __name__)

@shift_bp.route('/api/shifts', methods=['GET', 'POST'])
@jwt_required(optional=True)
def handle_shifts():
    if request.method == 'POST':
        if not current_user: 
            return jsonify({"error": "Authentication required"}), 401
        if current_user.access_role != AccessRole.SUPERVISOR:
            return jsonify({"error": "Permission denied: Only supervisors can create shifts"}), 403

        data = request.get_json()
        required_fields = ['start_time', 'end_time']
        if not all(field in data for field in required_fields):
            missing = [f for f in required_fields if f not in data]
            return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

        try:
            start_time_obj = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
            end_time_obj = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))

            employee_id_val = data.get('employee_id')
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
            current_app.logger.info(f"Shift created (Employee ID: {employee_id_val}) by {current_user.email}")
            return jsonify(new_shift.to_dict()), 201
        except ValueError as e:
            db.session.rollback()
            current_app.logger.error(f"ValueError creating shift: {e}")
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error creating shift: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'GET':
        year = request.args.get('year', type=int)
        month = request.args.get('month', type=int)

        if not year or not month:
            return jsonify({"error": "Year and month query parameters are required"}), 400
        if not (1 <= month <= 12):
             return jsonify({"error": "Invalid month parameter"}), 400

        try:
            start_of_month = datetime(year, month, 1, tzinfo=timezone.utc)
            if month == 12:
                end_of_month = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
            else:
                end_of_month = datetime(year, month + 1, 1, tzinfo=timezone.utc)

            shifts_in_month = Shift.query.filter(
                Shift.start_time >= start_of_month,
                Shift.start_time < end_of_month
            ).options(joinedload(Shift.employee)).order_by(Shift.start_time).all()

            current_app.logger.info(f"Fetched {len(shifts_in_month)} shifts for {year}-{month:02d}")
            return jsonify([shift.to_dict() for shift in shifts_in_month]), 200

        except Exception as e:
            current_app.logger.error(f"Error fetching shifts for {year}-{month}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error fetching shifts"}), 500

@shift_bp.route('/api/shifts/<int:shift_id>', methods=['PUT', 'DELETE'])
@jwt_required()
def handle_shift(shift_id):
    shift = db.session.get(Shift, shift_id)
    if not shift:
        return jsonify({"error": f"Shift with ID {shift_id} not found."}), 404

    # Check permissions (Only Supervisors can modify/delete)
    if current_user.access_role != AccessRole.SUPERVISOR:
        return jsonify({"error": "Permission denied: Only supervisors can modify or delete shifts"}), 403

    if request.method == 'PUT':
        data = request.get_json()
        if not data: return jsonify({"error": "Invalid input"}), 400

        try:
            updated = False
            if 'employee_id' in data:
                 new_emp_id = data.get('employee_id')
                 if new_emp_id and not db.session.get(Employee, new_emp_id):
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

            if updated:
                db.session.commit()
                current_app.logger.info(f"Shift {shift_id} updated by {current_user.email}")
            else:
                current_app.logger.info(f"Shift {shift_id} update requested by {current_user.email}, but no changes detected.")

            return jsonify(shift.to_dict()), 200
        except ValueError as e:
            db.session.rollback()
            current_app.logger.error(f"ValueError updating shift {shift_id}: {e}")
            return jsonify({"error": f"Invalid data format or value: {e}"}), 400
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating shift {shift_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500

    elif request.method == 'DELETE':
        try:
            db.session.delete(shift)
            db.session.commit()
            current_app.logger.info(f"Shift {shift_id} deleted by {current_user.email}")
            return jsonify({"message": f"Shift with ID {shift_id} deleted successfully."}), 200
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error deleting shift {shift_id}: {e}", exc_info=True)
            return jsonify({"error": "Internal server error"}), 500
