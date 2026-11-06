"""
SilentSOS ML Microservice - FastAPI REST Server
Binds strictly to 127.0.0.1:5001.
Loads the 4 trained ML models once on startup and serves isolated inference endpoints.
Logs request metadata (text length) only - NEVER logs full user messages.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import logging
import sys

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import uvicorn

from .config import HOST, PORT, MODELS_DIR
from .model_loader import manager
from .schemas import (
    CrisisRiskResponse,
    HarassmentMultilabelResponse,
    HarassmentPredictionResponse,
    HealthResponse,
    PredictionRequest,
    SymptomPredictionResponse,
)

# Configure privacy-preserving logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ml_service.server")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle hook: Load models once on startup."""
    logger.info("SilentSOS ML Microservice starting up on %s:%d...", HOST, PORT)
    manager.load_all_models()
    ready_count = sum(1 for v in manager.load_status.values() if v)
    logger.info("Model loading complete. %d/4 models ready.", ready_count)
    yield
    logger.info("SilentSOS ML Microservice shutting down.")


app = FastAPI(
    title="SilentSOS ML Microservice",
    description="Privacy-preserving local ML classification microservice for SilentSOS.",
    version="1.0.0",
    docs_url=None,       # Disable Swagger UI in production
    redoc_url=None,      # Disable ReDoc in production
    openapi_url=None,    # Disable OpenAPI schema export for security
    lifespan=lifespan,
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Returns clean validation error without echoing sensitive payloads."""
    errors = exc.errors()
    msg = errors[0].get("msg", "Invalid input payload.") if errors else "Validation failed."
    logger.warning("Request validation rejected: %s", msg)
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "Validation Error", "detail": msg},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Safely handles uncaught exceptions without leaking stacktraces."""
    logger.error("Unhandled error processing request: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Inference Error", "detail": str(exc)},
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """System health check and loaded model diagnostics."""
    all_ready = all(manager.load_status.values())
    return HealthResponse(
        status="healthy" if all_ready else "degraded",
        host=HOST,
        port=PORT,
        models_dir=str(MODELS_DIR),
        models_loaded=manager.load_status,
        all_models_ready=all_ready,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/predict/harassment", response_model=HarassmentPredictionResponse)
async def predict_harassment(payload: PredictionRequest):
    """Binary SafeCity Harassment classification."""
    logger.info("POST /predict/harassment received (input length: %d chars)", len(payload.text))
    if not manager.load_status.get("harassment_binary"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Binary Harassment model is not available.",
        )
    result = manager.predict_harassment(payload.text)
    return HarassmentPredictionResponse(**result)


@app.post("/predict/harassment_multilabel", response_model=HarassmentMultilabelResponse)
async def predict_harassment_multilabel(payload: PredictionRequest):
    """Multilabel Harassment behavior category classification."""
    logger.info("POST /predict/harassment_multilabel received (input length: %d chars)", len(payload.text))
    if not manager.load_status.get("harassment_multilabel"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Multilabel Harassment model is not available.",
        )
    result = manager.predict_harassment_multilabel(payload.text)
    return HarassmentMultilabelResponse(**result)


@app.post("/predict/crisis_risk", response_model=CrisisRiskResponse)
async def predict_crisis_risk(payload: PredictionRequest):
    """Crisis risk category and severity assessment."""
    logger.info("POST /predict/crisis_risk received (input length: %d chars)", len(payload.text))
    if not manager.load_status.get("crisis_risk"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Crisis Risk model is not available.",
        )
    result = manager.predict_crisis_risk(payload.text)
    return CrisisRiskResponse(**result)


@app.post("/predict/symptoms", response_model=SymptomPredictionResponse)
async def predict_symptoms(payload: PredictionRequest):
    """Academic symptom to medical condition pattern matching."""
    logger.info("POST /predict/symptoms received (input length: %d chars)", len(payload.text))
    if not manager.load_status.get("symptoms"):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Medical Symptom model is not available.",
        )
    result = manager.predict_symptoms(payload.text)
    return SymptomPredictionResponse(**result)


def start_server():
    """Starts the Uvicorn server strictly on 127.0.0.1:5001."""
    uvicorn.run(
        "ml_service.server:app",
        host=HOST,
        port=PORT,
        log_level="info",
        access_log=False,  # Disables URL query logging for privacy
    )


if __name__ == "__main__":
    start_server()

