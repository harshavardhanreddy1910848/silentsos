import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_PATH = path.join(__dirname, 'trained_model.json');

// Stopwords list matching the trainer
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves'
]);

let cachedModel = null;

function loadModel() {
  if (cachedModel) return cachedModel;
  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error(`Trained model file not found at ${MODEL_PATH}. Run train_model.js first.`);
  }
  const raw = fs.readFileSync(MODEL_PATH, 'utf8');
  cachedModel = JSON.parse(raw);
  return cachedModel;
}

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  const clean = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.split(' ').filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function extractBigrams(tokens) {
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return bigrams;
}

/**
 * Predicts the best-matching intent and knowledge record from user input using
 * TF-IDF cosine vector matching + n-gram keyword boosting + conversational context.
 */
export function queryAiBrain({ message, history = [], user, settings, contacts = [] }) {
  const model = loadModel();
  const rawQuery = (message || '').trim();
  const lowerQuery = rawQuery.toLowerCase();

  // Multi-turn context resolution: if user query is short ("how do I change it?", "what is the default?"),
  // prepend previous assistant context for disambiguation
  let contextAugmented = lowerQuery;
  if (lowerQuery.length < 25 && Array.isArray(history) && history.length > 0) {
    const lastExchange = history.slice(-2).map(h => h.text || h.content || '').join(' ');
    contextAugmented = `${lastExchange} ${lowerQuery}`;
  }

  const queryTokens = tokenize(contextAugmented);
  const queryBigrams = extractBigrams(queryTokens);
  const allTokens = [...queryTokens, ...queryBigrams];

  // Build query TF-IDF vector
  const queryVector = {};
  const tokenCounts = {};
  allTokens.forEach(t => {
    tokenCounts[t] = (tokenCounts[t] || 0) + 1;
  });

  let qMagSq = 0;
  Object.keys(tokenCounts).forEach(token => {
    const idf = model.idfTable[token] || 0.5; // smoothing for OOV
    const tf = tokenCounts[token] / allTokens.length;
    const tfidf = tf * idf;
    queryVector[token] = tfidf;
    qMagSq += tfidf * tfidf;
  });

  const qMag = Math.sqrt(qMagSq) || 1;
  Object.keys(queryVector).forEach(t => {
    queryVector[t] = queryVector[t] / qMag;
  });

  // Calculate scores across all trained documents
  const scoredDocs = model.documents.map(doc => {
    let dotProduct = 0;
    Object.keys(queryVector).forEach(token => {
      if (doc.vector[token]) {
        dotProduct += queryVector[token] * doc.vector[token];
      }
    });

    // Exact keyword density bonus
    let keywordBonus = 0;
    if (Array.isArray(doc.keywords)) {
      doc.keywords.forEach(kw => {
        if (lowerQuery.includes(kw.toLowerCase())) {
          keywordBonus += 0.35;
        }
      });
    }

    const finalScore = dotProduct + keywordBonus;
    return {
      doc,
      score: finalScore
    };
  });

  scoredDocs.sort((a, b) => b.score - a.score);
  const bestMatch = scoredDocs[0];

  // Dynamic context injection variables
  const currentPin = settings?.safetyPin || '1234';
  const isStealthActive = !!settings?.stealthMode;
  const contactsCount = contacts?.length || 0;
  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  // Format Claude-style responses
  if (bestMatch && bestMatch.score > 0.15) {
    let responseText = bestMatch.doc.guidance;

    // Personalize with real system state
    if (bestMatch.doc.intent === 'silentsos_safety_pin') {
      responseText = `🔒 **Safety PIN Security Protocol:**\n\n` +
        `• **Your Active PIN:** Currently configured as **\`${currentPin}\`** (Default: \`1234\`).\n` +
        `• **How to Change It:** Go to **Settings → Security & PIN → Change PIN** (or in Android: **Settings → Change Safety PIN**). Enter your current PIN, then select a new 4-digit code.\n` +
        `• **Why it's Crucial:** Once an SOS alert is triggered, an attacker cannot stop or silence your beacon without this PIN. This guarantees evidence capture and emergency notifications cannot be covertly disarmed.`;
    } else if (bestMatch.doc.intent === 'silentsos_stealth_mode') {
      responseText = `🕶️ **Stealth Mode & Tactical Disguise:**\n\n` +
        `• **Current Status:** Stealth mode is **${isStealthActive ? 'ENABLED 🟢' : 'DISABLED ⚪'}**.\n` +
        `• **How it Protects You:** Displays an authentic blacked-out, inactive screen disguise while SilentSOS continues high-accuracy GPS tracking, front/rear camera photo bursts, and continuous ambient microphone recording in the background.\n` +
        `• **Toggle:** Enable or disable it directly in **Settings → Stealth & Disguise** or tap the Stealth switch on your SOS Hub.`;
    } else if (bestMatch.doc.intent === 'silentsos_contacts_resend') {
      responseText = `👥 **Emergency Contacts & Automated Dispatch Pipeline:**\n\n` +
        `• **Active Guardians:** You currently have **${contactsCount} trusted contact(s)** enrolled.\n` +
        `• **Dispatch Flow:** When an SOS is armed, contacts immediately receive an SMS with Google Maps coordinates and an automated Resend email with your live tracking URL and recorded media.\n` +
        `• **Verification:** Go to **Settings → Resend Alert Notifications** and click **Send Test Alert Notification** to confirm email delivery.`;
    }

    return {
      success: true,
      intent: bestMatch.doc.intent,
      category: bestMatch.doc.category,
      confidence: Math.min(Math.round(bestMatch.score * 100), 99),
      reply: responseText,
      suggestions: bestMatch.doc.suggestions || [
        'How does Stealth Mode work?',
        'How to change Safety PIN?',
        'What to do if someone is following me?',
        'Emergency phone numbers'
      ]
    };
  }

  // Fallback Claude-like intelligent conversational response
  return {
    success: true,
    intent: 'general_fallback',
    confidence: 65,
    reply: `👋 Hello ${userName}! I am your **SilentSOS AI Defense Assistant**.\n\n` +
      `I am an in-house cognitive safety guide trained on tactical defense, medical first aid, emergency helplines, and device security—operating 100% locally with complete privacy.\n\n` +
      `**Here are key safety topics you can ask me about:**\n` +
      `• *"How does Stealth Mode work?"*\n` +
      `• *"How do I change my safety PIN?"*\n` +
      `• *"What should I do if someone is following me?"*\n` +
      `• *"How do I perform CPR?"*\n` +
      `• *"What are the official emergency numbers?"*`,
    suggestions: [
      'How does Stealth Mode work?',
      'How to change Safety PIN?',
      'What to do if followed?',
      'Emergency numbers directory'
    ]
  };
}

