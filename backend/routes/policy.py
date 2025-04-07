from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, current_user
from werkzeug.utils import secure_filename
from models import db, PolicyDocument, PolicyChunk
from datetime import datetime, timezone

import os

# Load BGE model once
from transformers import AutoTokenizer, AutoModel
import torch

tokenizer = AutoTokenizer.from_pretrained("BAAI/bge-base-en")
bge_model = AutoModel.from_pretrained("BAAI/bge-base-en")
bge_model.eval()

def embed_text(text):
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
    with torch.no_grad():
        embeddings = bge_model(**inputs).last_hidden_state[:, 0, :]
    return embeddings[0].cpu().tolist()

policy_bp = Blueprint('policy', __name__, url_prefix='/api/policies')

@policy_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_policy():
    """
    Upload a policy document file, extract text, save document and chunks.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in request'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    filename = secure_filename(file.filename)
    file_type = os.path.splitext(filename)[1].lower().strip('.')

    try:
        # Read file content
        file_bytes = file.read()
        text_content = ""

        # Text extraction based on file type
        if file_type == 'txt':
            text_content = file_bytes.decode('utf-8', errors='ignore')

        elif file_type == 'pdf':
            try:
                import io
                import pdfplumber
                with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                    pages = [page.extract_text() or "" for page in pdf.pages]
                    text_content = "\n\n".join(pages)
            except Exception as e:
                current_app.logger.error(f"PDF extraction failed: {e}", exc_info=True)
                text_content = "[Error extracting text from PDF.]"

        elif file_type in ['docx', 'doc']:
            try:
                import io
                from docx import Document
                doc = Document(io.BytesIO(file_bytes))
                paragraphs = [p.text for p in doc.paragraphs]
                text_content = "\n\n".join(paragraphs)
            except Exception as e:
                current_app.logger.error(f"DOCX extraction failed: {e}", exc_info=True)
                text_content = "[Error extracting text from DOCX.]"

        else:
            text_content = "[Unsupported file type for text extraction.]"

        # Save PolicyDocument
        new_doc = PolicyDocument(
            filename=filename,
            file_type=file_type,
            uploaded_at=datetime.now(timezone.utc),
            uploader_id=current_user.id,
            content=text_content,
            file_data=file_bytes
        )
        db.session.add(new_doc)
        db.session.flush()  # Get new_doc.id before commit

        # Chunking: simple split by paragraphs
        paragraphs = [p.strip() for p in text_content.split('\n\n') if p.strip()]
        for para in paragraphs:
            embedding = embed_text(para)
            chunk = PolicyChunk(
                document_id=new_doc.id,
                chunk_text=para,
                embedding=embedding,
                created_at=datetime.now(timezone.utc)
            )
            db.session.add(chunk)

        db.session.commit()

        return jsonify({'message': 'Policy uploaded successfully', 'policy_id': new_doc.id}), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error uploading policy: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to upload policy document'}), 500

@policy_bp.route('/', methods=['GET'])
@jwt_required()
def list_policies():
    """
    List all uploaded policy documents.
    """
    try:
        policies = PolicyDocument.query.order_by(PolicyDocument.uploaded_at.desc()).all()
        return jsonify([p.to_dict() for p in policies]), 200
    except Exception as e:
        current_app.logger.error(f"Error listing policies: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch policies'}), 500

@policy_bp.route('/<int:policy_id>/view', methods=['GET'])
@jwt_required()
def view_policy(policy_id):
    """
    Return the full extracted text of a policy document.
    """
    try:
        policy = PolicyDocument.query.get_or_404(policy_id)
        return (
            policy.content,
            200,
            {'Content-Type': 'text/plain; charset=utf-8'}
        )
    except Exception as e:
        current_app.logger.error(f"Error fetching policy content: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch policy content'}), 500

@policy_bp.route('/<int:policy_id>/file', methods=['GET'])
@jwt_required()
def download_policy_file(policy_id):
    """
    Return the original uploaded file (PDF, DOCX, etc).
    """
    try:
        policy = PolicyDocument.query.get_or_404(policy_id)
        if not policy.file_data:
            return jsonify({'error': 'No original file data available'}), 404

        mime_type = 'application/octet-stream'
        if policy.file_type == 'pdf':
            mime_type = 'application/pdf'
        elif policy.file_type in ['doc', 'docx']:
            mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        elif policy.file_type == 'txt':
            mime_type = 'text/plain; charset=utf-8'

        return (
            policy.file_data,
            200,
            {
                'Content-Type': mime_type,
                'Content-Disposition': f'inline; filename="{policy.filename}"'
            }
        )
    except Exception as e:
        current_app.logger.error(f"Error fetching original policy file: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch original policy file'}), 500

@policy_bp.route('/<int:policy_id>', methods=['DELETE'])
@jwt_required()
def delete_policy(policy_id):
    """
    Delete a policy document and its chunks.
    """
    try:
        policy = PolicyDocument.query.get_or_404(policy_id)
        db.session.delete(policy)
        db.session.commit()
        return jsonify({'message': 'Policy deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting policy: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to delete policy'}), 500


@policy_bp.route('/search', methods=['POST'])
@jwt_required()
def search_policies():
    """
    Vector similarity search over policy chunks using pgvector.
    """
    data = request.get_json()
    query_text = data.get('query', '')
    top_k = data.get('top_k', 5)

    # Generate embedding for query
    query_emb = embed_text(query_text)
    emb_str = str(query_emb).replace('[', '{').replace(']', '}')

    sql = """
        SELECT id, document_id, chunk_text, embedding <#> :query_emb AS score
        FROM policy_chunks
        ORDER BY embedding <#> :query_emb
        LIMIT :top_k
    """

    results = db.session.execute(
        db.text(sql),
        {'query_emb': emb_str, 'top_k': top_k}
    ).fetchall()

    response = []
    for row in results:
        response.append({
            "chunk_id": row.id,
            "document_id": row.document_id,
            "score": 1 - row.score,  # Convert distance to similarity
            "text": row.chunk_text
        })

    return jsonify({"results": response})
