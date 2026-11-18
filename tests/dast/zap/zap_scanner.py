"""
SilentSOS OWASP ZAP & DAST Security Scanner Integration.
Encapsulates OWASP ZAP automated dynamic security scanning policies,
alert threshold evaluation, and CWE / OWASP Top 10 vulnerability mapping.
"""

import logging
import json

logger = logging.getLogger("ZapScanner")

class ZapScanPolicy:
    """Configures OWASP ZAP scan policies and risk evaluation criteria."""

    OWASP_CATEGORIES = {
        "A01": "Broken Access Control",
        "A02": "Cryptographic Failures",
        "A03": "Injection",
        "A04": "Insecure Design",
        "A05": "Security Misconfiguration",
        "A06": "Vulnerable and Outdated Components",
        "A07": "Identification and Authentication Failures",
        "A08": "Software and Data Integrity Failures",
        "A09": "Security Logging and Monitoring Failures",
        "A10": "Server-Side Request Forgery (SSRF)"
    }

    def __init__(self, target_url="http://localhost:5173", zap_proxy="http://localhost:8080"):
        self.target_url = target_url
        self.zap_proxy = zap_proxy
        self.alert_threshold = "High"

    def evaluate_alert(self, alert_name, risk_level, cwe_id=None, owasp_cat=None):
        """Evaluates whether an alert constitutes a deployment-blocking vulnerability."""
        risk_level = risk_level.capitalize()
        is_blocking = risk_level in ["Critical", "High"]
        return {
            "alert": alert_name,
            "risk": risk_level,
            "cwe_id": cwe_id or "CWE-Unknown",
            "owasp_category": self.OWASP_CATEGORIES.get(owasp_cat, "Security Defense Validation"),
            "blocking": is_blocking,
            "verdict": "FLAGGED" if is_blocking else "ACCEPTED / SAFE"
        }

    def run_policy_check(self, test_cases):
        """Runs security policy validation against test case matrix."""
        logger.info(f"Auditing {len(test_cases)} DAST security test cases against OWASP Top 10 policies...")
        passed = sum(1 for tc in test_cases if tc.get("status") == "PASS")
        failed = len(test_cases) - passed
        return {
            "total_audited": len(test_cases),
            "compliant": passed,
            "vulnerabilities_detected": failed,
            "deployment_ready": failed == 0
        }
