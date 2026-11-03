import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCES_DIR = path.join(__dirname, 'sources');
const OUTPUT_MODEL = path.join(__dirname, 'trained_model.json');

// Stopwords list to prune noise while preserving tactical tokens
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

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  const clean = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = clean.split(' ').filter(w => w.length > 1 && !STOPWORDS.has(w));
  return words;
}

function extractBigrams(tokens) {
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return bigrams;
}

export function trainModel() {
  console.log('🤖 Initializing SilentSOS In-House AI Corpus Training...');

  if (!fs.existsSync(SOURCES_DIR)) {
    throw new Error(`Sources directory not found at: ${SOURCES_DIR}`);
  }

  const sourceFiles = fs.readdirSync(SOURCES_DIR).filter(f => f.endsWith('.json'));
  console.log(`📁 Found ${sourceFiles.length} domain knowledge sources.`);

  const documents = [];
  sourceFiles.forEach(file => {
    const raw = fs.readFileSync(path.join(SOURCES_DIR, file), 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach(item => {
        documents.push({
          sourceFile: file,
          ...item
        });
      });
    }
  });

  console.log(`📚 Collected ${documents.length} specialized safety, crisis, and operational knowledge nodes.`);

  // 1. Build Global Vocabulary and Inverted Index
  const vocabulary = new Map(); // token -> term_id
  const docFrequency = new Map(); // token -> count of docs containing token
  const processedDocs = [];

  documents.forEach((doc, docIdx) => {
    // Combine text fields with extra weight on keywords & intent
    const fullText = `${doc.intent} ${(doc.keywords || []).join(' ')} ${(doc.keywords || []).join(' ')} ${doc.summary} ${doc.guidance}`;
    const unigrams = tokenize(fullText);
    const bigrams = extractBigrams(unigrams);
    const allTokens = [...unigrams, ...bigrams];

    const termCounts = new Map();
    allTokens.forEach(token => {
      termCounts.set(token, (termCounts.get(token) || 0) + 1);
      if (!vocabulary.has(token)) {
        vocabulary.set(token, vocabulary.size);
      }
    });

    // Update document frequency
    termCounts.forEach((_, token) => {
      docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
    });

    processedDocs.push({
      id: doc.id,
      intent: doc.intent,
      category: doc.category,
      summary: doc.summary,
      guidance: doc.guidance,
      suggestions: doc.suggestions || [],
      keywords: doc.keywords || [],
      termCounts,
      totalTerms: allTokens.length
    });
  });

  const N = processedDocs.length;
  console.log(`🧠 Vocabulary extracted: ${vocabulary.size} unique semantic unigrams & bigrams across ${N} documents.`);

  // 2. Compute TF-IDF Vectors
  const trainedDocuments = processedDocs.map(doc => {
    const vector = {};
    let magnitudeSq = 0;

    doc.termCounts.forEach((count, token) => {
      const tf = count / doc.totalTerms;
      const df = docFrequency.get(token) || 1;
      const idf = Math.log(1 + (N / df));
      const tfidf = tf * idf;
      vector[token] = tfidf;
      magnitudeSq += tfidf * tfidf;
    });

    const magnitude = Math.sqrt(magnitudeSq) || 1;

    // Normalize vector to unit length for fast cosine similarity via dot product
    const normalizedVector = {};
    Object.keys(vector).forEach(token => {
      normalizedVector[token] = vector[token] / magnitude;
    });

    return {
      id: doc.id,
      intent: doc.intent,
      category: doc.category,
      summary: doc.summary,
      guidance: doc.guidance,
      suggestions: doc.suggestions,
      keywords: doc.keywords,
      vector: normalizedVector
    };
  });

  // 3. Serialize trained model
  const idfTable = {};
  docFrequency.forEach((df, token) => {
    idfTable[token] = Math.log(1 + (N / df));
  });

  const modelOutput = {
    metadata: {
      modelName: 'SilentSOS-Local-Cognitive-Chat-v1',
      trainedAt: new Date().toISOString(),
      numDocuments: N,
      vocabSize: vocabulary.size,
      domains: [...new Set(documents.map(d => d.category))]
    },
    idfTable,
    documents: trainedDocuments
  };

  fs.writeFileSync(OUTPUT_MODEL, JSON.stringify(modelOutput, null, 2), 'utf8');
  console.log(`✅ AI Model successfully compiled and saved to: ${OUTPUT_MODEL}`);
  return modelOutput;
}

// Auto-run if executed directly via node
if (process.argv[1] && process.argv[1].endsWith('train_model.js')) {
  trainModel();
}

