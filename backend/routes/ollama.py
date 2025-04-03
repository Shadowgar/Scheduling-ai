from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, current_user
import requests
from datetime import datetime, timezone
from models import OllamaQuery, db
from utils.rag_helpers import parse_date_from_query, parse_shift_type_from_query, get_shifts_for_context
from config import Config

ollama_bp = Blueprint('ollama', __name__)

@ollama_bp.route('/api/ollama/models', methods=['GET'])
@jwt_required()
def get_ollama_models():
    """Get available models from Ollama"""
    try:
        api_endpoint = f"{Config.OLLAMA_API_URL}/tags"
        current_app.logger.info(f"Requesting models from Ollama: {api_endpoint}")
        response = requests.get(api_endpoint, timeout=10)
        response.raise_for_status()
        models_data = response.json()
        models = models_data.get('models', [])
        current_app.logger.info(f"Successfully retrieved {len(models)} models from Ollama.")
        return jsonify(models), 200
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"Error connecting to Ollama at {Config.OLLAMA_API_URL}: {str(e)}", exc_info=True)
        return jsonify({'error': f"Error connecting to Ollama: {str(e)}"}), 503
    except Exception as e:
        current_app.logger.error(f"Unexpected error getting Ollama models: {str(e)}", exc_info=True)
        return jsonify({'error': f"An unexpected error occurred: {str(e)}"}), 500


@ollama_bp.route('/api/ollama/query', methods=['POST'])
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
    model_to_use = data.get('model', Config.OLLAMA_DEFAULT_MODEL)

    current_app.logger.info(f"Received Ollama query from user {current_user.email}: '{user_query}'")

    # RAG Implementation
    target_date = parse_date_from_query(user_query)
    target_shift_type = parse_shift_type_from_query(user_query)
    current_app.logger.info(f"Parsed entities: Date={target_date}, ShiftType={target_shift_type}")

    context = get_shifts_for_context(target_date, target_shift_type)
    current_app.logger.info(f"Generated Context: {context[:200]}...")

    # Construct Augmented Prompt
    system_prompt = "You are a helpful scheduling assistant. Your goal is to answer the user's question about the work schedule based *only* on the provided context. Do not make assumptions or use external knowledge. If the context does not contain the answer, clearly state that the information is not available in the provided schedule data."
    augmented_prompt = f"{system_prompt}\n\n{context}\n\nUser Question: {user_query}\n\nAnswer:"

    # Call Ollama API with Augmented Prompt
    try:
        ollama_payload = {
            "model": model_to_use,
            "prompt": augmented_prompt,
            "stream": False,
        }

        api_endpoint = f"{Config.OLLAMA_API_URL}/generate"
        current_app.logger.info(f"Sending augmented query to Ollama: model={model_to_use}, user={current_user.email}")
        response = requests.post(api_endpoint, json=ollama_payload, timeout=90)
        response.raise_for_status()

        ollama_response = response.json()
        ai_response_text = ollama_response.get('response', '').strip()

        if not ai_response_text:
             current_app.logger.warning(f"Ollama returned an empty response for augmented query from user {current_user.email}")
             ai_response_text = "The assistant did not provide a response."

        current_app.logger.info(f"Received Ollama response for user {current_user.email}: '{ai_response_text[:100]}...'")

    except requests.exceptions.Timeout:
        current_app.logger.error(f"Ollama API request timed out for user {current_user.email}", exc_info=True)
        return jsonify({'error': "The request to the AI assistant timed out."}), 504
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"Ollama API request failed: {str(e)}", exc_info=True)
        error_detail = str(e)
        if e.response is not None:
            try: error_detail = e.response.json().get('error', error_detail)
            except ValueError: error_detail = e.response.text
        return jsonify({'error': f"Ollama API error: {error_detail}"}), 502
    except Exception as e:
        current_app.logger.error(f"Unexpected error during Ollama call: {str(e)}", exc_info=True)
        return jsonify({'error': f"An unexpected error occurred while contacting the AI assistant."}), 500

    # Store Original Query and Final AI Response
    try:
        new_query_log = OllamaQuery(
            employee_id=employee_id,
            query=user_query,
            response=ai_response_text,
            model_used=model_to_use
        )
        db.session.add(new_query_log)
        db.session.commit()
        current_app.logger.info(f"Stored Ollama interaction log ID: {new_query_log.id} for user {current_user.email}")

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Database logging error for Ollama query: {str(e)}", exc_info=True)

    # Return AI Response to Frontend
    return jsonify({
        'response': ai_response_text,
    }), 200


@ollama_bp.route('/api/ollama/history', methods=['GET'])
@jwt_required()
def get_ollama_history():
    """Get the Ollama query history for the current user"""
    try:
        queries = OllamaQuery.query.filter_by(employee_id=current_user.id).order_by(OllamaQuery.created_at.desc()).all()
        current_app.logger.info(f"Fetched {len(queries)} Ollama history entries for user {current_user.email}")
        return jsonify([query.to_dict() for query in queries]), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching Ollama history for user {current_user.email}: {str(e)}", exc_info=True)
        return jsonify({'error': f"Error fetching Ollama history: {str(e)}"}), 500


@ollama_bp.route('/api/ollama/history/<int:query_id>', methods=['DELETE'])
@jwt_required()
def delete_ollama_query(query_id):
    """Delete a specific Ollama query from history"""
    query = db.get_or_404(OllamaQuery, query_id, description=f"Ollama query with ID {query_id} not found.")

    if query.employee_id != current_user.id and current_user.access_role != AccessRole.SUPERVISOR:
        current_app.logger.warning(f"User {current_user.email} (Role: {current_user.access_role.value}) attempted to delete query {query_id} belonging to user ID {query.employee_id}")
        return jsonify({'error': 'Permission denied: Cannot delete this query'}), 403

    try:
        db.session.delete(query)
        db.session.commit()
        current_app.logger.info(f"Deleted Ollama query {query_id} by user {current_user.email}")
        return jsonify({'message': 'Query deleted from history'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting Ollama query {query_id}: {str(e)}", exc_info=True)
        return jsonify({'error': f"Error deleting query: {str(e)}"}), 500