import pytest
from flask import Flask
from backend.app import app as flask_app
import json

@pytest.fixture
def client():
    flask_app.config['TESTING'] = True
    with flask_app.test_client() as client:
        yield client

def test_ollama_query_extracts_json(monkeypatch, client):
    # Mock the requests.post call inside the endpoint
    def mock_post(url, json, timeout):
        class MockResponse:
            def raise_for_status(self):
                pass
            def json(self):
                return {
                    "response": "Here is the schedule:\n[{'employee': 'Paul Rocco', 'date': '2025-04-01', 'shift_type': 'Afternoon'}]"
                }
        return MockResponse()

    import backend.routes.ollama as ollama_module
    monkeypatch.setattr(ollama_module.requests, "post", mock_post)

    # Prepare headers with dummy JWT
    headers = {
        "Authorization": "Bearer testtoken",
        "Content-Type": "application/json"
    }

    # Mock JWT validation
    monkeypatch.setattr("flask_jwt_extended.view_decorators.verify_jwt_in_request", lambda *a, **k: None)
    monkeypatch.setattr("flask_jwt_extended.view_decorators.get_jwt_identity", lambda: "1")
    monkeypatch.setattr("flask_jwt_extended.view_decorators.current_user", lambda: None)

    # Call the endpoint
    response = client.post("/api/ollama/query", data=json.dumps({"query": "Schedule Paul Rocco afternoons in April"}), headers=headers)
    data = response.get_json()

    assert response.status_code == 200
    assert "response" in data
    assert "schedule_updates" in data
    assert isinstance(data["schedule_updates"], list)
