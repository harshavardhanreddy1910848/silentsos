"""
SilentSOS ML Microservice - Model Loader & Inference Engine
Loads all four trained joblib artifacts into memory at startup.
Performs text normalization and defensive prediction routing.
"""

import os
import re
import logging
from typing import Any, Dict, List, Optional, Tuple
import joblib
import numpy as np

from .config import MODELS_DIR, MODEL_FILES, MULTILABEL_CATEGORIES

logger = logging.getLogger("ml_service.loader")


def normalize_text(text: str) -> str:
    """Normalize text matching training preprocessing: lowercase, quote cleanup, collapse whitespace."""
    if not isinstance(text, str):
        text = str(text) if text is not None else ""
    text = text.lower()
    text = re.sub(r"[‘’`]", "'", text)
    text = re.sub(r"[“”]", '"', text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


class ModelManager:
    """Manages lifecycle and inference for all 4 SilentSOS ML classifiers."""

    def __init__(self, models_dir: Optional[str] = None):
        self.models_dir = models_dir or str(MODELS_DIR)
        self.harassment_binary: Optional[Any] = None
        self.harassment_multilabel: Optional[Any] = None
        self.crisis_risk: Optional[Dict[str, Any]] = None
        self.symptoms: Optional[Any] = None
        self.load_status: Dict[str, bool] = {
            "harassment_binary": False,
            "harassment_multilabel": False,
            "crisis_risk": False,
            "symptoms": False,
        }

    def load_all_models(self) -> Dict[str, bool]:
        """Loads all four models once at startup. Reports status per model."""
        logger.info("Initializing ModelManager from directory: %s", self.models_dir)

        # 1. Binary Harassment Model
        try:
            path = os.path.join(self.models_dir, MODEL_FILES["harassment_binary"])
            if os.path.exists(path):
                self.harassment_binary = joblib.load(path)
                self.load_status["harassment_binary"] = True
                logger.info("Loaded Binary Harassment Classifier successfully.")
            else:
                logger.warning("File not found: %s", path)
        except Exception as e:
            logger.error("Failed to load harassment_binary: %s", e)

        # 2. Multilabel Harassment Model
        try:
            path = os.path.join(self.models_dir, MODEL_FILES["harassment_multilabel"])
            if os.path.exists(path):
                self.harassment_multilabel = joblib.load(path)
                self.load_status["harassment_multilabel"] = True
                logger.info("Loaded Multilabel Harassment Classifier successfully.")
            else:
                logger.warning("File not found: %s", path)
        except Exception as e:
            logger.error("Failed to load harassment_multilabel: %s", e)

        # 3. Crisis Risk & Severity Model
        try:
            path = os.path.join(self.models_dir, MODEL_FILES["crisis_risk"])
            if os.path.exists(path):
                self.crisis_risk = joblib.load(path)
                self.load_status["crisis_risk"] = True
                logger.info("Loaded Crisis Risk & Severity Classifier successfully.")
            else:
                logger.warning("File not found: %s", path)
        except Exception as e:
            logger.error("Failed to load crisis_risk: %s", e)

        # 4. Medical Symptom Model
        try:
            path = os.path.join(self.models_dir, MODEL_FILES["symptoms"])
            if os.path.exists(path):
                self.symptoms = joblib.load(path)
                self.load_status["symptoms"] = True
                logger.info("Loaded Symptom Disease Classifier successfully.")
            else:
                logger.warning("File not found: %s", path)
        except Exception as e:
            logger.error("Failed to load symptoms: %s", e)

        return self.load_status

    def predict_harassment(self, raw_text: str) -> Dict[str, Any]:
        """Binary prediction: Safe (0) vs Harassment (1)."""
        if not self.harassment_binary:
            raise RuntimeError("Binary Harassment Classifier is not loaded.")

        clean_text = normalize_text(raw_text)
        prediction = int(self.harassment_binary.predict([clean_text])[0])
        probas = self.harassment_binary.predict_proba([clean_text])[0]

        # probas[0] = non-harassment, probas[1] = harassment
        is_harassment = bool(prediction == 1)
        confidence = float(probas[prediction])

        return {
            "is_harassment": is_harassment,
            "confidence": round(confidence, 4),
            "probabilities": {
                "safe": round(float(probas[0]), 4),
                "harassment": round(float(probas[1]), 4),
            },
        }

    def predict_harassment_multilabel(self, raw_text: str) -> Dict[str, Any]:
        """Multilabel prediction across Commenting, Ogling/Staring, Touching/Groping."""
        if not self.harassment_multilabel:
            raise RuntimeError("Multilabel Harassment Classifier is not loaded.")

        clean_text = normalize_text(raw_text)
        preds = self.harassment_multilabel.predict([clean_text])[0]
        probas = self.harassment_multilabel.predict_proba([clean_text])[0]

        categories_dict = {}
        probas_dict = {}
        for idx, cat_name in enumerate(MULTILABEL_CATEGORIES):
            is_active = bool(preds[idx] == 1)
            prob_val = float(probas[idx])
            categories_dict[cat_name] = is_active
            probas_dict[cat_name] = round(prob_val, 4)

        return {
            "categories": categories_dict,
            "category_probabilities": probas_dict,
        }

    def predict_crisis_risk(self, raw_text: str) -> Dict[str, Any]:
        """Predicts crisis risk category and severity tier."""
        if not self.crisis_risk:
            raise RuntimeError("Crisis Risk & Severity Classifier is not loaded.")

        clean_text = normalize_text(raw_text)
        risk_pipe = self.crisis_risk["risk_type_pipeline"]
        sev_pipe = self.crisis_risk["severity_pipeline"]

        # Risk type prediction
        pred_risk = str(risk_pipe.predict([clean_text])[0])
        risk_probas = risk_pipe.predict_proba([clean_text])[0]
        risk_classes = list(risk_pipe.classes_)
        risk_conf = float(risk_probas[risk_classes.index(pred_risk)]) if pred_risk in risk_classes else float(np.max(risk_probas))

        # Severity prediction
        pred_sev = str(sev_pipe.predict([clean_text])[0])
        sev_probas = sev_pipe.predict_proba([clean_text])[0]
        sev_classes = list(sev_pipe.classes_)
        sev_conf = float(sev_probas[sev_classes.index(pred_sev)]) if pred_sev in sev_classes else float(np.max(sev_probas))

        return {
            "risk_type": pred_risk,
            "severity": pred_sev,
            "risk_type_confidence": round(risk_conf, 4),
            "severity_confidence": round(sev_conf, 4),
        }

    def predict_symptoms(self, raw_text: str) -> Dict[str, Any]:
        """Predicts medical condition based on symptom description."""
        if not self.symptoms:
            raise RuntimeError("Medical Symptom Classifier is not loaded.")

        clean_text = normalize_text(raw_text)
        pred_condition = str(self.symptoms.predict([clean_text])[0])
        probas = self.symptoms.predict_proba([clean_text])[0]
        classes = list(self.symptoms.classes_)

        # Top 3 differential diagnoses
        top_indices = np.argsort(probas)[::-1][:3]
        top_differentials = [
            {"condition": str(classes[idx]), "probability": round(float(probas[idx]), 4)}
            for idx in top_indices
        ]

        top_confidence = float(probas[classes.index(pred_condition)]) if pred_condition in classes else float(probas[top_indices[0]])

        return {
            "predicted_condition": pred_condition,
            "confidence": round(top_confidence, 4),
            "top_differential_diagnoses": top_differentials,
        }


# Global singleton instance
manager = ModelManager()

