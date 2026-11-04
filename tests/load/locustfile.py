"""
SilentSOS Web Application Load & Performance Testing Suite (Locust).
Simulates concurrent civilian users, emergency distress triggers, and administrative responders.
"""

from locust import HttpUser, task, between
import json
import random

class SilentSosWebUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        # Obtain CSRF token or session token
        res = self.client.get("/api/auth/csrf-token")
        if res.status_code == 200:
            self.csrf_token = res.json().get("csrfToken", "")
        else:
            self.csrf_token = ""

    @task(5)
    def load_homepage_and_assets(self):
        self.client.get("/")

    @task(3)
    def query_ai_assistant(self):
        payload = {
            "message": random.choice([
                "What should I do if someone is following me?",
                "How does Stealth Mode work in SilentSOS?",
                "How can I stay safe when travelling alone?",
                "What about travelling at night?",
                "CPR first aid chest compressions guidance"
            ]),
            "history": []
        }
        self.client.post("/api/ai/chat", json=payload)

    @task(2)
    def query_contacts(self):
        self.client.get("/api/contacts")

    @task(1)
    def trigger_emergency_alert(self):
        payload = {
            "type": random.choice(["Immediate Crisis", "Medical", "Danger", "Fire", "Police"]),
            "location": {
                "lat": 13.0827 + random.uniform(-0.01, 0.01),
                "lng": 80.2707 + random.uniform(-0.01, 0.01),
                "address": "Locust Load Test Waypoint"
            }
        }
        res = self.client.post("/api/alerts", json=payload)
        if res.status_code == 200:
            alert_id = res.json().get("id")
            if alert_id:
                # Complete alert
                self.client.post(f"/api/alerts/{alert_id}/complete", json={})

    @task(2)
    def check_receiver_portal(self):
        self.client.get("/receiver/test-alert-id")

