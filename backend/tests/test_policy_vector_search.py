import pytest
from flask import Flask
from backend.routes.policy import policy_bp
from backend.models import db, PolicyDocument, PolicyChunk
import io

@pytest.fixture
def client():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['TESTING'] = True
    app.register_blueprint(policy_bp)
    db.init_app(app)

    with app.app_context():
        db.create_all()
        # Add sample policy document and chunk with embedding
        doc = PolicyDocument(
            filename="test.txt",
            file_type="txt",
            uploaded_at=None,
            uploader_id=1,
            content="Test content",
            file_data=None
        )
        db.session.add(doc)
        db.session.flush()

        chunk = PolicyChunk(
            document_id=doc.id,
            chunk_text="Overtime for night shifts is compensated at 1.5x regular rate.",
            embedding=[0.1] * 384,  # Dummy embedding
            created_at=None
        )
        db.session.add(chunk)
        db.session.commit()

    with app.test_client() as client:
        yield client

def test_policy_search_expected(client):
    response = client.post('/api/policies/search', json={
        "query": "overtime night shift",
        "top_k": 3
    }, headers={"Authorization": "Bearer testtoken"})
    assert response.status_code == 200
    data = response.get_json()
    assert "results" in data
    assert isinstance(data["results"], list)

def test_policy_search_empty_query(client):
    response = client.post('/api/policies/search', json={
        "query": "",
        "top_k": 3
    }, headers={"Authorization": "Bearer testtoken"})
    assert response.status_code == 200
    data = response.get_json()
    assert "results" in data

def test_policy_search_invalid_input(client):
    response = client.post('/api/policies/search', data="not json", headers={
        "Authorization": "Bearer testtoken",
        "Content-Type": "application/json"
    })
    # Should return 400 or 500 error
    assert response.status_code in (400, 500)

def test_upload_policy_success(client):
    data = {
        'file': (io.BytesIO(b"Policy chunk one.\n\nPolicy chunk two."), 'policy.txt')
    }
    response = client.post(
        '/api/policies/upload',
        content_type='multipart/form-data',
        data=data,
        headers={"Authorization": "Bearer testtoken"}
    )
    assert response.status_code == 201
    resp_json = response.get_json()
    assert "policy_id" in resp_json

    # Check status and chunk_count
    with client.application.app_context():
        doc = PolicyDocument.query.get(resp_json["policy_id"])
        assert doc is not None
        assert doc.status == "Indexed"
        assert doc.chunk_count == 2
        assert doc.error_message is None

def test_upload_policy_unsupported_filetype(client):
    data = {
        'file': (io.BytesIO(b"Some content"), 'policy.xyz')
    }
    response = client.post(
        '/api/policies/upload',
        content_type='multipart/form-data',
        data=data,
        headers={"Authorization": "Bearer testtoken"}
    )
    # Should still succeed, but with error content
    assert response.status_code == 201 or response.status_code == 500

def test_upload_policy_chunking_error(client, monkeypatch):
    # Simulate error in embed_text
    from backend.routes import policy as policy_module

    def error_embed_text(text):
        raise Exception("Simulated embedding error")

    monkeypatch.setattr(policy_module, "embed_text", error_embed_text)
    data = {
        'file': (io.BytesIO(b"Chunk one.\n\nChunk two."), 'policy.txt')
    }
    response = client.post(
        '/api/policies/upload',
        content_type='multipart/form-data',
        data=data,
        headers={"Authorization": "Bearer testtoken"}
    )
    assert response.status_code == 500
    resp_json = response.get_json()
    assert "error" in resp_json

def test_reindex_policies(client):
    # Upload a document first
    data = {
        'file': (io.BytesIO(b"Chunk one.\n\nChunk two."), 'policy.txt')
    }
    upload_resp = client.post(
        '/api/policies/upload',
        content_type='multipart/form-data',
        data=data,
        headers={"Authorization": "Bearer testtoken"}
    )
    assert upload_resp.status_code == 201
    # Now reindex
    response = client.post(
        '/api/policies/reindex',
        headers={"Authorization": "Bearer testtoken"}
    )
    assert response.status_code == 200
    resp_json = response.get_json()
    assert "message" in resp_json
