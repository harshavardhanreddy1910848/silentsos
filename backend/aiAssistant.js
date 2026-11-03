/**
 * SilentSOS Local Cognitive AI Defense & Safety Assistant
 * Powered by in-house trained vector search & natural language understanding.
 * Operates 100% locally with zero external API dependencies.
 */

import { queryAiBrain } from './ai/nlp_inference_engine.js';

export function generateAiAssistantReply({ message, history = [], user, settings, contacts = [] }) {
  try {
    return queryAiBrain({
      message,
      history,
      user,
      settings,
      contacts
    });
  } catch (err) {
    console.error('Error generating AI response from trained model:', err);
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
