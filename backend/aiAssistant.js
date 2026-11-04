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
import { searchOnlineKnowledge, synthesizeOnlineResponse, isWebSearchCategory } from './ai/online_search_service.js';

const SYSTEM_PROMPT = `You are the SilentSOS Emergency, Medical & Personal Safety AI Assistant powered by local Ollama llama3.2 inference.

You specialize strictly in these THREE mission-critical areas:
1. MEDICAL ASSISTANCE:
   - First aid information (hands-only CPR, choking Heimlich maneuver, severe bleeding control, burn treatment, trauma triage).
   - Basic medical emergency response and health awareness.
   - Clear medical boundary: You are an emergency safety assistant, not a doctor. Never diagnose medical conditions or prescribe medication. Direct users to call 108/112 or consult certified healthcare professionals.

2. WOMEN'S PROTECTION:
   - Women's personal defense, stalking evasion, solo and night travel precautions.
   - Harassment support, anti-eve-teasing protocols, domestic abuse resources (181 helpline, NCW support).
   - Legal protections in India: Section 173 of BNSS (Zero FIR: mandatory registration by any police station nationwide), Women's Helpline (1091), Universal Emergency (112).

3. PERSONAL SAFETY & SILENTSOS CONTROLS:
   - Emergency preparedness, accident response, de-escalation in threatening social situations.
   - SilentSOS Platform Features:
     • SOS Dispatch: 3-second hold on central SOS button or rapid phone shake.
     • Covert Optical Gestures: Front-camera Palm Raise (1.5s) or 3-Blink eye pattern for silent hands-free triggers.
     • Auto-Capture Surveillance: Dual photo burst, rolling 1080p continuous video loop, ambient microphone audio.
     • Automated Evidence Dispatch: Dispatches email evidence package (photos, video, audio, reverse-geocoded GPS) to emergency contacts.
     • Live Receiver Portal: Real-time Google Maps telemetry link for trusted guardian contacts.
     • Stealth Mode: Black-screen disguise while silently maintaining GPS broadcasting and surveillance recording.
     • Safety PIN: 4-digit security PIN (default: 1234) required to cancel active alarms.
     • Fake Call: Realistic incoming call screen to exit risky or uncomfortable social situations.

Rules & Guidelines:
- Prioritize immediate personal safety and life-saving first aid above all else.
- Maintain a calm, empathetic, and decisive tone.
- Format responses cleanly with GitHub-flavored markdown.
- For immediate emergencies, provide basic safety instructions without waiting.
- When verified live online facts are provided in [VERIFIED LIVE ONLINE SEARCH FACTS]:
  1. Clearly distinguish facts from AI advice by formatting into two distinct sections:
     🌐 **Verified Online Information:**
     [Summarize the factual online findings from official sources clearly and accurately]
     
     🛡️ **Safety Guidance & Action Steps:**
     [Provide practical emergency precautions, step-by-step guidance, and SilentSOS protections]
  2. Display verified source names and clickable markdown links at the end under:
     ---
     📌 **Verified Official Sources:**
     • [Source Name - Title](URL)
  3. NEVER invent, alter, or hallucinate sources, URLs, medical facts, or emergency numbers.
- If web search is offline, provide guidance using local knowledge and state:
  > ⚠️ **Notice:** Real-time web search is currently offline. The following guidance is based on local knowledge and may not reflect the most recent real-time updates.`;

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
async function tryGeminiApi(message, history = [], groundingPrompt = '') {
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

    const systemText = groundingPrompt ? `${SYSTEM_PROMPT}\n\n${groundingPrompt}` : SYSTEM_PROMPT;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemText }] },
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
async function tryGroqApi(message, history = [], groundingPrompt = '') {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const systemContent = groundingPrompt ? `${SYSTEM_PROMPT}\n\n${groundingPrompt}` : SYSTEM_PROMPT;
    const messages = [
      { role: 'system', content: systemContent },
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
async function tryOpenAiApi(message, history = [], groundingPrompt = '') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const systemContent = groundingPrompt ? `${SYSTEM_PROMPT}\n\n${groundingPrompt}` : SYSTEM_PROMPT;
    const messages = [
      { role: 'system', content: systemContent },
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
async function tryPollinationsAi(message, history = [], groundingPrompt = '') {
  try {
    const systemContent = groundingPrompt ? `${SYSTEM_PROMPT}\n\n${groundingPrompt}` : SYSTEM_PROMPT;
    const messages = [
      { role: 'system', content: systemContent },
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
      const systemContent = groundingPrompt ? `${SYSTEM_PROMPT}\n\n${groundingPrompt}` : SYSTEM_PROMPT;
      const promptParam = encodeURIComponent(`${systemContent}\n\nUser Question: ${message}`);
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
/**
 * 5. Primary Engine: Local Ollama Runtime (localhost:11434, llama3.2)
 * Connects directly to the user's locally installed Ollama instance without paid APIs.
 */
async function tryLocalOllama(message, history = [], groundingPrompt = '') {
  const host = process.env.OLLAMA_HOST || '127.0.0.1';
  const port = process.env.OLLAMA_PORT || 11434;
  const model = process.env.OLLAMA_MODEL || 'llama3.2';

  const systemContent = groundingPrompt ? `${SYSTEM_PROMPT}\n\n${groundingPrompt}` : SYSTEM_PROMPT;
  const messages = [
    { role: 'system', content: systemContent },
    ...history.slice(-6).map(h => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: h.text || h.content || ''
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
          const reply = parsed?.message?.content;
          if (reply && reply.trim()) {
            resolve({
              reply: reply.trim(),
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
 * Detects whether the query specifically inquires about our SilentSOS app,
 * its features, architecture, or how it works across Web and Android.
 */
export function isAppOverviewQuery(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase().trim();
  const patterns = [
    'how it works',
    'how does it work',
    'how does this work',
    'how do you work',
    'how does the app work',
    'how does our app work',
    'how our app works',
    'tell me about our app',
    'tell me about the app',
    'explain our app',
    'explain the app',
    'what is this app',
    'what is our app',
    'what does this app do',
    'how to use this app',
    'how to use our app',
    'how does silentsos work',
    'features of silentsos',
    'how does it work in android and web',
    'how does android app work',
    'how does web app work',
    'what is silentsos',
    'purpose of silentsos',
    'about silentsos',
    'what can this app do',
    'how does the system work',
    'app features',
    'app details',
    'how to trigger alert'
  ];
  return patterns.some(p => q.includes(p)) || q === 'silentsos' || q === 'app' || q === 'our app';
}

/**
 * Detects whether the query belongs to the core SilentSOS domain
 * (App features, emergency triggers, medical first aid, legal rights, or safety de-escalation).
 */
export function isAppOrSafetyQuery(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase().trim();
  const keywords = [
    'silentsos', 'silent sos', 'our app', 'this app', 'how it works', 'how does it work', 'how to use',
    'sos', 'stealth', 'gesture', 'palm', 'blink', 'auto capture', 'surveillance',
    'photo burst', 'video loop', 'audio record', 'microphone', 'evidence', 'vault',
    'gps', 'tracking', 'location', 'coordinates', 'pin', 'fake call',
    'police', 'hospital', 'doctor', 'ambulance', '112', '1091', '108', '181', 'zero fir', 'fir',
    'cpr', 'choking', 'heimlich', 'bleeding', 'bleed', 'burn', 'burns', 'first aid', 'cardiac', 'chest compression',
    'following me', 'followed', 'stalk', 'stalking', 'danger', 'unsafe', 'threat', 'help me', 'emergency',
    'solo travel', 'travel', 'travelling', 'traveling', 'night travel', 'cab', 'taxi', 'hotel', 'harass', 'harassment',
    'guardian', 'guardians', 'contact', 'contacts', 'receiver', 'anti-tamper', 'women safety', 'women\'s safety'
  ];
  return keywords.some(kw => q.includes(kw));
}

/**
 * Detects whether the user explicitly asked for links or sources.
 */
export function userExplicitlyAskedForLinks(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase();
  return q.includes('link') || q.includes('url') || q.includes('source') || q.includes('website') || q.includes('where can i read') || q.includes('provide the link') || q.includes('show link');
}

/**
 * Strips URLs and markdown links from the reply if user didn't ask for links.
 */
export function stripOnlineLinksIfUnrequested(text, wantsLinks) {
  if (wantsLinks || !text || typeof text !== 'string') return text;
  return text
    // Replace markdown links [Anchor Text](http://...) with just Anchor Text
    .replace(/\[([^\]]+)\]\(https?:\/\/[^\)]+\)/g, '$1')
    // Remove bare URLs
    .replace(/https?:\/\/[^\s\)]+/g, '')
    // Remove trailing Reference Sources / Links sections
    .replace(/(?:###\s*(?:🔗|Verified)?\s*(?:Online Reference Sources|Reference Links|Reference Sources|Sources)[\s\S]*?$)/gi, '')
    .trim();
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
        'How does SilentSOS work in Android and Web?',
        'Where is the nearest police station?',
        'Where is the nearest hospital?'
      ]
    };
  }

  const lowerMsg = cleanMessage.toLowerCase();
  const wantsLinks = userExplicitlyAskedForLinks(cleanMessage);
  console.log(`[AI Engine] Processing user query: "${cleanMessage.slice(0, 80)}" (History turns: ${history.length}, WantsLinks: ${wantsLinks})`);

  // 0. Immediate Crisis & Life-Threatening Danger Check (Respond immediately without waiting for AI generation)
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
      reply: `🚨 **IMMEDIATE EMERGENCY SAFETY PROTOCOL:**\n\n` +
        `1. **Call Emergency Services NOW:** Dial **112** (Universal Emergency) or **100 / 1091** (Women's Helpline).\n` +
        `2. **Trigger SilentSOS Alarm:** Press and hold the glowing central SOS button for 3 seconds or rapidly shake your phone 3 times.\n` +
        `3. **Lock Yourself In or Escape:** Barricade doors, turn off lights, or move immediately toward well-lit public areas.\n` +
        `4. **Activate Stealth Mode:** If an aggressor is nearby, enable Stealth Mode to keep your screen dark while satellite GPS and audio recording stream to your guardians.\n\n` +
        `*Do not attempt to confront an aggressor. Focus on physical safety and summoning emergency responders.*`,
      suggestions: [
        'How to call 112 emergency dispatch?',
        'How does SilentSOS Stealth Mode work?',
        'Where is the nearest police station?'
      ]
    };
  }

  // 1. Instant Priority: Nearby Emergency Facilities (Police Stations & Hospitals)
  const facilityLookup = handleNearbyEmergencyLocations(lowerMsg, cleanMessage, location);
  if (facilityLookup.matched) {
    return {
      success: true,
      ...facilityLookup,
      suggestions: facilityLookup.suggestions || deriveSmartSuggestions(cleanMessage, facilityLookup.reply)
    };
  }

  // 2. FIRST PREFERENCE FOR OUR APP & HOW IT WORKS:
  // If user inquires about our app, how it works, what it does, or how it operates across Web & Android:
  const isAppHowItWorks = isAppOverviewQuery(cleanMessage);
  if (isAppHowItWorks) {
    const appBrainRes = queryAiBrain({
      message: cleanMessage,
      history,
      user,
      settings,
      contacts,
      location
    });
    if (appBrainRes && appBrainRes.reply) {
      return {
        success: true,
        ...appBrainRes,
        onlineFetched: false,
        sources: [],
        suggestions: appBrainRes.suggestions || [
          'How does Stealth Mode work in SilentSOS?',
          'How does Auto-Capture Surveillance record evidence?',
          'Where is the nearest police station?'
        ]
      };
    }
  }

  // 3. Online Grounding Search (Web search for Medical, Women's Protection, Helplines & Public Safety)
  const needsWebSearch = isWebSearchCategory(cleanMessage);
  let onlineData = null;
  let groundingPrompt = '';
  let isOfflineNoticeNeeded = false;

  if (needsWebSearch) {
    try {
      onlineData = await searchOnlineKnowledge(cleanMessage);
      if (onlineData?.hasOnlineData && onlineData?.groundingPrompt) {
        groundingPrompt = onlineData.groundingPrompt;
      } else if (onlineData?.offline) {
        isOfflineNoticeNeeded = true;
        groundingPrompt = `\n[NOTICE: Real-time internet search is currently offline or unreachable. Use local offline knowledge base. Prominently state to the user: '> ⚠️ **Notice:** Real-time web search is currently offline. The following guidance is based on local knowledge and may not reflect the most recent real-time updates.']`;
      }
    } catch (searchErr) {
      console.warn('[AI Engine] Online search pipeline skipped:', searchErr.message);
      isOfflineNoticeNeeded = true;
      groundingPrompt = `\n[NOTICE: Real-time internet search is currently offline or unreachable. Use local offline knowledge base. Prominently state to the user: '> ⚠️ **Notice:** Real-time web search is currently offline. The following guidance is based on local knowledge and may not reflect the most recent real-time updates.']`;
    }
  }

  const onlineSources = (onlineData?.hasOnlineData && onlineData?.sources)
    ? onlineData.sources
    : [];

  try {
    // 4. PRIMARY INFERENCE ENGINE: Local Ollama llama3.2
    // Secure internal integration (Windows 11 host @ http://127.0.0.1:11434)
    const localLlmRes = await tryLocalOllama(cleanMessage, history, groundingPrompt);
    if (localLlmRes && localLlmRes.reply) {
      let finalReply = localLlmRes.reply;

      // Ensure offline notice is present if internet search was requested but offline
      if (isOfflineNoticeNeeded && !finalReply.includes('Real-time web search is currently offline')) {
        finalReply = `> ⚠️ **Notice:** Real-time web search is currently offline. The following guidance is based on local knowledge and may not reflect the most recent real-time updates.\n\n` + finalReply;
      }

      // If online sources were retrieved and Ollama didn't format the links at the end, append them
      if (onlineSources.length > 0 && !finalReply.includes('Verified Official Sources')) {
        let sourcesBlock = `\n\n---\n📌 **Verified Official Sources:**\n`;
        onlineSources.forEach(s => {
          sourcesBlock += `• [${s.source} - ${s.title}](${s.url})\n`;
        });
        finalReply += sourcesBlock;
      }

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
          finalReply = `${finalReply}\n\n---\n📋 **Immediate Bystander First Aid Protocol (Emergency Guidance):**\n${brainRes.reply}`;
        }
      }

      return {
        success: true,
        intent: onlineSources.length > 0 ? 'local_ollama_web_grounded' : 'local_ollama_llama3_2',
        confidence: 98,
        reply: finalReply,
        source: localLlmRes.source || 'Local Ollama (llama3.2)',
        model: localLlmRes.model || 'llama3.2',
        onlineFetched: onlineSources.length > 0,
        sources: onlineSources,
        suggestions: deriveSmartSuggestions(cleanMessage, finalReply)
      };
    }

    // 5. SECONDARY FALLBACK: Direct Online Knowledge Synthesis (if Ollama paused and online data available)
    if (onlineData) {
      const onlineSynthesized = synthesizeOnlineResponse(cleanMessage, onlineData);
      if (onlineSynthesized && onlineSynthesized.reply) {
        return onlineSynthesized;
      }
    }

    // 6. TERTIARY FALLBACK: Comprehensive In-House Cognitive Knowledge Engine (Offline Emergency Core)
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
        onlineFetched: false,
        sources: [],
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
