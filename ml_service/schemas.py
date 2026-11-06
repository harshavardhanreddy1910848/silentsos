"""
SilentSOS ML Microservice - Pydantic Request & Response Schemas
Includes strict input bounds, structured output schemas, and mandatory safety disclaimers.
"""

from typing import Dict, List
from pydantic import BaseModel, Field, field_validator
from .config import MIN_TEXT_LENGTH, MAX_TEXT_LENGTH


class PredictionRequest(BaseModel):
    """Input payload for text classification."""
    text: str = Field(
        ...,
        min_length=MIN_TEXT_LENGTH,
        max_length=MAX_TEXT_LENGTH,
        description=f"Raw text input between {MIN_TEXT_LENGTH} and {MAX_TEXT_LENGTH} characters."
    )

    @field_validator("text")
    @classmethod
    def validate_non_empty_whitespace(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Input text cannot be empty or purely whitespace.")
        return stripped


class HarassmentPredictionResponse(BaseModel):
    model: str = "SafeCity Harassment Binary Classifier"
    is_harassment: bool
    confidence: float
    probabilities: Dict[str, float]
    disclaimer: str = (
        "Classification is assistive and probabilistic. "
        "Predictions must not be used to dismiss or invalidate any user emergency or safety report."
    )


class HarassmentMultilabelResponse(BaseModel):
    model: str = "Multilabel Harassment Classifier"
    categories: Dict[str, bool]
    category_probabilities: Dict[str, float]
    disclaimer: str = (
        "Classification indicates recognized behavior patterns from historical survey data. "
        "Absence of a category label does not confirm safety."
    )


class CrisisRiskResponse(BaseModel):
    model: str = "Crisis Risk Type & Severity Classifier"
    risk_type: str
    severity: str
    risk_type_confidence: float
    severity_confidence: float
    disclaimer: str = (
        "CRITICAL SAFETY WARNING: This crisis model is experimental and is NOT a validated emergency detector. "
        "A 'low' or 'medium' severity prediction must NEVER be used to suppress, delay, or disarm emergency SOS "
        "or guardian alerts. In acute distress, always dispatch 112 emergency services."
    )


class DifferentialDiagnosis(BaseModel):
    condition: str
    probability: float


class SymptomPredictionResponse(BaseModel):
    model: str = "Medical Symptom Classifier (Symptom2Disease)"
    predicted_condition: str
    confidence: float
    top_differential_diagnoses: List[DifferentialDiagnosis]
    disclaimer: str = (
        "EDUCATIONAL USE ONLY: This model provides academic symptom-to-condition pattern matching only. "
        "It is NOT a medical device, diagnostic tool, or doctor replacement. "
        "Never prescribe, administer medication, or provide treatment advice based on this prediction. "
        "In life-threatening situations, dial 112/108 immediately."
    )


class HealthResponse(BaseModel):
    status: str
    host: str
    port: int
    models_dir: str
    models_loaded: Dict[str, bool]
    all_models_ready: bool
    timestamp: str

