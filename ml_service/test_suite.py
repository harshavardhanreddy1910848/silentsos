"""
SilentSOS ML Microservice - Automated Verification Test Suite
Tests:
1. Direct Model Loading
2. Missing Model Directory Handling
3. GET /health
4. Single Prediction for each of the 4 models
5. Empty input validation
6. Invalid input validation
7. Excessively long input validation (> 2000 chars)
8. Live Uvicorn socket binding on 127.0.0.1:5001
"""

import json
import os
import subprocess
import time
import urllib.request
from fastapi.testclient import TestClient

from ml_service.config import HOST, PORT
from ml_service.model_loader import ModelManager, manager
from ml_service.server import app

client = TestClient(app)


def test_model_loading():
    print("\n--- TEST 1: Model Loading Operations ---")
    manager.load_all_models()
    status = manager.load_status
    for name, is_loaded in status.items():
        print(f"Model [{name}]: {'LOADED ✓' if is_loaded else 'FAILED ✗'}")
        assert is_loaded, f"Model {name} failed to load."
    print("All 4 models loaded successfully!")


def test_missing_model_file():
    print("\n--- TEST 2: Missing Model File Handling ---")
    fake_manager = ModelManager(models_dir=r"H:\NonExistent_Dir_For_Testing\models")
    status = fake_manager.load_all_models()
    print("Missing directory load status:", status)
    assert not any(status.values()), "Fake directory should have reported no models loaded."
    print("Handled missing directory cleanly with zero crashes ✓")


def test_health_endpoint():
    print("\n--- TEST 3: GET /health ---")
    response = client.get("/health")
    print("Status Code:", response.status_code)
    data = response.json()
    print("Health Data:", json.dumps(data, indent=2))
    assert response.status_code == 200
    assert data["status"] == "healthy"
    assert data["all_models_ready"] is True
    assert data["host"] == "127.0.0.1"
    assert data["port"] == 5001


def test_predictions():
    print("\n--- TEST 4: Prediction Endpoints ---")

    # 1. Harassment Binary
    res = client.post("/predict/harassment", json={"text": "A strange person has been following my car for 3 miles"})
    print("POST /predict/harassment:", res.status_code)
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert "is_harassment" in data
    assert "confidence" in data
    assert "disclaimer" in data

    # 2. Harassment Multilabel
    res = client.post("/predict/harassment_multilabel", json={"text": "He kept making vulgar sexual comments on the subway"})
    print("\nPOST /predict/harassment_multilabel:", res.status_code)
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert "categories" in data
    assert "category_probabilities" in data

    # 3. Crisis Risk & Severity
    res = client.post("/predict/crisis_risk", json={"text": "My ex-partner is threatening to leak private photos and break my windows"})
    print("\nPOST /predict/crisis_risk:", res.status_code)
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert "risk_type" in data
    assert "severity" in data
    assert "CRITICAL SAFETY WARNING" in data["disclaimer"]

    # 4. Symptoms
    res = client.post("/predict/symptoms", json={"text": "I have continuous high fever, joint pain, rash, and intense headache"})
    print("\nPOST /predict/symptoms:", res.status_code)
    data = res.json()
    print("Response:", json.dumps(data, indent=2))
    assert res.status_code == 200
    assert "predicted_condition" in data
    assert "top_differential_diagnoses" in data
    assert "EDUCATIONAL USE ONLY" in data["disclaimer"]


def test_input_validations():
    print("\n--- TEST 5: Input Validation & Edge Cases ---")

    # A. Empty string
    res = client.post("/predict/harassment", json={"text": ""})
    print("Empty text test HTTP status:", res.status_code)
    assert res.status_code == 422, "Empty string should return HTTP 422"

    # B. Pure whitespace
    res = client.post("/predict/harassment", json={"text": "     "})
    print("Whitespace text test HTTP status:", res.status_code)
    assert res.status_code == 422, "Whitespace-only string should return HTTP 422"

    # C. Missing 'text' key
    res = client.post("/predict/harassment", json={})
    print("Missing key test HTTP status:", res.status_code)
    assert res.status_code == 422, "Missing key should return HTTP 422"

    # D. Non-string type
    res = client.post("/predict/harassment", json={"text": 123456})
    print("Non-string test HTTP status:", res.status_code)
    assert res.status_code == 422, "Non-string input should return HTTP 422"

    # E. Excessively long input (> 2000 characters)
    huge_text = "danger " * 350  # ~2450 chars
    print(f"Testing excessively long text ({len(huge_text)} chars)...")
    res = client.post("/predict/harassment", json={"text": huge_text})
    print("Excessively long text HTTP status:", res.status_code)
    assert res.status_code == 422, "Text > 2000 chars should return HTTP 422"

    print("All validation edge cases rejected safely ✓")


def test_live_server_lifecycle():
    print("\n--- TEST 6: Live Server Socket Binding & Shutdown ---")
    proc = subprocess.Popen(
        ["python", "-m", "ml_service.server"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    print("Started background live server process (PID:", proc.pid, ")")

    try:
        # Wait up to 10 seconds for server to bind
        url = f"http://{HOST}:{PORT}/health"
        bound = False
        for attempt in range(15):
            time.sleep(0.8)
            try:
                with urllib.request.urlopen(url, timeout=2) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode())
                        print("Live server responded on socket:", url)
                        print("Live Health Payload:", json.dumps(data))
                        bound = True
                        break
            except Exception:
                continue

        assert bound, f"Server failed to bind to {url} within timeout."
        print(f"Confirmed server listening exclusively on {HOST}:{PORT} ✓")

    finally:
        print("Shutting down live server...")
        proc.terminate()
        try:
            proc.wait(timeout=5)
            print("Server shut down cleanly ✓")
        except Exception:
            proc.kill()
            print("Server process killed ✓")


if __name__ == "__main__":
    print("====================================================")
    print("   SilentSOS ML Microservice Test Suite Running     ")
    print("====================================================")
    test_model_loading()
    test_missing_model_file()
    test_health_endpoint()
    test_predictions()
    test_input_validations()
    test_live_server_lifecycle()
    print("\n====================================================")
    print("   ALL TESTS PASSED WITH ZERO ERRORS (100% OK)      ")
    print("====================================================")
