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

def test_prompt_augmentation_includes_contexts(monkeypatch, client):
    """
    Test that the prompt sent to the AI model includes both schedule and policy context.
    """
    captured_prompt = {}

    # Mock policy search API call
    def mock_policy_post(url, json, headers=None, timeout=10):
        class MockPolicyResponse:
            def raise_for_status(self):
                pass
            def json(self):
                return {
                    "results": [
                        {"text": "Policy: Officers must have 8 hours between shifts."},
                        {"text": "Policy: No overtime beyond 12 hours per day."}
                    ]
                }
        return MockPolicyResponse()

    # Mock Ollama API call
    def mock_ollama_post(url, json, timeout=90):
        captured_prompt['prompt'] = json.get("prompt", "")
        class MockOllamaResponse:
            def raise_for_status(self):
                pass
            def json(self):
                return {"response": "AI response using provided context."}
        return MockOllamaResponse()

    import backend.routes.ollama as ollama_module
    monkeypatch.setattr(ollama_module.requests, "post", lambda url, **kwargs: (
        mock_policy_post(url, kwargs.get('json'), headers=kwargs.get('headers')) if "policies/search" in url
        else mock_ollama_post(url, kwargs.get('json'), timeout=kwargs.get('timeout', 90))
    ))

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
    response = client.post("/api/ollama/query", data=json.dumps({"query": "What are the overtime rules for April?"}), headers=headers)
    data = response.get_json()

    assert response.status_code == 200
    assert "response" in data
    # Check that both schedule and policy context are present in the prompt
    prompt = captured_prompt.get('prompt', "")
    assert "=== Schedule Context ===" in prompt
    assert "=== Policy Context ===" in prompt
    assert "Policy: Officers must have 8 hours between shifts." in prompt
    assert "Policy: No overtime beyond 12 hours per day." in prompt

def test_prompt_augmentation_empty_policy_context(monkeypatch, client):
    """
    Edge case: Policy context is empty, but schedule context is present.
    """
    captured_prompt = {}

    # Mock policy search API call (returns empty results)
    def mock_policy_post(url, json, headers=None, timeout=10):
        class MockPolicyResponse:
            def raise_for_status(self):
                pass
            def json(self):
                return {"results": []}
        return MockPolicyResponse()

    # Mock Ollama API call
    def mock_ollama_post(url, json, timeout=90):
        captured_prompt['prompt'] = json.get("prompt", "")
        class MockOllamaResponse:
            def raise_for_status(self):
                pass
            def json(self):
                return {"response": "AI response with empty policy context."}
        return MockOllamaResponse()

    import backend.routes.ollama as ollama_module
    monkeypatch.setattr(ollama_module.requests, "post", lambda url, **kwargs: (
        mock_policy_post(url, kwargs.get('json'), headers=kwargs.get('headers')) if "policies/search" in url
        else mock_ollama_post(url, kwargs.get('json'), timeout=kwargs.get('timeout', 90))
    ))

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
    response = client.post("/api/ollama/query", data=json.dumps({"query": "Show April schedule for Paul Rocco"}), headers=headers)
    data = response.get_json()

    assert response.status_code == 200
    prompt = captured_prompt.get('prompt', "")
    assert "=== Schedule Context ===" in prompt
    assert "=== Policy Context ===" in prompt
    # Policy context section should be empty
    assert "Policy Context ===\n\n" in prompt

def test_prompt_augmentation_policy_search_failure(monkeypatch, client):
    """
    Failure case: Policy search API call fails, schedule context is still included.
    """
    captured_prompt = {}

    # Mock policy search API call (raises exception)
    def mock_policy_post(url, json, headers=None, timeout=10):
        raise Exception("Policy search failed")

    # Mock Ollama API call
    def mock_ollama_post(url, json, timeout=90):
        captured_prompt['prompt'] = json.get("prompt", "")
        class MockOllamaResponse:
            def raise_for_status(self):
                pass
            def json(self):
                return {"response": "AI response with failed policy context."}
        return MockOllamaResponse()

    import backend.routes.ollama as ollama_module
    monkeypatch.setattr(ollama_module.requests, "post", lambda url, **kwargs: (
        mock_policy_post(url, kwargs.get('json'), headers=kwargs.get('headers')) if "policies/search" in url
        else mock_ollama_post(url, kwargs.get('json'), timeout=kwargs.get('timeout', 90))
    ))

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
    response = client.post("/api/ollama/query", data=json.dumps({"query": "Show April schedule for Paul Rocco"}), headers=headers)
    data = response.get_json()

    assert response.status_code == 200
    prompt = captured_prompt.get('prompt', "")
    assert "=== Schedule Context ===" in prompt
    assert "=== Policy Context ===" in prompt
    # Policy context section should be empty due to failure
    assert "Policy Context ===\n\n" in prompt
