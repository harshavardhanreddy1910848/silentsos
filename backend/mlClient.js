/**
 * SilentSOS Python ML Microservice Client
 * 
 * Communicates with the local Python FastAPI microservice on http://127.0.0.1:5001.
 * 
 * Safety & Reliability Rules:
 * - Localhost binding only (never exposes port 5001 to external clients).
 * - Strict 1200ms fail-open timeout via AbortSignal.timeout().
 * - Zero retries (single-shot to prevent cascading latency).
 * - Never throws an error into the main chatbot response flow (always returns null on failure).
 * - Never logs user message text, symptoms, or sensitive content (logs endpoint and error category only).
 * - Strict input length validation (1 to 2000 chars).
 */

const DEFAULT_ML_URL = 'http://127.0.0.1:5001';
const ML_TIMEOUT_MS = 1200;

/**
 * Resolves the active ML microservice base URL.
 */
export function getMlServiceUrl() {
  return (process.env.ML_SERVICE_URL || DEFAULT_ML_URL).replace(/\/+$/, '');
}

/**
 * Validates text input before sending over loopback.
 * Rejects empty or excessively long inputs without network dispatch.
 */
function validateTextInput(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (trimmed.length < 1 || trimmed.length > 2000) return null;
  return trimmed;
}

/**
 * Core privacy-preserving HTTP dispatcher.
 */
async function postMlEndpoint(endpoint, text) {
  const cleanText = validateTextInput(text);
  if (!cleanText) return null;

  const url = `${getMlServiceUrl()}${endpoint}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ text: cleanText }),
      signal: AbortSignal.timeout(ML_TIMEOUT_MS)
    });

    if (!res.ok) {
      console.warn(`[ML Client] ${endpoint} returned HTTP ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    // Categorize error cleanly without logging any user text
    const errType = err.name === 'TimeoutError' ? 'timeout (1200ms exceeded)' : (err.code || err.name || 'network_error');
    console.warn(`[ML Client] ${endpoint} request failed: ${errType}`);
    return null;
  }
}

/**
 * Checks health and model load diagnostics of the ML microservice.
 * Returns null if service is offline.
 */
export async function checkMlHealth() {
  const url = `${getMlServiceUrl()}/health`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(ML_TIMEOUT_MS)
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  }
}

/**
 * Predicts SafeCity binary harassment classification.
 * Output: { is_harassment: boolean, confidence: number, probabilities: object, disclaimer: string } | null
 */
export async function predictHarassment(text) {
  const res = await postMlEndpoint('/predict/harassment', text);
  if (!res || typeof res.is_harassment !== 'boolean') return null;
  return {
    is_harassment: Boolean(res.is_harassment),
    confidence: typeof res.confidence === 'number' ? res.confidence : 0,
    probabilities: res.probabilities || {},
    disclaimer: res.disclaimer || ''
  };
}

/**
 * Predicts Multilabel harassment category indicators.
 * Output: { categories: object, category_probabilities: object, disclaimer: string } | null
 */
export async function predictHarassmentMultilabel(text) {
  const res = await postMlEndpoint('/predict/harassment_multilabel', text);
  if (!res || typeof res.categories !== 'object') return null;
  return {
    categories: res.categories,
    category_probabilities: res.category_probabilities || {},
    disclaimer: res.disclaimer || ''
  };
}

/**
 * Predicts Crisis risk category and severity tier.
 * Output: { risk_type: string, severity: string, risk_type_confidence: number, severity_confidence: number, disclaimer: string } | null
 */
export async function predictCrisisRisk(text) {
  const res = await postMlEndpoint('/predict/crisis_risk', text);
  if (!res || typeof res.risk_type !== 'string' || typeof res.severity !== 'string') return null;
  return {
    risk_type: String(res.risk_type),
    severity: String(res.severity),
    risk_type_confidence: typeof res.risk_type_confidence === 'number' ? res.risk_type_confidence : 0,
    severity_confidence: typeof res.severity_confidence === 'number' ? res.severity_confidence : 0,
    disclaimer: res.disclaimer || ''
  };
}

/**
 * Predicts symptom-to-condition pattern matches.
 * Output: { predicted_condition: string, confidence: number, top_differential_diagnoses: array, disclaimer: string } | null
 */
export async function predictSymptoms(text) {
  const res = await postMlEndpoint('/predict/symptoms', text);
  if (!res || typeof res.predicted_condition !== 'string' || !Array.isArray(res.top_differential_diagnoses)) return null;
  return {
    predicted_condition: String(res.predicted_condition),
    confidence: typeof res.confidence === 'number' ? res.confidence : 0,
    top_differential_diagnoses: res.top_differential_diagnoses,
    disclaimer: res.disclaimer || ''
  };
}

