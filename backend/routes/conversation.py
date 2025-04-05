from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, current_user
from models import db, Conversation

conversation_bp = Blueprint('conversation', __name__, url_prefix='/api/conversations')

@conversation_bp.route('/', methods=['GET'])
@jwt_required()
def list_conversations():
    try:
        convs = Conversation.query.filter_by(user_id=current_user.id).order_by(Conversation.updated_at.desc()).all()
        return jsonify([c.to_dict() for c in convs]), 200
    except Exception as e:
        current_app.logger.error(f"Error listing conversations: {e}", exc_info=True)
        return jsonify({'error': 'Failed to fetch conversations'}), 500

@conversation_bp.route('/', methods=['POST'])
@jwt_required()
def create_conversation():
    try:
        data = request.get_json()
        title = data.get('title', 'New Chat')
        messages = data.get('messages', [])
        conv = Conversation(user_id=current_user.id, title=title, messages=messages)
        db.session.add(conv)
        db.session.commit()
        return jsonify(conv.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating conversation: {e}", exc_info=True)
        return jsonify({'error': 'Failed to create conversation'}), 500

@conversation_bp.route('/<int:conv_id>', methods=['GET'])
@jwt_required()
def get_conversation(conv_id):
    conv = Conversation.query.get_or_404(conv_id)
    if conv.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify(conv.to_dict()), 200

@conversation_bp.route('/<int:conv_id>', methods=['PUT'])
@jwt_required()
def update_conversation(conv_id):
    conv = Conversation.query.get_or_404(conv_id)
    if conv.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    try:
        data = request.get_json()
        conv.title = data.get('title', conv.title)
        conv.messages = data.get('messages', conv.messages)
        db.session.commit()
        return jsonify(conv.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating conversation: {e}", exc_info=True)
        return jsonify({'error': 'Failed to update conversation'}), 500

@conversation_bp.route('/<int:conv_id>', methods=['DELETE'])
@jwt_required()
def delete_conversation(conv_id):
    conv = Conversation.query.get_or_404(conv_id)
    if conv.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    try:
        db.session.delete(conv)
        db.session.commit()
        return jsonify({'message': 'Conversation deleted'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting conversation: {e}", exc_info=True)
        return jsonify({'error': 'Failed to delete conversation'}), 500
