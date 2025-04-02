# backend/routes/ollama_routes.py
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import json
from datetime import datetime
from services.ollama_service import OllamaService
from models import db, Schedule, Employee, OllamaQuery

ollama_bp = Blueprint('ollama', __name__)
ollama_service = OllamaService()

@ollama_bp.route('/query', methods=['POST'])
@jwt_required()
def query_schedule():
    """
    Process a natural language query about the schedule
    """
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or 'query' not in data:
        return jsonify({"error": "Query is required"}), 400
    
    user_query = data['query']
    
    # Get date range if provided
    start_date = None
    end_date = None
    
    if 'start_date' in data and data['start_date']:
        try:
            start_date = datetime.fromisoformat(data['start_date']).date()
        except ValueError:
            return jsonify({"error": "Invalid start_date format. Use ISO format (YYYY-MM-DD)"}), 400
    
    if 'end_date' in data and data['end_date']:
        try:
            end_date = datetime.fromisoformat(data['end_date']).date()
        except ValueError:
            return jsonify({"error": "Invalid end_date format. Use ISO format (YYYY-MM-DD)"}), 400
    
    # Process the query with Ollama
    response = ollama_service.process_schedule_query(
        query=user_query,
        user_id=current_user_id,
        start_date=start_date,
        end_date=end_date
    )
    
    return jsonify(response)

@ollama_bp.route('/suggest-schedule', methods=['POST'])
@jwt_required()
def suggest_schedule():
    """
    Use Ollama to suggest an optimal schedule based on constraints
    """
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or 'constraints' not in data:
        return jsonify({"error": "Constraints are required"}), 400
    
    constraints = data['constraints']
    
    # Process the request with Ollama
    response = ollama_service.suggest_schedule(
        constraints=constraints,
        user_id=current_user_id
    )
    
    return jsonify(response)

@ollama_bp.route('/history', methods=['GET'])
@jwt_required()
def get_query_history():
    """
    Get the history of Ollama queries for the current user
    """
    current_user_id = get_jwt_identity()
    
    # Check if the user is a supervisor (can see all queries)
    user = Employee.query.get(current_user_id)
    
    if user.access_role == 'supervisor':
        # Supervisors can see all queries
        queries = OllamaQuery.query.order_by(OllamaQuery.created_at.desc()).limit(50).all()
    else:
        # Regular employees can only see their own queries
        queries = OllamaQuery.query.filter_by(user_id=current_user_id).order_by(OllamaQuery.created_at.desc()).limit(20).all()
    
    return jsonify({
        "queries": [query.to_dict() for query in queries]
    })
