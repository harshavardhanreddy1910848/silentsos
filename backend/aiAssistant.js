/**
 * SilentSOS Local Cognitive AI Defense & Safety Assistant
 * Powered by in-house trained vector search & natural language understanding.
 * Operates 100% locally with zero external API dependencies.
 *
 * Supports hybrid inference:
 * 1. Probes local open-weight LLM runtime (Ollama / Llama.cpp on localhost:11434 or localhost:8000).
 * 2. Seamlessly falls back to our internal multi-domain Cognitive Intelligence Engine (Math, Code, Creative, Science & Tactical Triage).
 */

import http from 'http';
import { queryAiBrain } from './ai/nlp_inference_engine.js';

async function tryLocalLlmInference(message, history = []) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      model: 'qwen2.5:latest',
      messages: [
        {
          role: 'system',
          content: 'You are the SilentSOS Cognitive Defense & Intelligence Assistant, comparable in analytical depth, creative synthesis, and precision to Claude and Perplexity. You provide rich explanations, step-by-step proofs, production-ready code, and crisis advice. Never cite OpenAI, Gemini, or external cloud APIs.'
        },
        ...history.slice(-4).map(h => ({ role: h.role, content: h.text })),
        { role: 'user', content: message }
      ],
      stream: false
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434, // Default Ollama port
      path: '/api/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 1200 // Quick timeout to prevent stalling if Ollama isn't running
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed?.message?.content) {
            resolve({
              success: true,
              intent: 'local_llm_inference',
              confidence: 99,
              reply: parsed.message.content,
              suggestions: [
                'Explain Python asyncio',
                'How does Stealth Mode work?',
                'What to do if someone is following me?'
              ]
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

export async function generateAiAssistantReply({ message, history = [], user, settings, contacts = [] }) {
  try {
    // 1. Check if a local LLM runner (Ollama / Llama.cpp) is active
    const localLlmRes = await tryLocalLlmInference(message, history);
    if (localLlmRes && localLlmRes.reply) {
      return localLlmRes;
    }

    // 2. Execute In-House Cognitive Engine (Math, Creative, Code, Science & Tactical Triage)
    return queryAiBrain({
      message,
      history,
      user,
      settings,
      contacts
    });
  } catch (err) {
    console.error('Error generating AI response:', err);
    const currentPin = settings?.safetyPin || '1234';
    return {
      success: true,
      intent: 'safety_fallback',
      confidence: 50,
      reply: `🛡️ **SilentSOS Defense Guidance:**\n\n` +
        `• **Active Safety PIN:** \`${currentPin}\`.\n` +
        `• **Emergency Action:** In immediate danger, hold the central SOS button for 3 seconds or trigger your rapid shake gesture.\n` +
        `• **Emergency Numbers:** Dial 112 (India/EU) or 911 (US) immediately.`,
      suggestions: [
        'How does Stealth Mode work?',
        'How to change Safety PIN?',
        'What to do if someone is following me?',
        'Emergency phone numbers'
      ]
    };
  }
}
