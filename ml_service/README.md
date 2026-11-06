# SilentSOS ML Microservice (Phase 1)

Privacy-preserving, local machine learning microservice serving four pre-trained classification models for the SilentSOS defense and emergency platform.

---

## 🛡️ Architecture & Security Principles
1. **Loopback Binding Only:** Listens strictly on `127.0.0.1:5001`. Never exposed to public interfaces.
2. **Zero Text Retention:** Request text is processed purely in volatile memory. Logs record string length only (`<input length: N chars>`).
3. **Artifact Integrity:** All 4 model artifacts in `H:\SilentSOS_ML\models` are loaded read-only into memory at service startup.
4. **Safety Disclaimers:** Every prediction response includes mandatory ethical, medical, and emergency disclaimers.

---

## 📦 Loaded Models

| Model Artifact | Category | Inputs / Outputs |
| :--- | :--- | :--- |
| `harassment_classifier.joblib` | SafeCity Binary Harassment | `0` (Safe) vs `1` (Harassment) |
| `harassment_multilabel_classifier.joblib` | Multilabel Harassment | 3 Categories: `Commenting`, `Ogling/Facial Expressions/Staring`, `Touching /Groping` |
| `crisis_risk_classifier.joblib` | Crisis Risk & Severity | 12 Risk categories + 4 Severity levels (`low`, `medium`, `high`, `critical`) |
| `symptom_classifier.joblib` | Medical Symptoms Pattern | 24 Medical conditions differential probabilities |

---

## 🚀 Running the Microservice

```powershell
# Set optional custom model path (defaults to H:\SilentSOS_ML\models)
$env:ML_MODELS_PATH = "H:\SilentSOS_ML\models"

# Start the service
python -m ml_service.server
```

---

## 📡 Endpoints

### 1. Health Diagnostic
`GET /health`
Returns service status, host, port, and loaded state for all 4 models.

### 2. Harassment Classification
`POST /predict/harassment`
Payload: `{"text": "A man is following me and shouting insults"}`

### 3. Multilabel Harassment Classification
`POST /predict/harassment_multilabel`
Payload: `{"text": "He was staring and making vulgar remarks"}`

### 4. Crisis Risk Assessment
`POST /predict/crisis_risk`
Payload: `{"text": "Someone is trying to break into my house right now"}`

### 5. Medical Symptom Pattern Matching
`POST /predict/symptoms`
Payload: `{"text": "I have high fever, chills, and severe headache"}`

---

## ⚠️ Critical Safety Guidelines
- **Crisis Classifier:** Experimental model. A `low` risk prediction must **NEVER** suppress, delay, or disarm emergency SOS alerts.
- **Symptom Classifier:** Academic use only. **NEVER** provide treatment or medication advice.
- **Harassment Classifier:** Probabilistic guidance only. Predictions must **NEVER** dismiss a user's reported distress.

