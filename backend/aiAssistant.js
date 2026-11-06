/**
 * SilentSOS Clean Conversational AI Assistant Engine
 * 
 * Powered by local Ollama llama3.2 running on Windows 11 (localhost:11434).
 * 
 * Behavioral & Output Requirements:
 * - Provides direct, natural, conversational answers only.
 * - Zero links, zero URLs, zero article lists, zero citations, and zero source sections.
 * - No automatic web searching or article retrieval for ordinary chat.
 * - Honest answers when information is not known (no hallucinations).
 * - Priority 0: Immediate emergency life-threat bypass (instant 0ms guidance).
 * - Strict backend sanitization guarantees clean text output.
 */

import http from 'http';
import { queryAiBrain, handleNearbyEmergencyLocations } from './ai/nlp_inference_engine.js';
import {
  predictHarassment,
  predictHarassmentMultilabel,
  predictCrisisRisk,
  predictSymptoms
} from './mlClient.js';

const SYSTEM_PROMPT = `You are the SilentSOS Emergency, Medical & Personal Safety AI Assistant powered by local Ollama llama3.2.

Your role is to assist users with:
1. MEDICAL ASSISTANCE: Basic first aid instructions (hands-only CPR, severe bleeding control, burn treatment, choking Heimlich maneuver), health awareness, and emergency triage. You are an emergency safety assistant, not a doctor. Never diagnose medical conditions or prescribe medication. Direct users to call 108/112 in life-threatening medical emergencies.
2. WOMEN'S PROTECTION: Stalking evasion, solo/night travel precautions, harassment prevention, domestic abuse resources (181 helpline, NCW support), and legal protections in India (Section 173 BNSS Zero FIR).
3. PERSONAL SAFETY & SILENTSOS CONTROLS: De-escalation tactics, accident response, and SilentSOS platform operations (3-second SOS button hold, phone shake trigger, covert optical gestures, auto-capture evidence dispatch, live Google Maps tracking, stealth mode black screen disguise, 4-digit safety PIN).

CRITICAL RESPONSE RULES (STRICTLY ENFORCED):
- Give a clear, helpful, and direct answer immediately.
- Use natural, polite, and easy-to-understand conversational language.
- DO NOT display website links or web addresses.
- DO NOT display URLs.
- DO NOT provide article lists, news lists, or reading lists.
- DO NOT provide citations, footnotes, or bibliographies.
- DO NOT show source lists or references.
- DO NOT generate Markdown hyperlinks [text](url) or HTML links.
- DO NOT append a "Sources", "References", or "Further Reading" section at the end of your response.
- DO NOT claim to browse the web or retrieve articles.
- If you do not know the answer to a question, honestly and politely state that you do not know rather than fabricating facts, numbers, or sources.
- For immediate physical dangers, prioritize quick, decisive safety instructions.`;

/**
 * Backend Sanitizer: Enforces strict direct-answer-only compliance.
 * Strips any accidental URLs, Markdown links, HTML tags, or trailing Sources/References blocks.
 */
export function sanitizeDirectAnswer(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;

  // 1. Remove trailing Sources, References, or Further Reading sections
  cleaned = cleaned.replace(/\n*---*\s*\n*(?:📌|🔗)?\s*(?:\*\*)?(?:Sources|Verified Sources|Official Sources|References|Further Reading|Reference Links|Citations)(?:\*\*)?:?[\s\S]*$/i, '');
  cleaned = cleaned.replace(/\n*(?:📌|🔗)?\s*(?:\*\*)?(?:Sources|Verified Official Sources|Official Sources|References|Further Reading)(?:\*\*)?:?[\s\S]*$/i, '');

  // 2. Convert Markdown links [Anchor Text](https://...) -> Anchor Text
  cleaned = cleaned.replace(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/g, '$1');

  // 3. Remove bare URLs (http://..., https://..., www....)
  cleaned = cleaned.replace(/https?:\/\/[^\s\)\],]+/gi, '');
  cleaned = cleaned.replace(/\bwww\.[^\s\)\],]+/gi, '');

  // 4. Remove HTML tags if any
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // 5. Clean up duplicate blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  return cleaned;
}

/**
 * Connects directly to local Ollama on Windows 11 host (localhost:11434).
 * Optionally incorporates non-authoritative assistive ML context into the system prompt.
 */
async function tryLocalOllama(message, history = [], mlContext = null) {
  const host = process.env.OLLAMA_HOST || '127.0.0.1';
  const port = process.env.OLLAMA_PORT || 11434;
  const model = process.env.OLLAMA_MODEL || 'llama3.2';

  const systemContent = mlContext
    ? `${SYSTEM_PROMPT}\n\n${mlContext}`
    : SYSTEM_PROMPT;

  const messages = [
    { role: 'system', content: systemContent },
    ...history.slice(-6).map(h => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: sanitizeDirectAnswer(h.text || h.content || '')
    })),
    { role: 'user', content: message }
  ];

  const payload = JSON.stringify({
    model: model,
    messages: messages,
    stream: false,
    options: {
      temperature: 0.7,
      top_p: 0.9
    }
  });

  return new Promise((resolve) => {
    const req = http.request({
      hostname: host,
      port: Number(port),
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const rawReply = parsed?.message?.content;
          if (rawReply && rawReply.trim()) {
            resolve({
              reply: sanitizeDirectAnswer(rawReply),
              source: `Local Ollama (${parsed.model || model})`,
              model: parsed.model || model
            });
            return;
          }
        } catch (_) {}
        resolve(null);
      });
    });

    req.on('error', (err) => {
      console.warn(`[AI Engine] Local Ollama service unreachable at http://${host}:${port} (${err.message})`);
      resolve(null);
    });

    req.on('timeout', () => {
      console.warn('[AI Engine] Local Ollama request timed out after 30 seconds');
      req.destroy();
      resolve(null);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Generates smart suggestions without web links.
 */
function deriveSmartSuggestions(query, answer) {
  const q = query.toLowerCase();

  if (q.includes('cpr') || q.includes('cardiac') || q.includes('first aid') || q.includes('bleed') || q.includes('chok') || q.includes('burn')) {
    return [
      'How do I perform hands-only CPR on an adult?',
      'How to treat severe arterial bleeding?',
      'What are the steps for the Heimlich maneuver when someone is choking?'
    ];
  }
  if (q.includes('gesture') || q.includes('palm') || q.includes('blink')) {
    return [
      'How does the Palm Raise gesture trigger an alert?',
      'How does Eye Blink pattern detection work?',
      'How does Stealth Mode work in SilentSOS?'
    ];
  }
  if (q.includes('auto capture') || q.includes('surveillance') || q.includes('evidence')) {
    return [
      'How does Auto-Capture Surveillance record evidence?',
      'How is evidence emailed to guardian contacts?',
      'How does live GPS tracking work in SilentSOS?'
    ];
  }
  if (q.includes('stalk') || q.includes('follow') || q.includes('harass') || q.includes('women')) {
    return [
      'What should I do if someone is following me?',
      'What is a Zero FIR in India?',
      'How to activate Stealth Mode quickly?'
    ];
  }
  return [
    'How does SilentSOS Stealth Mode work?',
    'What should I do if someone is following me?',
    'What are the first aid steps for CPR?'
  ];
}

/**
 * Selective ML Routing Engine
 * Evaluates message relevance and fetches non-authoritative assistive context
 * from the local Python ML microservice (http://127.0.0.1:5001).
 * 
 * Safety & Privacy Boundaries:
 * - Runs ONLY for relevant safety, harassment, crisis, or symptom inquiries.
 * - Skipped completely for general chat, legal rights, and app configuration questions.
 * - Low/medium crisis scores NEVER downgrade risk or affect SOS emergency protocols.
 * - Symptom classifier is strictly educational/pattern-matching: NEVER diagnoses,
 *   never prescribes medication, and never specifies disease treatments.
 * - Fail-open: returns null immediately if Python is offline or times out (1200ms).
 */
async function getSelectiveMlContext(message) {
  if (!message || typeof message !== 'string') return null;
  const lower = message.toLowerCase();

  // Rule 1: Exclude general app features, legal rights, and configuration questions (0 ML calls)
  const isAppOrLegalQuery = (
    lower.includes('stealth mode') ||
    lower.includes('safety pin') ||
    lower.includes('optical gesture') ||
    lower.includes('palm raise') ||
    lower.includes('eye blink') ||
    lower.includes('zero fir') ||
    lower.includes('section 173') ||
    lower.includes('bnss') ||
    lower.includes('crpc') ||
    lower.includes('how does silentsos') ||
    lower.includes('how to use')
  ) && !lower.includes('fever') && !lower.includes('symptom') && !lower.includes('stalk') && !lower.includes('harass') && !lower.includes('blackmail');

  if (isAppOrLegalQuery) {
    return null;
  }

  // Rule 2: Symptom-related inquiry (Calls Medical Symptom Model ONLY)
  const isSymptomQuery = (
    lower.includes('symptom') ||
    lower.includes('fever') ||
    lower.includes('rash') ||
    lower.includes('headache') ||
    lower.includes('nausea') ||
    lower.includes('vomit') ||
    lower.includes('cough') ||
    lower.includes('chills') ||
    lower.includes('dizzy') ||
    lower.includes('swelling') ||
    lower.includes('stomach ache') ||
    lower.includes('chest tightness') ||
    lower.includes('sore throat') ||
    lower.includes('joint pain') ||
    lower.includes('fatigue')
  );

  if (isSymptomQuery) {
    const symptomRes = await predictSymptoms(message);
    if (symptomRes && symptomRes.predicted_condition) {
      const condition = sanitizeDirectAnswer(symptomRes.predicted_condition);
      return `[EDUCATIONAL PATTERN RECOGNITION (EXPERIMENTAL - NOT A DIAGNOSIS):
A local academic text-pattern model matched reported keywords to pattern "${condition}".
MANDATORY MEDICAL SAFETY CONSTRAINTS:
- You are an AI safety assistant, NOT a medical doctor.
- Do NOT confirm or state that the user has "${condition}".
- Do NOT prescribe medicines, dosages, pharmaceuticals, or condition-specific treatments.
- Provide only general, non-pharmacological comfort and supportive care appropriate to the symptoms.
- Strongly advise the user to consult a qualified physician or clinic for a proper medical examination.
- If symptoms are severe, sudden, or worsening, urge them to contact emergency medical services (108 / 112) immediately.]`;
    }
    return null;
  }

  // Rule 3: Harassment-related inquiry (Calls Binary & Multilabel Harassment Models ONLY)
  const isHarassmentQuery = (
    lower.includes('harass') ||
    lower.includes('stalk') ||
    lower.includes('follow') ||
    lower.includes('grop') ||
    lower.includes('catcall') ||
    lower.includes('touching') ||
    lower.includes('staring') ||
    lower.includes('ogling') ||
    lower.includes('creep') ||
    lower.includes('inappropriate comment')
  );

  if (isHarassmentQuery) {
    const [binaryRes, multiRes] = await Promise.all([
      predictHarassment(message),
      predictHarassmentMultilabel(message)
    ]);

    let note = `[ASSISTIVE CONTEXT NOTE (SUPPORTIVE GUIDANCE):
User inquiry touches on personal safety or potential harassment.
MANDATORY SAFETY CONSTRAINTS:
- Always prioritize user safety and emotional validation.
- Never question or invalidate the user's feelings, distress, or personal account.
- Focus on practical, immediate situational awareness (moving toward crowded, well-lit spaces, entering an open business, contacting a trusted person).
- Remind the user of SilentSOS protections (Stealth Mode black screen, emergency SOS trigger) and national helplines: 112 (Universal Emergency) and 1091 (Women's Helpline in India).
- If appropriate, suggest documenting safe details (time, location, appearance) for legal reporting under Section 173 BNSS Zero FIR.`;

    if (multiRes && multiRes.categories) {
      const activeCats = Object.entries(multiRes.categories)
        .filter(([_, active]) => active)
        .map(([name]) => sanitizeDirectAnswer(name));
      if (activeCats.length > 0) {
        note += `\n- Observed behavior patterns: ${activeCats.join(', ')}.`;
      }
    }
    note += `]`;
    return note;
  }

  // Rule 4: Non-acute crisis, extortion, blackmail, or coercive control (Calls Crisis Risk Model ONLY)
  const isCrisisQuery = (
    lower.includes('blackmail') ||
    lower.includes('extort') ||
    lower.includes('leak photo') ||
    lower.includes('private photos') ||
    lower.includes('coercive') ||
    lower.includes('domestic violence') ||
    lower.includes('financial exploit') ||
    lower.includes('revenge porn') ||
    lower.includes('intimidat')
  );

  if (isCrisisQuery) {
    const crisisRes = await predictCrisisRisk(message);
    let note = `[ASSISTIVE CONTEXT NOTE (EXPERIMENTAL SIGNAL ONLY):
User inquiry touches on potential interpersonal crisis, intimidation, or extortion.
MANDATORY SAFETY & CRISIS RESTRICTIONS:
- This crisis classifier is an experimental model and NOT a validated emergency detector.
- NEVER use its prediction to downplay danger or reassure someone that a situation is 'low risk'.
- NEVER let this override the user's own description or emotional state.
- Emphasize emotional grounding, personal safety, and never complying with extortion or blackmail demands.
- Recommend safely preserving evidence (screenshots, timestamps, sender handles) without provoking the perpetrator.
- Direct the user to official authorities: 1930 (National Cybercrime Helpline in India / cybercrime.gov.in), 181 (Women's Domestic Violence Helpline), and 112.]`;

    if (crisisRes && crisisRes.risk_type) {
      note += `\n- Potential theme: ${sanitizeDirectAnswer(crisisRes.risk_type)}.`;
    }
    note += `]`;
    return note;
  }

  // Rule 5: General conversation / no match -> 0 ML calls
  return null;
}

/**
 * Main AI Assistant Entry Point for Node.js Backend.
 */
export async function generateAiAssistantReply({ message, history = [], user, settings, contacts = [], location = null }) {
  const cleanMessage = (message || '').trim();
  const lowerMsg = cleanMessage.toLowerCase();

  // 0. Immediate Crisis & Life-Threatening Danger Check (Zero Delay Response)
  const isImmediateCrisis = lowerMsg.includes('help me right now') ||
    lowerMsg.includes('immediate danger') ||
    lowerMsg.includes('someone is breaking in') ||
    lowerMsg.includes('being attacked') ||
    lowerMsg.includes('someone is outside my door') ||
    lowerMsg.includes('in danger right now');

  if (isImmediateCrisis) {
    return {
      success: true,
      intent: 'immediate_emergency_safety_instructions',
      category: 'Immediate Emergency Action',
      confidence: 100,
      reply: `🚨 IMMEDIATE EMERGENCY SAFETY PROTOCOL:\n\n` +
        `1. Call Emergency Services NOW: Dial 112 (Universal Emergency) or 100 / 1091 (Women's Helpline).\n` +
        `2. Trigger SilentSOS Alarm: Press and hold the glowing central SOS button for 3 seconds or rapidly shake your phone 3 times.\n` +
        `3. Lock Yourself In or Escape: Barricade doors, turn off lights, or move immediately toward well-lit public areas.\n` +
        `4. Activate Stealth Mode: If an aggressor is nearby, enable Stealth Mode to keep your screen dark while satellite GPS and audio recording stream to your guardians.\n\n` +
        `Do not attempt to confront an aggressor. Focus on physical safety and summoning emergency responders.`,
      suggestions: [
        'How to call 112 emergency dispatch?',
        'How does SilentSOS Stealth Mode work?',
        'Where is the nearest police station?'
      ]
    };
  }

  // 1. Nearby Emergency Facilities Check (Police Stations & Hospitals)
  const facilityLookup = handleNearbyEmergencyLocations(lowerMsg, cleanMessage, location);
  if (facilityLookup.matched) {
    return {
      success: true,
      intent: 'emergency_facility_locator',
      confidence: 99,
      reply: sanitizeDirectAnswer(facilityLookup.reply),
      suggestions: facilityLookup.suggestions || [
        'Where is the nearest hospital?',
        'Where is the nearest police station?',
        'How to trigger an immediate SOS alert?'
      ]
    };
  }

  try {
    // 2. Selective Task Routing for Optional ML Assistive Context (Fail-Open)
    const mlContext = await getSelectiveMlContext(cleanMessage);

    // 3. Primary Engine: Local Ollama llama3.2 with Optional ML Context
    const localLlmRes = await tryLocalOllama(cleanMessage, history, mlContext);
    if (localLlmRes && localLlmRes.reply) {
      let finalReply = sanitizeDirectAnswer(localLlmRes.reply);

      // If Llama 3.2 produced a canned refusal on a critical first aid emergency query,
      // augment with verified bystander emergency instructions:
      const lowerReply = finalReply.toLowerCase();
      const isRefusal = (lowerReply.includes('cannot provide medical advice') || lowerReply.includes('consult a healthcare professional') || lowerReply.includes('not a medical professional')) &&
        (lowerMsg.includes('cpr') || lowerMsg.includes('chok') || lowerMsg.includes('bleed') || lowerMsg.includes('burn') || lowerMsg.includes('first aid'));

      if (isRefusal) {
        const brainRes = queryAiBrain({
          message: cleanMessage,
          history,
          user,
          settings,
          contacts,
          location
        });
        if (brainRes && brainRes.reply) {
          finalReply = `${finalReply}\n\nImmediate Bystander First Aid Protocol:\n${sanitizeDirectAnswer(brainRes.reply)}`;
        }
      }

      return {
        success: true,
        intent: 'local_ollama_llama3_2',
        confidence: 98,
        reply: finalReply,
        source: localLlmRes.source || 'Local Ollama (llama3.2)',
        model: localLlmRes.model || 'llama3.2',
        suggestions: deriveSmartSuggestions(cleanMessage, finalReply)
      };
    }

    // 3. Fallback: Local Cognitive Knowledge Engine (Offline Emergency Core)
    const localBrainRes = queryAiBrain({
      message: cleanMessage,
      history,
      user,
      settings,
      contacts,
      location
    });

    if (localBrainRes && localBrainRes.reply) {
      return {
        success: true,
        intent: localBrainRes.intent || 'local_cognitive_fallback',
        confidence: 90,
        reply: sanitizeDirectAnswer(localBrainRes.reply),
        source: 'SilentSOS Local Knowledge Engine',
        model: 'llama3.2-fallback',
        suggestions: localBrainRes.suggestions || deriveSmartSuggestions(cleanMessage, localBrainRes.reply)
      };
    }
  } catch (err) {
    console.error('[AI Engine] Execution error:', err);
  }

  // Final direct fallback if everything else is unreachable
  return {
    success: true,
    intent: 'fallback_guidance',
    confidence: 80,
    reply: `I received your question: "${cleanMessage}". I am currently operating in direct safety mode. Please let me know what specific safety, medical first aid, or SilentSOS platform guidance you need.`,
    source: 'SilentSOS Core',
    model: 'llama3.2',
    suggestions: [
      'What are the first aid steps for CPR?',
      'How does Stealth Mode work in SilentSOS?',
      'What should I do if someone is following me?'
    ]
  };
}
