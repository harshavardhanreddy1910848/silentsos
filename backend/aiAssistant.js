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
import { searchOnlineKnowledge, synthesizeOnlineResponse } from './ai/online_search_service.js';

const SYSTEM_PROMPT = `You are the SilentSOS Emergency, Medical & Personal Safety AI Assistant.

SYSTEM INSTRUCTION & PREFERENCE HIERARCHY:
1. FIRST PREFERENCE FOR OUR APP & HOW IT WORKS:
   If the user asks about our application, how it works, what it does, its features, or how it operates across Web and Android:
   GIVE ABSOLUTE FIRST PREFERENCE to explaining our SilentSOS platform and how it works step-by-step in BOTH the Android Mobile Application and the Web Application.
   Detail:
   - Android Native Application: SOS button (3s hold), accelerometer shake trigger, covert optical palm raise and eye blink gestures, auto-capture surveillance (photo bursts, 1080p video loop, microphone audio), automated evidence email dispatch, stealth mode black screen disguise, 4-digit PIN anti-tamper disarm, and fake call escape simulator.
   - Web Application: Live guardian receiver portal on Google Maps, emergency SOS dispatch console, AI defense assistant, evidence vault, emergency contacts management.
   - End-to-end emergency flow: Trigger -> Auto-Capture -> Email Dispatch -> Live Google Maps Tracking -> PIN Resolution.

2. FIRST PREFERENCE FOR OUT-OF-RANGE TOPICS (LIVE ONLINE RETRIEVAL):
   If the user asks a question that is OUT OF RANGE (general knowledge, science, programming, history, math, weather, or everyday topics outside SilentSOS/safety/medical):
   GIVE FIRST PREFERENCE to fetching and synthesizing verified LIVE ONLINE facts.
   Analyze the retrieved facts thoroughly and give the user a clear, comprehensive answer explaining the topic.
   CRITICAL LINK RULE: DO NOT provide, include, or cite URLs or links from online in your response UNLESS the user explicitly asks for links or sources (e.g. "give me the link", "share sources", "provide link"). If the user did NOT ask for links, analyze the online facts and provide a direct, informative answer without any links or URLs.

Rules:
- Prioritize immediate personal safety and life-saving first aid above all else.
- Maintain a calm, empathetic, and decisive tone.
- Do not invent application features; stick strictly to SilentSOS capabilities and verified medical/emergency protocols.
- For queries related to SilentSOS, emergency medical care, or personal defense, provide direct, step-by-step actionable advice.
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
async function tryLocalOllama(message, history = [], groundingPrompt = '') {
  return new Promise((resolve) => {
    const systemContent = groundingPrompt ? `${SYSTEM_PROMPT}\n\n${groundingPrompt}` : SYSTEM_PROMPT;
    const payload = JSON.stringify({
      model: 'qwen2.5:latest',
      messages: [
        { role: 'system', content: systemContent },
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

  // 3. Determine if query is in-range (Safety/Medical/SilentSOS Controls) vs OUT OF RANGE (External/General Knowledge)
  const isInRangeSafetyOrMedical = isAppOrSafetyQuery(cleanMessage);

  // If in-range (specific safety evasion, medical first aid, or SilentSOS telemetry):
  // Check our specialized internal brain first
  if (isInRangeSafetyOrMedical) {
    const directBrainRes = queryAiBrain({
      message: cleanMessage,
      history,
      user,
      settings,
      contacts,
      location
    });

    if (directBrainRes && directBrainRes.reply && directBrainRes.intent !== 'conversational_empathy') {
      return {
        success: true,
        ...directBrainRes,
        onlineFetched: false,
        sources: [],
        suggestions: directBrainRes.suggestions || deriveSmartSuggestions(cleanMessage, directBrainRes.reply)
      };
    }
  }

  // 4. FIRST PREFERENCE FOR OUT-OF-RANGE TOPICS: LIVE ONLINE WEB RETRIEVAL
  // If the query is out-of-range, search online first
  let onlineData = null;
  let groundingPrompt = '';
  try {
    onlineData = await searchOnlineKnowledge(cleanMessage);
    if (onlineData?.groundingPrompt) {
      groundingPrompt = onlineData.groundingPrompt;
    }
  } catch (searchErr) {
    console.warn('[AI Engine] Online search pipeline skipped:', searchErr.message);
  }

  const onlineSources = wantsLinks && onlineData?.results
    ? onlineData.results.map(r => ({ title: r.title, url: r.url, source: r.source }))
    : [];

  try {
    // A. Try Configured Gemini API
    const geminiRes = await tryGeminiApi(cleanMessage, history, groundingPrompt);
    if (geminiRes && geminiRes.reply) {
      const cleanReply = stripOnlineLinksIfUnrequested(geminiRes.reply, wantsLinks);
      return {
        success: true,
        intent: 'cloud_llm_gemini',
        confidence: 99,
        reply: cleanReply,
        onlineFetched: !!onlineData,
        sources: onlineSources,
        suggestions: deriveSmartSuggestions(cleanMessage, cleanReply)
      };
    }

    // B. Try Configured Groq API
    const groqRes = await tryGroqApi(cleanMessage, history, groundingPrompt);
    if (groqRes && groqRes.reply) {
      const cleanReply = stripOnlineLinksIfUnrequested(groqRes.reply, wantsLinks);
      return {
        success: true,
        intent: 'cloud_llm_groq',
        confidence: 99,
        reply: cleanReply,
        onlineFetched: !!onlineData,
        sources: onlineSources,
        suggestions: deriveSmartSuggestions(cleanMessage, cleanReply)
      };
    }

    // C. Try Configured OpenAI API
    const openAiRes = await tryOpenAiApi(cleanMessage, history, groundingPrompt);
    if (openAiRes && openAiRes.reply) {
      const cleanReply = stripOnlineLinksIfUnrequested(openAiRes.reply, wantsLinks);
      return {
        success: true,
        intent: 'cloud_llm_openai',
        confidence: 99,
        reply: cleanReply,
        onlineFetched: !!onlineData,
        sources: onlineSources,
        suggestions: deriveSmartSuggestions(cleanMessage, cleanReply)
      };
    }

    // D. Try Free High-Performance Neural LLM Engine (Pollinations AI)
    const neuralRes = await tryPollinationsAi(cleanMessage, history, groundingPrompt);
    if (neuralRes && neuralRes.reply) {
      const cleanReply = stripOnlineLinksIfUnrequested(neuralRes.reply, wantsLinks);
      return {
        success: true,
        intent: 'cloud_neural_inference',
        confidence: 98,
        reply: cleanReply,
        onlineFetched: !!onlineData,
        sources: onlineSources,
        suggestions: deriveSmartSuggestions(cleanMessage, cleanReply)
      };
    }

    // E. Try Local Ollama LLM
    const localLlmRes = await tryLocalOllama(cleanMessage, history, groundingPrompt);
    if (localLlmRes && localLlmRes.reply) {
      const cleanReply = stripOnlineLinksIfUnrequested(localLlmRes.reply, wantsLinks);
      return {
        success: true,
        intent: 'local_ollama_inference',
        confidence: 95,
        reply: cleanReply,
        onlineFetched: !!onlineData,
        sources: onlineSources,
        suggestions: deriveSmartSuggestions(cleanMessage, cleanReply)
      };
    }

    // F. Direct Online Knowledge Synthesis (When LLMs are offline or unreachable)
    if (onlineData) {
      const onlineSynthesized = synthesizeOnlineResponse(cleanMessage, onlineData);
      if (onlineSynthesized && onlineSynthesized.reply) {
        return onlineSynthesized;
      }
    }

    // G. Comprehensive In-House Cognitive Knowledge Engine (Offline Fallback)
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
