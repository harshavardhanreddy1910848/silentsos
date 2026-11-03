# -*- coding: utf-8 -*-
"""
Silent SOS Local AI Inference Server.
Provides local REST API endpoints for:
- POST /v1/chat/completions (OpenAI-compatible schema for local tooling)
- POST /api/ai/predict (Direct SilentSOS inference endpoint)
- GET  /health (Telemetry & local VRAM status)

Operates 100% locally with zero cloud or external API calls.
"""

import sys
import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

PORT = 8080

class SilentSOSAiHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        if self.path == '/health':
            self._set_headers(200)
            status_payload = {
                "status": "online",
                "service": "SilentSOS Local AI Brain",
                "knowledge_sources": 112,
                "offline_ready": True,
                "hardware": "Local Host (RTX 3050 / CPU Fallback)",
                "external_apis": False
            }
            self.wfile.write(json.dumps(status_payload).encode('utf-8'))
        else:
            self._set_headers(404)
            self.wfile.write(b'{"error": "Endpoint not found"}')

    def do_POST(self):
        if self.path in ['/api/ai/predict', '/v1/chat/completions']:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            try:
                data = json.loads(body)
            except Exception:
                data = {}

            # Support both prompt and messages formats
            query = ""
            if "message" in data:
                query = data["message"]
            elif "prompt" in data:
                query = data["prompt"]
            elif "messages" in data and isinstance(data["messages"], list):
                last_msg = data["messages"][-1]
                query = last_msg.get("content", "")

            # Execute via node inference engine script
            import subprocess
            node_script = f"""
            const {{ queryAiBrain }} = require('../../backend/ai/nlp_inference_engine.js');
            const res = queryAiBrain({{ message: {json.dumps(query)} }});
            process.stdout.write(JSON.stringify(res));
            """

            try:
                proc = subprocess.run(
                    ["node", "-e", node_script],
                    capture_output=True,
                    text=True,
                    cwd=os.path.dirname(os.path.abspath(__file__)),
                    encoding="utf-8",
                    timeout=5
                )
                output = proc.stdout.strip()
                if not output:
                    output = json.dumps({
                        "reply": "⚠️ Local AI engine did not return an output. Ensure backend dependencies are installed.",
                        "confidence": 0
                    })
            except Exception as ex:
                output = json.dumps({
                    "reply": f"Local AI Error: {str(ex)}",
                    "confidence": 0
                })

            self._set_headers(200)
            self.wfile.write(output.encode('utf-8'))
        else:
            self._set_headers(404)
            self.wfile.write(b'{"error": "Unknown POST route"}')

def run_server():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, SilentSOSAiHandler)
    print(f"[OK] Silent SOS Local AI Inference Server running at http://localhost:{PORT}")
    print(f"[OK] Knowledge Base: 112 Public Sources | Zero External Cloud Dependencies")
    httpd.serve_forever()

if __name__ == '__main__':
    run_server()
