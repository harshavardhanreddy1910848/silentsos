/**
 * SilentSOS Intelligent Conversational AI Assistant Engine
 * 
 * Provides dynamic, general-purpose and domain-specific conversational intelligence:
 * 1. Configured Cloud LLMs (Gemini, Groq, OpenAI, Anthropic) if API keys are set.
 * 2. High-performance Free LLM Inference Engine (Pollinations AI / OpenAI-compatible).
 * 3. Local Ollama LLM runtime on localhost:11434.
 * 4. Comprehensive In-House Cognitive & Knowledge Base (SilentSOS, Women's Safety, STEM, Physics, Cyber, GPS).
 *
 * Adheres strictly to the SilentSOS AI Behavioral Rules:
 * - Answers the exact question asked across any domain.
 * - Never forces general questions into a safety context.
 * - Preserves conversation context across multi-turn exchanges.
 * - Provides step-by-step explanations, code, and real examples.
 */

import http from 'http';
import { queryAiBrain, handleNearbyEmergencyLocations } from './ai/nlp_inference_engine.js';

const SYSTEM_PROMPT = `You are the SilentSOS Emergency, Medical & Personal Safety AI Assistant.

Your primary mission is to provide authoritative, actionable, and compassionate assistance strictly focused on:
1. SilentSOS Platform Operations, sensor telemetry, and controls (SOS triggers, optical gestures, auto-capture surveillance, live tracking, stealth mode, PIN security).
2. Emergency Medical First Aid (hands-only CPR, choking Heimlich maneuver, severe bleeding control, burn care, trauma response).
3. Personal Safety, crisis de-escalation, anti-stalking evasion, solo and night travel precautions, and women's emergency legal rights (Zero FIR, 112, 1091).

Rules:
- Prioritize immediate personal safety and life-saving first aid above all else.
- Maintain a calm, empathetic, and decisive tone.
- Do not invent application features; stick strictly to SilentSOS capabilities and verified medical/emergency protocols.
- For queries related to SilentSOS, emergency medical care, or personal defense, provide direct, step-by-step actionable advice.
- If a query is unrelated to safety, medical, or SilentSOS operations, politely guide the user back to SilentSOS safety, emergency preparedness, and medical first-aid capabilities.
- Maintain conversation context for relevant follow-up questions.
- Format responses cleanly with GitHub-flavored markdown.

SilentSOS Verified Platform Specifications:
- SOS Dispatch: 3-second hold on central SOS button or rapid hardware shake.
- Covert Optical Gestures: Front-camera Palm Raise (1.5s) or 3-blink Eye Blink pattern for silent hands-free triggers.
- Auto-Capture Surveillance: Dual-camera photo burst (3-10 shots), rolling 1080p video loop buffer, and stereo microphone audio recording.
- Automated Evidence Dispatch: Dispatches email evidence package containing photos, video, audio, and live reverse-geocoded GPS coordinates to emergency guardian contacts.
- Live Receiver Portal: Real-time Google Maps telemetry link for trusted guardian contacts.
- Stealth Mode: Black-screen disguise while silently maintaining GPS broadcasting and surveillance recording.
- Safety PIN Anti-Tamper: 4-digit security PIN (default: 1234) required to cancel active alarms.
- Fake Call Escape Simulator: Authentic incoming call screen to exit risky or uncomfortable social situations.`;

/**
 * Generates 2-3 smart, contextually relevant follow-up questions based on the topic.
 */
function deriveSmartSuggestions(query, answer) {
  const q = query.toLowerCase();

  if (q.includes('cpr') || q.includes('cardiac') || q.includes('chest compression') || q.includes('first aid') || q.includes('medical') || q.includes('bleed') || q.includes('chok') || q.includes('burn')) {
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
  if (q.includes('auto capture') || q.includes('surveillance') || q.includes('photo burst') || q.includes('video loop') || q.includes('audio recording')) {
    return [
      'How does Auto-Capture Surveillance record evidence?',
      'How is evidence emailed to guardian contacts?',
      'How does live GPS tracking work in SilentSOS?'
    ];
  }
  if (q.includes('gps') || q.includes('location') || q.includes('tracking') || q.includes('coordinates')) {
    return [
      'How does SilentSOS broadcast live GPS coordinates to guardians?',
      'How does live receiver tracking work on Google Maps?',
      'How does Stealth Mode preserve GPS broadcasting?'
    ];
  }
  if (q.includes('silentsos') || q.includes('app') || q.includes('feature') || q.includes('purpose') || q.includes('stealth') || q.includes('pin')) {
    return [
      'How does Stealth Mode work in SilentSOS?',
      'How does Covert Optical Gesture Detection work?',
      'How to change my 4-digit Safety PIN?'
    ];
  }
  if (q.includes('follow') || q.includes('stalk') || q.includes('danger') || q.includes('unsafe') || q.includes('threat')) {
    return [
      'What should I do if they don\'t stop following me?',
      'How do I activate SilentSOS Stealth Mode quietly?',
      'What is a Zero FIR under Indian law?'
    ];
  }
  if (q.includes('police') || q.includes('cop') || q.includes('thana') || q.includes('station')) {
    return [
      'Where is the nearest police station?',
      'How do I call 112 emergency police dispatch?',
      'What is a Zero FIR in India?'
    ];
  }
  if (q.includes('hospital') || q.includes('clinic') || q.includes('doctor') || q.includes('emergency room') || q.includes('ambulance') || q.includes('trauma')) {
    return [
      'Where is the nearest 24/7 hospital?',
      'How to request emergency ambulance dispatch (108)?',
      'How to treat severe bleeding while waiting for ambulance?'
    ];
  }
  if (q.includes('travel') || q.includes('solo') || q.includes('trip') || q.includes('hotel') || q.includes('night') || q.includes('cab')) {
    return [
      'What about travelling at night?',
      'What precautions should I take when taking a taxi or cab alone?',
      'How do I share live tracking with emergency contacts?'
    ];
  }

  // Safety & Emergency Default Suggestions
  return [
    'What should I do if someone is following me?',
    'How do I perform CPR on an adult?',
    'How does SilentSOS Stealth Mode work?'
  ];
}

/**
 * 1. Cloud Provider: Google Gemini API
 */
async function tryGeminiApi(message, history = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const contents = [
      ...history.slice(-6).map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.text || h.content || '' }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 }
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) {
        return {
          reply: reply.trim(),
          source: 'Gemini 1.5 Flash'
        };
      }
    }
  } catch (e) {
    console.warn('[AI Engine] Gemini API probe skipped:', e.message);
  }
  return null;
}

/**
 * 2. Cloud Provider: Groq API (Llama 3.3 70B)
 */
async function tryGroqApi(message, history = []) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.text || h.content || '' })),
      { role: 'user', content: message }
    ];

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        temperature: 0.7,
        max_tokens: 1024
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content;
      if (reply) {
        return {
          reply: reply.trim(),
          source: 'Groq Llama-3.3-70B'
        };
      }
    }
  } catch (e) {
    console.warn('[AI Engine] Groq API probe skipped:', e.message);
  }
  return null;
}

/**
 * 3. Cloud Provider: OpenAI API (GPT-4o mini)
 */
async function tryOpenAiApi(message, history = []) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-6).map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: h.text || h.content || '' })),
      { role: 'user', content: message }
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 1024
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (res.ok) {
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content;
      if (reply) {
        return {
          reply: reply.trim(),
          source: 'OpenAI GPT-4o-mini'
        };
      }
    }
  } catch (e) {
    console.warn('[AI Engine] OpenAI API probe skipped:', e.message);
  }
  return null;
}

/**
 * 4. High-Performance Free Dynamic LLM Engine (Pollinations AI)
 * No API key required; connects to high-capacity hosted inference.
 */
async function tryPollinationsAi(message, history = []) {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.slice(-6).map(h => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.text || h.content || ''
      })),
      { role: 'user', content: message }
    ];

    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model: 'openai',
        seed: 42,
        jsonMode: false
      }),
      signal: AbortSignal.timeout(15000)
    });

    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().length > 15) {
        return {
          reply: text.trim(),
          source: 'SilentSOS Neural Inference Engine'
        };
      }
    }
  } catch (e) {
    // Try simple GET query fallback
    try {
      const promptParam = encodeURIComponent(`${SYSTEM_PROMPT}\n\nUser Question: ${message}`);
      const res2 = await fetch(`https://text.pollinations.ai/${promptParam}`, {
        signal: AbortSignal.timeout(6000)
      });
      if (res2.ok) {
        const text2 = await res2.text();
        if (text2 && text2.trim().length > 15) {
          return {
            reply: text2.trim(),
            source: 'SilentSOS Neural Inference Engine'
          };
        }
      }
    } catch (_) {}
  }
  return null;
}

/**
 * 5. Local Ollama Runtime (localhost:11434)
 */
async function tryLocalOllama(message, history = []) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model: 'qwen2.5:latest',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history.slice(-4).map(h => ({ role: h.role, content: h.text || h.content || '' })),
        { role: 'user', content: message }
      ],
      stream: false
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 1500
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed?.message?.content) {
            resolve({
              reply: parsed.message.content.trim(),
              source: 'Local Ollama LLM'
            });
            return;
          }
        } catch (_) {}
        resolve(null);
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Master AI Query Handler
 */
export async function generateAiAssistantReply({ message, history = [], user, settings, contacts = [], location = null }) {
  const cleanMessage = (message || '').trim();
  if (!cleanMessage) {
    return {
      success: false,
      reply: 'Please provide a question or request.',
      suggestions: [
        'Where is the nearest police station?',
        'Where is the nearest hospital?',
        'How does Stealth Mode work in SilentSOS?'
      ]
    };
  }

  console.log(`[AI Engine] Processing user query: "${cleanMessage.slice(0, 80)}" (History turns: ${history.length})`);

  // Instant Priority: Nearby Emergency Facilities (Police Stations & Hospitals)
  const facilityLookup = handleNearbyEmergencyLocations(cleanMessage.toLowerCase(), cleanMessage, location);
  if (facilityLookup.matched) {
    return {
      success: true,
      ...facilityLookup,
      suggestions: facilityLookup.suggestions || deriveSmartSuggestions(cleanMessage, facilityLookup.reply)
    };
  }

  try {
    // 1. Try Configured Gemini API
    const geminiRes = await tryGeminiApi(cleanMessage, history);
    if (geminiRes && geminiRes.reply) {
      return {
        success: true,
        intent: 'cloud_llm_gemini',
        confidence: 99,
        reply: geminiRes.reply,
        suggestions: deriveSmartSuggestions(cleanMessage, geminiRes.reply)
      };
    }

    // 2. Try Configured Groq API
    const groqRes = await tryGroqApi(cleanMessage, history);
    if (groqRes && groqRes.reply) {
      return {
        success: true,
        intent: 'cloud_llm_groq',
        confidence: 99,
        reply: groqRes.reply,
        suggestions: deriveSmartSuggestions(cleanMessage, groqRes.reply)
      };
    }

    // 3. Try Configured OpenAI API
    const openAiRes = await tryOpenAiApi(cleanMessage, history);
    if (openAiRes && openAiRes.reply) {
      return {
        success: true,
        intent: 'cloud_llm_openai',
        confidence: 99,
        reply: openAiRes.reply,
        suggestions: deriveSmartSuggestions(cleanMessage, openAiRes.reply)
      };
    }

    // 4. Try Free High-Performance Neural LLM Engine (Pollinations AI)
    const neuralRes = await tryPollinationsAi(cleanMessage, history);
    if (neuralRes && neuralRes.reply) {
      return {
        success: true,
        intent: 'cloud_neural_inference',
        confidence: 98,
        reply: neuralRes.reply,
        suggestions: deriveSmartSuggestions(cleanMessage, neuralRes.reply)
      };
    }

    // 5. Try Local Ollama LLM
    const localLlmRes = await tryLocalOllama(cleanMessage, history);
    if (localLlmRes && localLlmRes.reply) {
      return {
        success: true,
        intent: 'local_ollama_inference',
        confidence: 95,
        reply: localLlmRes.reply,
        suggestions: deriveSmartSuggestions(cleanMessage, localLlmRes.reply)
      };
    }

    // 6. Comprehensive In-House Cognitive Knowledge Engine (Offline Fallback)
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
        ...localBrainRes,
        suggestions: localBrainRes.suggestions || deriveSmartSuggestions(cleanMessage, localBrainRes.reply)
      };
    }
  } catch (err) {
    console.error('[AI Engine] Execution error:', err);
  }

  // Graceful fallback
  return {
    success: true,
    intent: 'fallback_guidance',
    confidence: 80,
    reply: `I received your question: **"${cleanMessage}"**.\n\n` +
      `I am ready to assist with technical concepts, computer science, physics, and SilentSOS safety controls.\n` +
      `Could you provide a few more details or clarify what specific aspect you would like me to explain?`,
    suggestions: [
      'What is artificial intelligence?',
      'How does GPS tracking work?',
      'What are the features of SilentSOS?'
    ]
  };
}
