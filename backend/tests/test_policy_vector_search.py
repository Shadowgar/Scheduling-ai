import pytest
from flask import Flask
from backend.routes.policy import policy_bp
from backend.models import db, PolicyDocument, PolicyChunk
import json

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
