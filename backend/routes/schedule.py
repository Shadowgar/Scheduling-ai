from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, current_user
from models import db, ScheduleSnapshot, Shift, Employee
import pickle

schedule_bp = Blueprint('schedule', __name__, url_prefix='/api/schedule')

@schedule_bp.route('/snapshot', methods=['POST'])
@jwt_required()
def save_snapshot():
    try:
        # Serialize all shifts
        shifts = Shift.query.all()
        data = pickle.dumps([{
            'id': s.id,
            'employee_id': s.employee_id,
            'start_time': s.start_time,
            'end_time': s.end_time,
            'notes': s.notes
        } for s in shifts])

        snap = ScheduleSnapshot(
            created_by=current_user.id,
            description=request.json.get('description', 'Snapshot'),
            data=data
        )
        db.session.add(snap)
        db.session.commit()
        return jsonify({'message': 'Snapshot saved', 'id': snap.id}), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error saving snapshot: {e}", exc_info=True)
        return jsonify({'error': 'Failed to save snapshot'}), 500

@schedule_bp.route('/snapshot/<int:snap_id>/restore', methods=['POST'])
@jwt_required()
def restore_snapshot(snap_id):
    try:
        snap = ScheduleSnapshot.query.get_or_404(snap_id)
        data = pickle.loads(snap.data)

        # Delete all current shifts
        Shift.query.delete()

        # Restore shifts
        for s in data:
            shift = Shift(
                id=s['id'],
                employee_id=s['employee_id'],
                start_time=s['start_time'],
                end_time=s['end_time'],
                notes=s['notes']
            )
            db.session.add(shift)

        db.session.commit()
        return jsonify({'message': 'Schedule restored'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error restoring snapshot: {e}", exc_info=True)
        return jsonify({'error': 'Failed to restore snapshot'}), 500

@schedule_bp.route('/snapshots', methods=['GET'])
@jwt_required()
def list_snapshots():
    try:
        snaps = ScheduleSnapshot.query.order_by(ScheduleSnapshot.created_at.desc()).all()
        return jsonify([{
            'id': s.id,
            'created_at': s.created_at.isoformat(),
            'description': s.description
        } for s in snaps]), 200
    except Exception as e:
        current_app.logger.error(f"Error listing snapshots: {e}", exc_info=True)
        return jsonify({'error': 'Failed to list snapshots'}), 500
