from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, current_user
from models import Employee, db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    employee = Employee.query.filter_by(email=email).first()

    if employee and employee.check_password(password):
        access_token = create_access_token(identity=str(employee.id))
        current_app.logger.info(f"User logged in successfully: {employee.email} (ID: {employee.id})")
        return jsonify(
            access_token=access_token,
            user=employee.to_dict()
        ), 200
    else:
        current_app.logger.warning(f"Failed login attempt for email: {email}")
        return jsonify({"error": "Invalid credentials"}), 401


@auth_bp.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user_info():
    if not current_user:
         current_app.logger.error("get_current_user_info called but current_user is None")
         return jsonify({"error": "User not found for token"}), 404
    return jsonify(user=current_user.to_dict()), 200