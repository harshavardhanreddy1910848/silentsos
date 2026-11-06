"""
SilentSOS ML Microservice - Configuration
Strictly binds to 127.0.0.1:5001. Configurable via environment variables.
"""

import os
from pathlib import Path

# Localhost binding ONLY - Never expose publicly
HOST = "127.0.0.1"
PORT = int(os.environ.get("ML_PORT", "5001"))

# Model directory path
DEFAULT_MODELS_DIR = r"H:\SilentSOS_ML\models"
MODELS_DIR = Path(os.environ.get("ML_MODELS_PATH", DEFAULT_MODELS_DIR))

# Model Artifact Filenames
MODEL_FILES = {
    "harassment_binary": "harassment_classifier.joblib",
    "harassment_multilabel": "harassment_multilabel_classifier.joblib",
    "crisis_risk": "crisis_risk_classifier.joblib",
    "symptoms": "symptom_classifier.joblib",
}

# Input constraints (Privacy & DoS mitigation)
MIN_TEXT_LENGTH = 1
MAX_TEXT_LENGTH = 2000

# Multilabel category labels (ordered as trained in SafeCity)
MULTILABEL_CATEGORIES = [
    "Commenting",
    "Ogling/Facial Expressions/Staring",
    "Touching /Groping",
]

