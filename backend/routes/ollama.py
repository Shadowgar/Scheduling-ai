from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, current_user
import requests
from datetime import datetime, timezone, timedelta
from models import OllamaQuery, db
from utils.rag_helpers import parse_date_from_query, parse_shift_type_from_query, get_shifts_for_context
from config import Config

def build_augmented_prompt(schedule_context: str, policy_context: str, user_query: str) -> str:
    """
    Construct an augmented prompt for the AI model, combining schedule and policy context.

    Args:
        schedule_context (str): Textual context about the current or relevant schedule.
        policy_context (str): Textual context about relevant policies, rules, or regulations.
        user_query (str): The user's original question or instruction.

    Returns:
        str: A formatted prompt string for the AI model.

    The prompt is structured with clear section headers and instructions to ensure the AI
    uses only the provided context and does not hallucinate or make unsupported assumptions.

    # Reason: This function centralizes and standardizes prompt augmentation, making it
    easy to maintain, test, and update as requirements evolve.
    """
    return (
        "You are a helpful scheduling assistant. "
        "Your goal is to answer the user's question about the work schedule and relevant policies, "
        "using ONLY the provided context below. "
        "Do not make assumptions or use external knowledge. "
        "If the context does not contain the answer, clearly state that the information is not available.\n\n"
        "=== Schedule Context ===\n"
        f"{schedule_context}\n\n"
        "=== Policy Context ===\n"
        f"{policy_context}\n\n"
        "User Question:\n"
        f"{user_query}\n\n"
        "Instructions for Schedule Changes:\n"
        "If the supervisor approves a replacement or schedule change, respond with a JSON array containing the schedule update(s) in the following format:\n"
        "[{\"employee\": \"Replacement Name\", \"date\": \"YYYY-MM-DD\", \"shift_type\": \"Morning/Afternoon/Evening/Night\"}]\n"
        "Do not make any changes unless the supervisor explicitly approves. Always ask for confirmation before proceeding.\n\n"
        "Special Instruction: If the user's question is about who is working the most shifts (e.g., 'who is working the most morning shifts this month?'), use the schedule context above to answer directly. Name the employee(s) and the count. If there is a tie, list all top employees.\n\n"
        "You MUST answer using only the JSON data in the '=== Shift Data (JSON) ===' section above. Do not use any names or numbers not present in the JSON. If the answer is not in the JSON, say so.\n\n"
        "Answer:"
    )

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

    # --- NLU Integration ---
    from utils import nlu
    extracted_names = nlu.extract_employee_names(user_query)
    extracted_dates = nlu.extract_dates(user_query)
    extracted_shift_type = nlu.extract_shift_type(user_query)
    extracted_intent = nlu.extract_intent(user_query)
    current_app.logger.info(
        f"NLU: names={extracted_names}, dates={extracted_dates}, shift_type={extracted_shift_type}, intent={extracted_intent}"
    )

    current_app.logger.info(f"Received Ollama query from user {current_user.email}: '{user_query}'")

    # RAG Implementation
    target_date = parse_date_from_query(user_query)
    target_shift_type = parse_shift_type_from_query(user_query)
    year, month = None, None
    from utils.rag_helpers import parse_month_year_from_query
    year, month = parse_month_year_from_query(user_query)
    current_app.logger.info(f"Parsed entities: Date={target_date}, Month={month}, Year={year}, ShiftType={target_shift_type}")

    from utils import rag_helpers
    # Use NLU-extracted values for query routing
    if extracted_intent == "query":
        # Use extracted dates and shift type for lookup
        start_date, end_date = extracted_dates
        if start_date and end_date and extracted_shift_type:
            # If a week range is detected, implement week-based lookup (TODO: enhance extract_dates)
            # For now, use get_shifts_for_context for a single day, or get_shifts_for_month for a month
            if start_date.month == end_date.month and start_date.year == end_date.year and (end_date - start_date).days > 0:
                # Multi-day range in same month: aggregate shifts for each day
                context_lines = []
                for n in range((end_date - start_date).days + 1):
                    day = start_date + timedelta(days=n)
                    context_lines.append(rag_helpers.get_shifts_for_context(day.date(), extracted_shift_type))
                schedule_context = "\n".join(context_lines)
            elif start_date.month == end_date.month and start_date == end_date:
                schedule_context = rag_helpers.get_shifts_for_context(start_date.date(), extracted_shift_type)
            else:
                # Fallback to month view
                schedule_context = rag_helpers.get_shifts_for_month(start_date.year, start_date.month, extracted_shift_type)
        elif extracted_shift_type and year and month:
            schedule_context = rag_helpers.get_shifts_for_month(year, month, extracted_shift_type)
        elif extracted_shift_type and target_date:
            schedule_context = rag_helpers.get_shifts_for_context(target_date, extracted_shift_type)
        else:
            # Fallback to original logic
            if year and month:
                schedule_context = rag_helpers.get_shifts_for_month(year, month, target_shift_type)
            else:
                schedule_context = rag_helpers.get_shifts_for_context(target_date, target_shift_type)
    elif extracted_intent == "replace":
        # Call-off/Replacement workflow
        # 1. Identify the call-off shift
        # 2. Mark as unassigned/call-off (not implemented here, just context for now)
        # 3. Query for available/qualified replacements (stubbed)
        # 4. Format context for AI to recommend and ask for approval

        calloff_name = extracted_names[0] if extracted_names else None
        calloff_date = extracted_dates[0] if extracted_dates and extracted_dates[0] else None
        calloff_shift_type = extracted_shift_type or target_shift_type

        from models import Shift, Employee
        available_replacements = []
        if calloff_name and calloff_date and calloff_shift_type:
            # Find the shift to be replaced
            shift_q = Shift.query.join(Employee).filter(
                Employee.name == calloff_name,
                Shift.start_time >= calloff_date,
                Shift.start_time < calloff_date + timedelta(days=1)
            )
            if calloff_shift_type:
                # Filter by shift type hours
                if calloff_shift_type == "Morning":
                    shift_q = shift_q.filter(Shift.start_time.hour >= 5, Shift.start_time.hour < 12)
                elif calloff_shift_type == "Afternoon":
                    shift_q = shift_q.filter(Shift.start_time.hour >= 12, Shift.start_time.hour < 16)
                elif calloff_shift_type == "Evening":
                    shift_q = shift_q.filter(Shift.start_time.hour >= 16, Shift.start_time.hour < 21)
                elif calloff_shift_type == "Night":
                    shift_q = shift_q.filter(Shift.start_time.hour >= 21)
            calloff_shift = shift_q.first()
            # Find available employees (stub: all employees not already scheduled for that shift)
            all_emps = Employee.query.all()
            scheduled_emps = {calloff_shift.employee.name} if calloff_shift and calloff_shift.employee else set()
            for emp in all_emps:
                if emp.name not in scheduled_emps:
                    available_replacements.append(emp.name)
        # Format context for AI
        schedule_context = (
            f"Call-off detected: {calloff_name} is unavailable for {calloff_shift_type or 'the shift'} on {calloff_date.strftime('%Y-%m-%d') if calloff_date else 'unknown date'}.\n"
            f"Available replacements: {', '.join(available_replacements) if available_replacements else 'None found'}.\n"
            "Suggest the best available replacement and ask the supervisor for approval before making any schedule changes."
        )
    else:
        # Fallback to original logic for other intents
        if year and month:
            schedule_context = rag_helpers.get_shifts_for_month(year, month, target_shift_type)
        else:
            schedule_context = rag_helpers.get_shifts_for_context(target_date, target_shift_type)

    # Call policy search API internally
    try:
        policy_resp = requests.post(
            f"{request.host_url.rstrip('/')}/api/policies/search",
            json={"query": user_query, "top_k": 5},
            headers={"Authorization": request.headers.get("Authorization", "")},
            timeout=10
        )
        policy_resp.raise_for_status()
        policy_results = policy_resp.json().get("results", [])
        policy_context = "\n".join([r["text"] for r in policy_results])
    except Exception as e:
        current_app.logger.error(f"Policy search failed: {e}", exc_info=True)
        policy_context = ""

    current_app.logger.info(f"Generated Schedule Context: {schedule_context[:200]}...")
    current_app.logger.info(f"Generated Policy Context: {policy_context[:200]}...")

    # Construct Augmented Prompt using helper
    augmented_prompt = build_augmented_prompt(schedule_context, policy_context, user_query)

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

    # Try to extract JSON schedule suggestions from AI response
    import json as pyjson
    schedule_updates = []
    try:
        json_start = ai_response_text.find('[')
        json_end = ai_response_text.rfind(']')
        if json_start != -1 and json_end != -1 and json_end > json_start:
            json_str = ai_response_text[json_start:json_end+1]
            schedule_updates = pyjson.loads(json_str)
    except Exception as e:
        current_app.logger.warning(f"Failed to parse AI JSON suggestions: {e}")

    # Apply schedule updates
    def apply_schedule_updates(updates):
        from models import Shift, Employee
        import pytz
        tz = pytz.UTC
        for item in updates:
            try:
                emp_name = item.get('employee')
                date_str = item.get('date')
                shift_type = item.get('shift_type')

                if not emp_name or not date_str or not shift_type:
                    continue

                emp = Employee.query.filter_by(name=emp_name).first()
                if not emp:
                    continue

                date_obj = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=tz)
                start_hour, end_hour = 9, 17  # default

                if shift_type == "Morning":
                    start_hour, end_hour = 5, 12
                elif shift_type == "Afternoon":
                    start_hour, end_hour = 12, 16
                elif shift_type == "Evening":
                    start_hour, end_hour = 16, 21
                elif shift_type == "Night":
                    start_hour, end_hour = 21, 5  # overnight, handle separately

                start_time = date_obj.replace(hour=start_hour, minute=0)
                if shift_type == "Night":
                    end_time = (date_obj + timedelta(days=1)).replace(hour=end_hour, minute=0)
                else:
                    end_time = date_obj.replace(hour=end_hour, minute=0)

                # Check if shift exists
                existing_shift = Shift.query.filter(
                    Shift.employee_id == emp.id,
                    Shift.start_time >= start_time,
                    Shift.start_time < end_time
                ).first()

                if existing_shift:
                    existing_shift.start_time = start_time
                    existing_shift.end_time = end_time
                else:
                    new_shift = Shift(
                        employee_id=emp.id,
                        start_time=start_time,
                        end_time=end_time
                    )
                    db.session.add(new_shift)

            except Exception as e:
                current_app.logger.warning(f"Failed to apply schedule update {item}: {e}")

        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error committing schedule updates: {e}")

    if schedule_updates:
        apply_schedule_updates(schedule_updates)

    # Return AI Response to Frontend
    return jsonify({
        'response': ai_response_text,
        'schedule_updates': schedule_updates
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
