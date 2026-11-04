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
import { queryAiBrain } from './ai/nlp_inference_engine.js';

const SYSTEM_PROMPT = `You are an intelligent conversational AI assistant integrated into SilentSOS.

Your primary responsibility is to understand the user's actual question and provide a directly relevant, accurate, useful, and understandable answer.

Rules:
- Answer the exact question asked by the user.
- Support questions from different subjects and domains (e.g. computer science, physics, programming, mathematics, cybersecurity, GPS, biology, history, philosophy, general knowledge).
- Do not restrict responses to women's safety or SilentSOS-related topics.
- Do not force every question into a safety-related context.
- Do not generate unrelated information.
- Do not automatically select or answer predefined suggested inquiries.
- Do not repeat previous answers for unrelated questions.
- Understand natural language, spelling mistakes, abbreviations, and differently phrased questions.
- If the question is ambiguous, ask for clarification.
- If you do not know an answer, honestly acknowledge the limitation.
- Provide step-by-step explanations when requested.
- Use examples when they improve understanding.
- Maintain conversation context for relevant follow-up questions.
- Do not allow previous conversation topics to override a new unrelated question.
- Keep responses organized, readable, and relevant using GitHub-flavored markdown.

For SilentSOS-specific questions, use the application's verified documentation and functionality:
- SilentSOS is a rapid-response personal safety platform consisting of a React Web App and Kotlin Android Native App.
- Core Features:
  * Emergency SOS Dispatch: Instant trigger via central button (3s hold) or rapid device shake.
  * Covert Optical Gesture Detection: Uses front camera to detect hand palm raising or eye blink patterns to silently trigger alarms.
  * Auto-Capture Surveillance: Automatic photo burst (3-10 photos), HD rolling video loop, and ambient stereo microphone audio recording.
  * Automated Multi-Media Evidence Dispatch: Dispatches email evidence package containing photos, video, audio, and live reverse-geocoded GPS coordinates to emergency guardian contacts.
  * Live Receiver Portal: Allows authorized contacts to track user location on Google Maps in real-time.
  * Stealth Mode: Disguises screen or turns it black while continuing background GPS tracking and surveillance.
  * Safety PIN: 4-digit security PIN required to cancel active alarms.
  * Fake Call Simulator: Generates realistic incoming call screen to exit risky social situations discreetly.
  * Admin Governance: Dashboard for monitoring active alerts, users, feedback, and telemetry metrics.

For general questions, provide general-purpose AI assistance.
Never invent application features or claim to perform actions that are not implemented.`;

/**
 * Generates 2-3 smart, contextually relevant follow-up questions based on the topic.
 */
function deriveSmartSuggestions(query, answer) {
  const q = query.toLowerCase();
  
  if (q.includes('artificial intelligence') || q.includes(' ai ') || q.startsWith('ai ') || q.includes('machine learning')) {
    return [
      'How does machine learning differ from deep learning?',
      'How does SilentSOS use computer vision for gesture detection?',
      'What are neural networks?'
    ];
  }
  if (q.includes('python')) {
    return [
      'Explain Python asyncio with a practical code example',
      'What is the difference between lists and tuples in Python?',
      'How do Python decorators work?'
    ];
  }
  if (q.includes('cybersecurity') || q.includes('cyber security') || q.includes('encryption')) {
    return [
      'How does end-to-end encryption protect data?',
      'What are the most common OWASP security vulnerabilities?',
      'How does two-factor authentication work?'
    ];
  }
  if (q.includes('gps') || q.includes('location') || q.includes('tracking')) {
    return [
      'What is the difference between GPS and Assisted GPS (A-GPS)?',
      'How does SilentSOS broadcast live GPS coordinates to guardians?',
      'How does trilateration calculate receiver coordinates?'
    ];
  }
  if (q.includes('newton') || q.includes('physics') || q.includes('force') || q.includes('law of motion')) {
    return [
      'Explain Newton\'s First Law of Motion with an example',
      'Explain Newton\'s Third Law of Motion (action-reaction)',
      'How does friction affect acceleration?'
    ];
  }
  if (q.includes('silentsos') || q.includes('app') || q.includes('feature') || q.includes('purpose')) {
    return [
      'How does Covert Gesture Detection work?',
      'How does Auto-Capture Surveillance record evidence?',
      'How does Stealth Mode work in SilentSOS?'
    ];
  }
  if (q.includes('follow') || q.includes('stalk') || q.includes('danger') || q.includes('unsafe')) {
    return [
      'What should I do if they don\'t stop following me?',
      'How do I activate SilentSOS Stealth Mode quietly?',
      'What is a Zero FIR under Indian law?'
    ];
  }
  if (q.includes('travel') || q.includes('solo') || q.includes('trip') || q.includes('hotel')) {
    return [
      'What about travelling at night?',
      'What precautions should I take when taking a taxi or cab alone?',
      'How do I share live tracking with emergency contacts?'
    ];
  }

  // Dynamic contextual questions
  return [
    `Can you give a practical example of this?`,
    `What are the key advantages and drawbacks?`,
    `How does this apply in modern real-world scenarios?`
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
export async function generateAiAssistantReply({ message, history = [], user, settings, contacts = [] }) {
  const cleanMessage = (message || '').trim();
  if (!cleanMessage) {
    return {
      success: false,
      reply: 'Please provide a question or request.',
      suggestions: [
        'What is artificial intelligence?',
        'How does GPS tracking work?',
        'What are the features of SilentSOS?'
      ]
    };
  }

  console.log(`[AI Engine] Processing user query: "${cleanMessage.slice(0, 80)}" (History turns: ${history.length})`);

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
      contacts
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
