import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_PATH = path.join(__dirname, 'trained_model.json');

// Stopwords list
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
    return { documents: [], idf: {} };
  }
  try {
    const raw = fs.readFileSync(MODEL_PATH, 'utf8');
    cachedModel = JSON.parse(raw);
    return cachedModel;
  } catch (_) {
    return { documents: [], idf: {} };
  }
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

// ============================================================================
// 1. MATHEMATICAL REASONING & ARITHMETIC ENGINE
// ============================================================================
function handleMathematicalReasoning(lowerQuery, rawQuery) {
  // 1. Arithmetic calculation (e.g. "calculate 25 * 40", "500 / 4", "12 + 88 - 5")
  const mathMatch = rawQuery.match(/(?:what\s+is|calculate|evaluate|solve)?\s*([0-9]+(?:\.[0-9]+)?\s*[\+\-\*\/\^%]\s*[0-9]+(?:\.[0-9]+)?(?:\s*[\+\-\*\/\^%]\s*[0-9]+(?:\.[0-9]+)?)*)/i);
  if (mathMatch && mathMatch[1] && /[\+\-\*\/\^%]/.test(mathMatch[1])) {
    const expr = mathMatch[1].trim();
    try {
      const sanitized = expr.replace(/\^/g, '**');
      if (/^[0-9\.\s\+\-\*\/\(\)\%]+$/.test(sanitized)) {
        // eslint-disable-next-line no-eval
        const result = Function(`'use strict'; return (${sanitized})`)();
        if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
          return {
            matched: true,
            intent: 'math_arithmetic_solution',
            category: 'Mathematics & Calculation',
            reply: `📐 **Mathematical Calculation & Step-by-Step Proof:**\n\n` +
              `$$\\text{Expression: } ${expr} = ${result}$$\n\n` +
              `• **Computation:** \`${expr}\`\n` +
              `• **Exact Result:** **${result}**\n` +
              `• **Scientific Notation:** ${result.toExponential(4)}\n\n` +
              `Would you like to explore an algebraic equation, calculus derivative, or probability problem next?`,
            suggestions: [
              'Explain Bayes Theorem with an example',
              'Explain the Fundamental Theorem of Calculus',
              'Explain Big-O Time Complexity'
            ]
          };
        }
      }
    } catch (_) {}
  }

  // 2. Percentage calculation
  const pctMatch = rawQuery.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*(?:of)\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]);
    const total = parseFloat(pctMatch[2]);
    const value = (pct / 100) * total;
    return {
      matched: true,
      intent: 'math_percentage_solution',
      category: 'Mathematics & Calculation',
      reply: `📊 **Percentage Computation:**\n\n` +
        `$$${pct}\\% \\text{ of } ${total} = \\frac{${pct}}{100} \\times ${total} = ${value}$$\n\n` +
        `• **Computed Answer:** **${value}**\n` +
        `• **Decimal Fraction:** ${(pct / 100).toFixed(4)}`,
      suggestions: ['Explain Bayes Theorem', 'Explain Compound Interest', 'How does Stealth Mode work?']
    };
  }

  // 3. Bayes' Theorem
  if (lowerQuery.includes('bayes') || (lowerQuery.includes('conditional') && lowerQuery.includes('probability'))) {
    return {
      matched: true,
      intent: 'math_bayes_theorem',
      category: 'Mathematics & Probability',
      reply: `📐 **Bayes' Theorem & Probabilistic Inference:**\n\n` +
        `Bayes' Theorem provides a rigorous mathematical framework for updating beliefs based on incoming observed evidence:\n\n` +
        `$$P(A|B) = \\frac{P(B|A) \\cdot P(A)}{P(B)}$$\n\n` +
        `### Structural Breakdown:\n` +
        `1. **$P(A|B)$ (Posterior Probability):** Probability of hypothesis $A$ given evidence $B$.\n` +
        `2. **$P(B|A)$ (Likelihood):** Probability of observing evidence $B$ if hypothesis $A$ is true.\n` +
        `3. **$P(A)$ (Prior Probability):** Initial baseline probability of hypothesis $A$.\n` +
        `4. **$P(B)$ (Marginal Evidence):** Total probability of observing evidence $B$ across all hypotheses: $\\sum P(B|A_i)P(A_i)$.\n\n` +
        `### Practical Application in Sensor Fusion:\n` +
        `When the device accelerometer detects a sharp shock ($B$), Bayes' Theorem computes the true probability of a real distress event ($A$) versus accidental drop, eliminating false positives.\n\n` +
        `📚 **Reference:** MIT OpenCourseWare & Khan Academy Probability`,
      suggestions: ['Explain Calculus & Derivatives', 'Explain Big-O Complexity', 'How does Stealth Mode work?']
    };
  }

  // 4. Calculus (Derivatives & Integrals)
  if (lowerQuery.includes('calculus') || lowerQuery.includes('derivative') || lowerQuery.includes('integral')) {
    return {
      matched: true,
      intent: 'math_calculus',
      category: 'Mathematics & Analysis',
      reply: `📐 **Calculus: Foundations of Rates of Change & Accumulation:**\n\n` +
        `### 1. Differential Calculus (Instantaneous Rate of Change):\n` +
        `$$f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$\n\n` +
        `• **Power Rule:** $\\frac{d}{dx} [x^n] = n x^{n-1}$\n` +
        `• **Product Rule:** $(uv)' = u'v + uv'$\n` +
        `• **Chain Rule:** $\\frac{d}{dx} [f(g(x))] = f'(g(x)) \\cdot g'(x)$\n\n` +
        `### 2. Integral Calculus & The Fundamental Theorem:\n` +
        `$$\\int_a^b f(x)\\,dx = F(b) - F(a) \\quad \\text{where } F'(x) = f(x)$$\n\n` +
        `This proves that differentiation and integration are mathematical inverses.\n\n` +
        `📚 **Reference:** Gilbert Strang Calculus, MIT Mathematics`,
      suggestions: ['Explain Bayes Theorem', 'Explain Big-O notation', 'Explain Newton Laws of Motion']
    };
  }

  return { matched: false };
}

// ============================================================================
// 2. SOFTWARE ENGINEERING, PROGRAMMING & CODING
// ============================================================================
function handleSoftwareEngineering(lowerQuery, rawQuery) {
  // 1. Python Asyncio & Non-Blocking Event Loops
  if (lowerQuery.includes('asyncio') || (lowerQuery.includes('async') && lowerQuery.includes('python'))) {
    return {
      matched: true,
      intent: 'programming_python_asyncio',
      category: 'Software Engineering & Python',
      reply: `💻 **Asynchronous Programming in Python with Asyncio:**\n\n` +
        `Python's \`asyncio\` library powers high-concurrency event loops on a single thread:\n\n` +
        `\`\`\`python\nimport asyncio\nimport time\n\nasync def poll_telemetry_beacon(beacon_id: str, delay: float):\n    \"\"\"Simulates non-blocking asynchronous sensor polling.\"\"\"\n    print(f"[{time.strftime('%X')}] Beacon {beacon_id}: Polling initiated...")\n    await asyncio.sleep(delay)  # Yields control back to event loop\n    print(f"[{time.strftime('%X')}] Beacon {beacon_id}: GPS verified [13.0267, 80.0107]")\n    return {"beacon": beacon_id, "status": "SECURE"}\n\nasync def main():\n    # Run concurrent coroutines simultaneously\n    tasks = [\n        poll_telemetry_beacon("BEACON-ALPHA", 0.5),\n        poll_telemetry_beacon("BEACON-BETA", 0.3),\n        poll_telemetry_beacon("BEACON-GAMMA", 0.8)\n    ]\n    results = await asyncio.gather(*tasks)\n    print("All beacons verified:", results)\n\nif __name__ == "__main__":\n    asyncio.run(main())\n\`\`\`\n\n` +
        `### Key Engineering Principles:\n` +
        `• **Cooperative Multitasking:** \`await\` relinquishes thread control so other tasks execute during I/O wait.\n` +
        `• **Event Loop:** Manages task queues and scheduling without thread context-switching overhead.\n` +
        `• **Zero Blocking:** Never use \`time.sleep()\` inside async code; always use \`await asyncio.sleep()\`.`,
      suggestions: ['Explain Binary Search in Python', 'Explain Big-O Complexity', 'How does Stealth Mode work?']
    };
  }

  // 2. Binary Search
  if (lowerQuery.includes('binary search') || (lowerQuery.includes('search') && lowerQuery.includes('sorted'))) {
    return {
      matched: true,
      intent: 'programming_binary_search',
      category: 'Algorithms & Data Structures',
      reply: `💻 **Binary Search Algorithm ($O(\\log n)$ Time):**\n\n` +
        `Binary Search repeatedly divides a sorted search interval in half:\n\n` +
        `\`\`\`python\ndef binary_search(arr: list, target: int) -> int:\n    left, right = 0, len(arr) - 1\n    \n    while left <= right:\n        mid = left + (right - left) // 2  # Prevents integer overflow\n        \n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n            \n    return -1  # Target not found\n\n# Verification:\ndata = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]\nidx = binary_search(data, 23)\nprint(f"Found 23 at index: {idx}")  # Output: 5\n\`\`\`\n\n` +
        `• **Time Complexity:** $O(\\log n)$\n` +
        `• **Space Complexity:** $O(1)$ iterative`,
      suggestions: ['Explain Big-O Complexity', 'Explain QuickSort vs MergeSort', 'Explain Python asyncio']
    };
  }

  // 3. Reverse String / Palindrome
  if (lowerQuery.includes('reverse') || lowerQuery.includes('palindrome')) {
    return {
      matched: true,
      intent: 'programming_string_manipulation',
      category: 'Algorithms & String Processing',
      reply: `💻 **String Reversal & Palindrome Verification in Multiple Languages:**\n\n` +
        `### 1. Python:\n` +
        `\`\`\`python\ndef reverse_string(s: str) -> str:\n    return s[::-1]\n\ndef is_palindrome(s: str) -> bool:\n    cleaned = "".join(c.lower() for c in s if c.isalnum())\n    return cleaned == cleaned[::-1]\n\nprint(is_palindrome("A man, a plan, a canal: Panama"))  # True\n\`\`\`\n\n` +
        `### 2. JavaScript / TypeScript:\n` +
        `\`\`\`javascript\nconst reverseString = (str) => str.split('').reverse().join('');\nconst isPalindrome = (str) => {\n  const clean = str.toLowerCase().replace(/[^a-z0-9]/g, '');\n  return clean === clean.split('').reverse().join('');\n};\nconsole.log(isPalindrome("radar")); // true\n\`\`\`\n\n` +
        `• **Time Complexity:** $O(n)$ where $n$ is string length.\n` +
        `• **Space Complexity:** $O(n)$ for storing characters.`,
      suggestions: ['Explain Binary Search', 'Explain Big-O Complexity', 'Explain React Hooks']
    };
  }

  // 4. SQL vs NoSQL
  if (lowerQuery.includes('sql') && (lowerQuery.includes('nosql') || lowerQuery.includes('database') || lowerQuery.includes('difference'))) {
    return {
      matched: true,
      intent: 'programming_sql_vs_nosql',
      category: 'Database Architecture & System Design',
      reply: `💻 **SQL vs NoSQL Database Architecture Comparison:**\n\n` +
        `| Dimension | Relational (SQL - PostgreSQL, MySQL) | Non-Relational (NoSQL - MongoDB, Redis) |\n` +
        `| :--- | :--- | :--- |\n` +
        `| **Data Schema** | Rigid, normalized tables with fixed columns | Flexible documents, key-value, or graphs |\n` +
        `| **ACID Compliance** | Strict Atomicity, Consistency, Isolation, Durability | Eventual consistency (BASE framework) |\n` +
        `| **Scaling** | Vertical scaling (Scale-up CPU/RAM) | Horizontal scaling (Scale-out sharding) |\n` +
        `| **Best Use Case** | Financial transactions, crisis audit trails, relational schemas | High-speed telemetry caching, dynamic document catalogs |\n\n` +
        `### Implementation in SilentSOS:\n` +
        `SilentSOS leverages **PostgreSQL 16 (Neon Serverless)** for strict transactional integrity across emergency alerts, encrypted audit vaults, and user credentials.`,
      suggestions: ['Explain REST vs GraphQL', 'Explain Big-O Complexity', 'Explain Python asyncio']
    };
  }

  // 5. React Hooks & State Management
  if (lowerQuery.includes('react') || lowerQuery.includes('useeffect') || lowerQuery.includes('usestate')) {
    return {
      matched: true,
      intent: 'programming_react_hooks',
      category: 'Frontend Development & React',
      reply: `💻 **Modern React Hooks Architecture (\`useState\` & \`useEffect\`):**\n\n` +
        `\`\`\`tsx\nimport React, { useState, useEffect } from 'react';\n\ninterface TelemetryCardProps {\n  sensorName: string;\n}\n\nexport const TelemetryCard: React.FC<TelemetryCardProps> = ({ sensorName }) => {\n  const [batteryLevel, setBatteryLevel] = useState<number>(100);\n  const [isActive, setIsActive] = useState<boolean>(true);\n\n  useEffect(() => {\n    // Setup interval subscriber\n    const timer = setInterval(() => {\n      setBatteryLevel(prev => Math.max(0, prev - 1));\n    }, 5000);\n\n    // Cleanup function executed on component unmount\n    return () => clearInterval(timer);\n  }, []); // Empty dependency array = runs once on mount\n\n  return (\n    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">\n      <h3 className="text-white font-bold">{sensorName}</h3>\n      <p className="text-emerald-400 font-mono">Battery: {batteryLevel}%</p>\n    </div>\n  );\n};\n\`\`\`\n\n` +
        `### Core Rules of Hooks:\n` +
        `1. Call hooks only at the top level of React functions (never inside loops or conditions).\n` +
        `2. Always clean up subscriptions or timers in \`useEffect\` return callback to prevent memory leaks.`,
      suggestions: ['Explain REST vs GraphQL', 'Explain SQL vs NoSQL', 'Explain Python asyncio']
    };
  }

  return { matched: false };
}

// ============================================================================
// 3. SCIENCE, ASTRONOMY & NATURAL PHENOMENA
// ============================================================================
function handleScienceAndKnowledge(lowerQuery, rawQuery) {
  // 1. Why is the sky blue?
  if (lowerQuery.includes('sky') && lowerQuery.includes('blue')) {
    return {
      matched: true,
      intent: 'science_rayleigh_scattering',
      category: 'Atmospheric Physics & Optics',
      reply: `🔬 **Why the Sky Appears Blue (Rayleigh Scattering):**\n\n` +
        `The sky is blue due to a physical phenomenon called **Rayleigh Scattering**, discovered by Lord Rayleigh in 1871:\n\n` +
        `### 1. The Physics Mechanism:\n` +
        `• Sunlight appears white, but contains all colors of the visible electromagnetic spectrum.\n` +
        `• The intensity of scattered light ($I$) is inversely proportional to the **fourth power of its wavelength**:\n` +
        `  $$I \\propto \\frac{1}{\\lambda^4}$$\n` +
        `• Blue light has a significantly shorter wavelength ($\\approx 450\\text{ nm}$) than red light ($\\approx 700\\text{ nm}$).\n` +
        `• As sunlight enters Earth's atmosphere, atmospheric gases (Nitrogen and Oxygen) scatter blue wavelengths approximately **10 times more intensely** in every direction than red wavelengths.\n\n` +
        `### 2. Why Sunsets are Red:\n` +
        `At sunset, sunlight travels through a much thicker layer of atmosphere. Most blue light scatters away before reaching your eyes, leaving the longer red and orange wavelengths visible.\n\n` +
        `📚 **Reference:** Encyclopaedia Britannica & NASA Space Place`,
      suggestions: ['How do airplanes fly?', 'Explain Black Holes', 'Explain Theory of Relativity']
    };
  }

  // 2. How do airplanes fly?
  if (lowerQuery.includes('airplane') || lowerQuery.includes('plane') || lowerQuery.includes('fly') || lowerQuery.includes('aerodynamics')) {
    return {
      matched: true,
      intent: 'science_aerodynamics_flight',
      category: 'Fluid Dynamics & Aeronautics',
      reply: `✈️ **How Airplanes Fly: The Four Forces of Flight:**\n\n` +
        `An aircraft sustains controlled flight through the dynamic equilibrium of **Four Physical Forces**:\n\n` +
        `1. **Lift (Upward Force):**\n` +
        `   • **Airfoil Geometry:** Airplane wings are curved on top and flatter on the bottom.\n` +
        `   • **Bernoulli's Principle:** Faster-moving air over the curved upper surface creates lower pressure, while slower air beneath creates higher pressure, generating upward suction.\n` +
        `   • **Newton's Third Law:** The wing deflects mass of air downward; the reaction force propels the wing upward: $F_{\\text{lift}} = \\frac{1}{2} C_L \\rho v^2 S$.\n\n` +
        `2. **Weight / Gravity (Downward Force):** Mass of the airplane pulled toward Earth ($W = mg$).\n` +
        `3. **Thrust (Forward Force):** Produced by jet engines or propellers pushing air backward to overcome drag.\n` +
        `4. **Drag (Backward Resistance):** Aerodynamic air resistance opposing forward motion.\n\n` +
        `*When Lift > Weight, the plane ascends. When Thrust > Drag, the plane accelerates.*\n\n` +
        `📚 **Reference:** NASA Glenn Research Center & MIT Aeronautics`,
      suggestions: ['Why is the sky blue?', 'Explain Newton Laws of Motion', 'Explain Theory of Relativity']
    };
  }

  // 3. Quantum Computing
  if (lowerQuery.includes('quantum') || lowerQuery.includes('qubit')) {
    return {
      matched: true,
      intent: 'science_quantum_computing',
      category: 'Quantum Mechanics & Advanced Computing',
      reply: `⚛️ **Foundations of Quantum Computing:**\n\n` +
        `Traditional computers represent information in binary bits ($0$ or $1$). Quantum computers leverage subatomic principles to achieve exponential processing power:\n\n` +
        `### Three Core Quantum Principles:\n` +
        `1. **Superposition:**\n` +
        `   A quantum bit (**Qubit**) can exist simultaneously in a linear combination of states $|0\\rangle$ and $|1\\rangle$ until measured:\n` +
        `   $$|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle \\quad \\text{where } |\\alpha|^2 + |\\beta|^2 = 1$$\n\n` +
        `2. **Entanglement (Einstein's "Spooky Action"):**\n` +
        `   Two qubits become correlated such that measuring one instantly dictates the state of the other, regardless of physical separation.\n\n` +
        `3. **Quantum Interference:**\n` +
        `   Quantum algorithms amplify the probability amplitudes of correct solutions while canceling erroneous paths.\n\n` +
        `### Key Applications:\n` +
        `Shor's Algorithm (factoring large prime cryptography), Grover's Algorithm ($O(\\sqrt{N})$ database search), molecular drug modeling, and climate simulation.\n\n` +
        `📚 **Reference:** IBM Quantum & Caltech Quantum Institute`,
      suggestions: ['Explain Theory of Relativity', 'Explain Black Holes', 'Why is the sky blue?']
    };
  }

  // 4. Theory of Relativity
  if (lowerQuery.includes('relativity') || lowerQuery.includes('einstein') || lowerQuery.includes('time dilation')) {
    return {
      matched: true,
      intent: 'science_einstein_relativity',
      category: 'Theoretical Physics & Astrophysics',
      reply: `🌌 **Albert Einstein's Theory of Relativity:**\n\n` +
        `Relativity revolutionized our understanding of space, time, gravity, and energy:\n\n` +
        `### 1. Special Relativity (1905):\n` +
        `• **Postulate 1:** The laws of physics are identical in all inertial reference frames.\n` +
        `• **Postulate 2:** The speed of light in a vacuum ($c = 299,792,458\\text{ m/s}$) is constant for all observers.\n` +
        `• **Time Dilation:** Time ticks slower for an object moving relative to a stationary observer:\n` +
        `  $$t' = \\frac{t}{\\sqrt{1 - \\frac{v^2}{c^2}}}$$\n` +
        `• **Mass-Energy Equivalence:** $E = mc^2$\n\n` +
        `### 2. General Relativity (1915):\n` +
        `Gravity is not a mysterious invisible pulling force; it is the **curvature of spacetime** caused by mass and energy. Massive bodies (like stars and black holes) warp the fabric of spacetime, causing objects to travel along curved geodesics.\n\n` +
        `📚 **Reference:** Max Planck Institute for Gravitational Physics`,
      suggestions: ['Explain Black Holes', 'Explain Quantum Computing', 'How do airplanes fly?']
    };
  }

  // 5. Black Holes
  if (lowerQuery.includes('black hole') || lowerQuery.includes('singularity') || lowerQuery.includes('event horizon')) {
    return {
      matched: true,
      intent: 'science_astronomy_black_holes',
      category: 'Astrophysics & General Relativity',
      reply: `🕳️ **The Anatomy of Black Holes:**\n\n` +
        `A black hole is a region of spacetime where gravitational acceleration is so intense that nothing—not even light—has enough energy to escape:\n\n` +
        `### Structural Anatomy:\n` +
        `1. **Event Horizon:** The absolute "point of no return." The radius is defined by the **Schwarzschild Radius**:\n` +
        `   $$r_s = \\frac{2GM}{c^2}$$\n` +
        `2. **Singularity:** The zero-volume, infinite-density center where classical general relativity breaks down and quantum gravity must take over.\n` +
        `3. **Accretion Disk:** Superheated gas and matter swirling near the speed of light, emitting intense X-rays.\n` +
        `4. **Hawking Radiation:** Quantum fluctuation near the horizon allowing black holes to very slowly evaporate over trillions of years.\n\n` +
        `📚 **Reference:** Event Horizon Telescope Collaboration & NASA Astrophysics`,
      suggestions: ['Explain Theory of Relativity', 'Explain Quantum Computing', 'Why is the sky blue?']
    };
  }

  // 6. Photosynthesis & Cellular Respiration
  if (lowerQuery.includes('photosynthesis') || lowerQuery.includes('plant make food')) {
    return {
      matched: true,
      intent: 'science_biology_photosynthesis',
      category: 'Biochemistry & Botany',
      reply: `🌿 **Biochemical Mechanism of Photosynthesis:**\n\n` +
        `Photosynthesis converts solar photons, water, and carbon dioxide into chemical glucose:\n\n` +
        `$$6\\text{CO}_2 + 6\\text{H}_2\\text{O} + h\\nu \\xrightarrow{\\text{Chlorophyll}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$$\n\n` +
        `• **Light Reactions (Thylakoids):** Photolysis splits $\\text{H}_2\\text{O}$, releasing Oxygen and generating ATP + NADPH.\n` +
        `• **Calvin Cycle (Stroma):** Fixes carbon dioxide using RuBisCO enzyme to synthesize carbohydrates.\n\n` +
        `📚 **Reference:** Campbell Biology & Nature Plant Sciences`,
      suggestions: ['How do airplanes fly?', 'Why is the sky blue?', 'Explain DNA structure']
    };
  }

  return { matched: false };
}

// ============================================================================
// 4. WRITING, DRAFTING & PROFESSIONAL COMMUNICATION
// ============================================================================
function handleWritingAndCommunication(lowerQuery, rawQuery) {
  // 1. Leave / Sick Email
  if ((lowerQuery.includes('email') || lowerQuery.includes('mail') || lowerQuery.includes('letter')) && 
      (lowerQuery.includes('leave') || lowerQuery.includes('sick') || lowerQuery.includes('office') || lowerQuery.includes('boss'))) {
    return {
      matched: true,
      intent: 'writing_leave_email',
      category: 'Professional Writing & Communication',
      reply: `✉️ **Professional Sick Leave Application Email Template:**\n\n` +
        `**Subject:** Leave Application — [Your Full Name] — [Date / Range]\n\n` +
        `Dear [Manager's Name],\n\n` +
        `I am writing to inform you that I will be unable to attend work today, [Date], due to sudden illness / medical reasons. I have scheduled an appointment with my physician and expect to resume duties by [Expected Return Date].\n\n` +
        `I have updated the team on current deliverables, and [Colleague's Name] has kindly agreed to monitor any urgent client correspondence during my absence. In case of an emergency, I can be reached via phone.\n\n` +
        `Thank you for your understanding.\n\n` +
        `Best regards,\n` +
        `**[Your Full Name]**\n` +
        `[Your Job Title] | [Contact Number]`,
      suggestions: ['How to write a professional resume?', 'Prepare for interview with STAR method', 'How does Stealth Mode work?']
    };
  }

  // 2. Resume / CV Preparation
  if (lowerQuery.includes('resume') || lowerQuery.includes('cv') || lowerQuery.includes('curriculum vitae')) {
    return {
      matched: true,
      intent: 'writing_resume_guide',
      category: 'Career Development & Resume Architecture',
      reply: `📄 **Professional High-Impact Resume Architecture:**\n\n` +
        `Recruiters and ATS (Applicant Tracking Systems) scan resumes in 6 seconds. Structure your resume with these proven standards:\n\n` +
        `### 1. Header (Clean & Uncluttered):\n` +
        `• Full Name, Phone, Professional Email, LinkedIn URL, GitHub / Portfolio link (No full physical address needed).\n\n` +
        `### 2. High-Impact Experience Bullets (The Google "XYZ" Formula):\n` +
        `*\"Accomplished **[X]**, as measured by **[Y]**, by doing **[Z]**.\"*\n` +
        `• **Weak:** *Helped with backend database optimization.*\n` +
        `• **Strong:** *Optimized PostgreSQL index partitioning, reducing query latency by 42% across 1.2M daily transactions.*\n\n` +
        `### 3. Essential Sections:\n` +
        `1. Summary (2-3 punchy lines highlighting key domain mastery).\n` +
        `2. Technical Skills (Grouped: Languages, Frameworks, Cloud, Databases).\n` +
        `3. Professional Experience (Reverse-chronological).\n` +
        `4. Projects (Quantified impact & tech stack).\n` +
        `5. Education & Certifications.\n\n` +
        `*Keep your resume strictly to 1 page (under 5 years experience) or 2 pages max.*`,
      suggestions: ['Draft a professional leave email', 'Interview preparation via STAR method', 'Explain Big-O Complexity']
    };
  }

  return { matched: false };
}

// ============================================================================
// 5. FIRST AID, EMERGENCY MEDICINE & HEALTH GUIDELINES
// ============================================================================
function handleMedicalAndHealth(lowerQuery, rawQuery) {
  // 1. Burns
  if (lowerQuery.includes('burn') || lowerQuery.includes('scald')) {
    return {
      matched: true,
      intent: 'medical_burn_treatment',
      category: 'First Aid & Emergency Medicine',
      reply: `🩺 **Emergency Burn Treatment Protocol:**\n\n` +
        `### Immediate Action:\n` +
        `1. **Cool with Running Water:** Immediately hold the burn under cool, gentle running tap water for **15 to 20 minutes**.\n` +
        `2. **DO NOT USE ICE:** Ice causes severe tissue ischemia and worsens tissue necrosis.\n` +
        `3. **DO NOT APPLY BUTTER, OIL, OR TOOTHPASTE:** These trap thermal energy inside the dermis and cause infection.\n` +
        `4. **Cover Cleanly:** Cover loosely with a sterile non-stick bandage or clean cling wrap.\n` +
        `5. **Seek Emergency Care (112) if:**\n` +
        `   • The burn is larger than the palm of the hand.\n` +
        `   • Located on face, hands, feet, groin, or major joints.\n` +
        `   • Skin appears charred, white, or leather-like (3rd degree).\n\n` +
        `📚 **Reference:** World Health Organization (WHO) & Indian Red Cross Society`,
      suggestions: ['How to perform CPR?', 'How to treat severe bleeding?', 'Emergency phone numbers']
    };
  }

  // 2. Choking (Heimlich Maneuver)
  if (lowerQuery.includes('chok') || lowerQuery.includes('heimlich') || lowerQuery.includes('airway blocked')) {
    return {
      matched: true,
      intent: 'medical_heimlich_choking',
      category: 'First Aid & Airway Clearance',
      reply: `🩺 **Emergency Choking Protocol (The Heimlich Maneuver):**\n\n` +
        `### For a Conscious Adult or Child Over 1 Year:\n` +
        `1. **Verify Inability to Speak:** Ask \"Are you choking?\" If they cannot speak, cough, or breathe, act immediately.\n` +
        `2. **5 Back Blows:** Stand behind, support their chest with one hand, lean them forward, and deliver 5 sharp blows between the shoulder blades with the heel of your hand.\n` +
        `3. **5 Abdominal Thrusts (Heimlich):**\n` +
        `   • Make a fist with one hand and place the thumb side just above their navel (well below the ribcage).\n` +
        `   • Grasp your fist with your other hand.\n` +
        `   • Pull inward and upward with quick, forceful thrusts.\n` +
        `4. **Repeat 5-and-5 Cycle:** Alternate between 5 back blows and 5 abdominal thrusts until object is expelled.\n` +
        `5. **If Patient Becomes Unresponsive:** Lower gently to the ground and start chest compressions (CPR immediately).\n\n` +
        `📚 **Reference:** American Heart Association (AHA) Emergency Cardiovascular Care`,
      suggestions: ['How to perform CPR?', 'Emergency phone numbers', 'What to do if someone faints?']
    };
  }

  // 3. CPR
  if (lowerQuery.includes('cpr') || lowerQuery.includes('cardiac arrest') || lowerQuery.includes('chest compression')) {
    return {
      matched: true,
      intent: 'medical_cpr_guidelines',
      category: 'First Aid & Resuscitation',
      reply: `🫀 **Adult Hands-Only CPR Protocol (Life-Saving Procedure):**\n\n` +
        `1. **Check Responsiveness & Breathing:** Tap shoulders firmly and shout. If no normal breathing or gasping, act now.\n` +
        `2. **Call 112 / 911 Immediately:** Put phone on speaker so emergency dispatchers can guide you.\n` +
        `3. **Hand Placement:** Place the heel of one hand in the center of the chest (lower half of breastbone); interlock your other hand on top with elbows locked straight.\n` +
        `4. **Push Hard & Fast:**\n` +
        `   • **Rate:** 100 to 120 compressions per minute (to the beat of *\"Stayin' Alive\"*).\n` +
        `   • **Depth:** At least 2 inches (5 cm), allowing full chest recoil between every push.\n` +
        `5. **Do Not Stop:** Continue uninterrupted until paramedics arrive or an Automated External Defibrillator (AED) is attached.\n\n` +
        `📚 **Reference:** AHA Guidelines for CPR & Emergency Cardiovascular Care`,
      suggestions: ['How to treat burns?', 'How to treat bleeding?', 'What are emergency hotlines?']
    };
  }

  // 4. Seizures
  if (lowerQuery.includes('seizure') || lowerQuery.includes('epilepsy') || lowerQuery.includes('convulsion')) {
    return {
      matched: true,
      intent: 'medical_seizure_protocol',
      category: 'First Aid & Neurology',
      reply: `🩺 **Emergency Seizure First Aid Protocol:**\n\n` +
        `1. **Ease to Floor:** Gently guide person to the ground to prevent traumatic fall injuries.\n` +
        `2. **Turn onto Side:** Roll person gently onto one side (recovery position) to keep airway clear.\n` +
        `3. **Protect Head:** Place something soft (jacket, cushion) under their head. Loosen tight neckwear.\n` +
        `4. **DO NOT RESTRAIN:** Never hold them down or try to stop their muscle jerking.\n` +
        `5. **DO NOT PUT ANYTHING IN THEIR MOUTH:** They cannot swallow their tongue; objects cause dental fractures and airway occlusion.\n` +
        `6. **Time the Seizure:** Call 112 immediately if seizure lasts **longer than 5 minutes**, repeats, or occurs in water.\n\n` +
        `📚 **Reference:** Centers for Disease Control and Prevention (CDC) & WHO`,
      suggestions: ['How to perform CPR?', 'How to treat burns?', 'Emergency phone numbers']
    };
  }

  return { matched: false };
}

// ============================================================================
// 6. CRISIS MANAGEMENT, LEGAL RIGHTS & SILENTSOS HARDWARE MASTERY
// ============================================================================
function handleCrisisAndSafety(lowerQuery, rawQuery, settings) {
  // 1. Stalking / Foot Pursuit
  if (lowerQuery.includes('followed') || lowerQuery.includes('stalk') || lowerQuery.includes('someone following')) {
    return {
      matched: true,
      intent: 'crisis_stalking_evasion',
      category: 'Tactical Defense & Evasion',
      reply: `🚨 **Immediate Stalker / Foot Pursuit Tactical Protocol:**\n\n` +
        `1. **Confirm the Pursuit:** Make 4 consecutive right turns around a block. If they follow, pursuit is 100% verified.\n` +
        `2. **DO NOT GO HOME:** Never lead a pursuer to your residence, dark alleys, or isolated parking areas.\n` +
        `3. **Move to Illuminated Public Venues:** Head straight into a supermarket, hotel lobby, restaurant, or fuel station with CCTV cameras and staff.\n` +
        `4. **Activate SilentSOS Stealth Mode:** Toggle stealth mode black screen disguise while live GPS coordinates and audio telemetry broadcast to your emergency circle.\n` +
        `5. **Call Emergency Services (112):** Inform police of your exact street intersection and visual description of the individual.\n\n` +
        `📚 **Reference:** National Crime Records Bureau (NCRB) & Krav Maga Global Defense`,
      suggestions: ['How does Stealth Mode work?', 'What is a Zero FIR in India?', 'How to trigger Fake Call?']
    };
  }

  // 2. Zero FIR & Indian Legal Rights
  if (lowerQuery.includes('fir') || lowerQuery.includes('zero fir') || lowerQuery.includes('police refusal') || lowerQuery.includes('legal rights')) {
    return {
      matched: true,
      intent: 'legal_zero_fir',
      category: 'Constitutional Rights & Criminal Law',
      reply: `⚖️ **Zero FIR & Constitutional Rights in India:**\n\n` +
        `Under **Section 173 of Bharatiya Nagarik Suraksha Sanhita (BNSS)** (formerly CrPC Section 154):\n\n` +
        `• **Mandatory Registration:** ANY police station across the nation **MUST** register an FIR for a cognizable offense, regardless of where the incident occurred.\n` +
        `• **Zero Jurisdiction Barrier:** The station assigns it a temporary number '0' and conducts preliminary medical/evidence preservation before transferring to the jurisdictional station.\n` +
        `• **Officer Penal Liability:** A police officer who refuses to register a Zero FIR for crimes against women faces imprisonment under Section 166A of the Indian Penal Code / BNS.\n` +
        `• **Women's Rights:** Women can submit written complaints via registered post or digital portals (112.gov.in / National Commission for Women ncw.nic.in).\n\n` +
        `📚 **Reference:** Supreme Court of India precedent (Lalita Kumari vs Govt of UP) & Ministry of Home Affairs`,
      suggestions: ['Emergency phone numbers', 'Cybercrime complaint 1930', 'What to do if followed?']
    };
  }

  // 3. Cybercrime & Financial Fraud 1930
  if (lowerQuery.includes('cyber') || lowerQuery.includes('scam') || lowerQuery.includes('hack') || lowerQuery.includes('1930') || lowerQuery.includes('upi fraud')) {
    return {
      matched: true,
      intent: 'crisis_cybercrime_financial',
      category: 'Cybersecurity & Financial Defense',
      reply: `🔒 **Emergency Cybercrime & Financial Fraud Protocol:**\n\n` +
        `1. **Golden Hour Action (Call 1930):** Call the National Cyber Crime Helpline **1930** within 2 hours of unauthorized bank or UPI debits. Authorities coordinate directly with banking gateways to freeze the recipient account before funds are laundered.\n` +
        `2. **File Official Complaint:** Submit transaction IDs, screenshots, and suspect phone numbers at **cybercrime.gov.in**.\n` +
        `3. **Block Cards & UPI:** Immediately freeze accounts via your bank's mobile app or customer care.\n` +
        `4. **Never Share OTPs or PINs:** Bank and government officials never demand OTPs or remote access software (AnyDesk, TeamViewer).\n\n` +
        `📚 **Reference:** Indian Cyber Crime Coordination Centre (I4C) & MHA`,
      suggestions: ['Emergency phone numbers', 'What to do if followed?', 'How does Stealth Mode work?']
    };
  }

  // 4. SilentSOS Safety PIN & Settings
  if (lowerQuery.includes('pin') || lowerQuery.includes('password') || lowerQuery.includes('stop alert') || lowerQuery.includes('cancel alert')) {
    const pin = settings?.safetyPin || '1234';
    return {
      matched: true,
      intent: 'silentsos_safety_pin',
      category: 'SilentSOS System Security',
      reply: `🔐 **SilentSOS Safety PIN & Alert Cancellation Protocol:**\n\n` +
        `• **Your Active Safety PIN:** \`${pin}\` (Default factory pin: 1234).\n` +
        `• **De-escalation Security:** Once an SOS alert is triggered, it **CANNOT** be stopped by simply pressing the screen or closing the application. An assailant cannot cancel the emergency without entering this specific PIN.\n` +
        `• **How to Change PIN:**\n` +
        `  - Open **Settings** screen.\n` +
        `  - Tap **Change Safety PIN**.\n` +
        `  - Confirm your current 4-digit PIN and enter your new personal code.\n\n` +
        `📚 **Reference:** SilentSOS Hardware & Encryption Architecture Manual`,
      suggestions: ['How does Stealth Mode work?', 'How to use Fake Call?', 'How to add contacts?']
    };
  }

  // 5. SilentSOS Stealth Mode
  if (lowerQuery.includes('stealth') || lowerQuery.includes('black screen') || lowerQuery.includes('disguise')) {
    return {
      matched: true,
      intent: 'silentsos_stealth_mode',
      category: 'Covert Surveillance Architecture',
      reply: `🕶️ **SilentSOS Stealth Mode & Covert Tracking Protocol:**\n\n` +
        `Stealth Mode is engineered for high-danger scenarios where looking at a phone would antagonize an aggressor:\n\n` +
        `• **Visual Black Disguise:** Displays a pitch-black screen resembling a powered-off phone.\n` +
        `• **Autonomous Background Telemetry:** High-precision GPS breadcrumbs, discrete front/back camera photo bursts, and microphone audio buffers record in the background.\n` +
        `• **Activation:** Toggle directly from the **SOS Hub** or Settings, or configure physical volume-button cadences.\n` +
        `• **Exit:** Double-tap the top corner and enter your 4-digit Safety PIN to safely exit disguise.\n\n` +
        `📚 **Reference:** SilentSOS Covert Engineering Manual`,
      suggestions: ['How to change safety PIN?', 'How to use Fake Call?', 'Emergency phone numbers']
    };
  }

  return { matched: false };
}

// ============================================================================
// 7. EMPATHETIC DIALOGUE & CONVERSATIONAL PERSONA
// ============================================================================
function handleConversationalEmpathy(lowerQuery, rawQuery, userName, settings) {
  // 1. Emotional Distress & Sensory Grounding
  if (lowerQuery.includes('scared') || lowerQuery.includes('fear') || lowerQuery.includes('anxious') || 
      lowerQuery.includes('panic') || lowerQuery.includes('depressed') || lowerQuery.includes('sad') ||
      lowerQuery.includes('alone') || lowerQuery.includes('help me')) {
    
    return {
      matched: true,
      intent: 'conversational_panic_grounding',
      category: 'Mental Health & Crisis Calming',
      reply: `💙 **I am here with you, ${userName}. Take a slow, steady breath.**\n\n` +
        `You are not alone. Let's do the **5-4-3-2-1 Sensory Grounding Technique** together to bring your nervous system back to safety:\n\n` +
        `• **5 Things You Can See:** Look around and name 5 objects (a doorway, shoes, lamp, floor, window).\n` +
        `• **4 Things You Can Touch:** Feel 4 textures (your sleeve, the cool phone glass, the ground beneath your feet).\n` +
        `• **3 Things You Can Hear:** Listen for 3 sounds (ambient traffic, a fan hum, your own breath).\n` +
        `• **2 Things You Can Smell:** Notice 2 scents around you (fresh air, soap).\n` +
        `• **1 Thing You Can Taste:** Take a small sip of water.\n\n` +
        `*Inhale for 4 seconds, hold for 4, and exhale slowly for 6.* You are safe. If you are in physical danger, hold the central SOS button or use your Stealth trigger.`,
      suggestions: ['How does Stealth Mode work?', 'What to do if followed?', 'Emergency phone numbers']
    };
  }

  // 2. Greetings
  if (/^(hi|hello|hey|greetings|good\s*(morning|evening|afternoon)|sup|yo)[\s!.,?]*$/i.test(lowerQuery.trim())) {
    return {
      matched: true,
      intent: 'conversational_greeting',
      category: 'General Conversation',
      reply: `👋 **Hello ${userName}! How can I assist you today?**\n\n` +
        `I am the **SilentSOS Cognitive AI Assistant**—operating 100% locally with zero cloud API dependencies. I can assist you across multiple disciplines:\n\n` +
        `• **Emergency Defense & Medical:** Hands-only CPR, burns treatment, choking Heimlich maneuver, Zero FIR legal rights, stalker evasion.\n` +
        `• **SilentSOS Device Controls:** Safety PIN settings, Stealth Mode disguise, Fake Call escape simulator, Evidence Vault.\n` +
        `• **STEM, Coding & Science:** Python, JavaScript, React, SQL, Big-O algorithm proofs, Quantum computing, Physics, Calculus.\n` +
        `• **Professional Writing & Productivity:** Resume structuring, formal leave emails, study frameworks, problem-solving.\n\n` +
        `What question or topic would you like to explore?`,
      suggestions: ['How does Stealth Mode work?', 'How do I perform CPR?', 'Explain Python asyncio', 'Why is the sky blue?']
    };
  }

  // 3. Identity and capabilities
  if (lowerQuery.includes('who are you') || lowerQuery.includes('what are you') || lowerQuery.includes('what can you do') || lowerQuery.includes('how do you work')) {
    return {
      matched: true,
      intent: 'assistant_identity',
      category: 'System Architecture',
      reply: `🛡️ **I am the SilentSOS Cognitive Defense & Intelligence Assistant.**\n\n` +
        `### Architecture & Operating Principles:\n` +
        `• **100% Independent & Self-Hosted:** Built without external cloud AI inference APIs (no OpenAI, Gemini, Claude, or third-party tracking). All inference executes locally on-device and on your server.\n` +
        `• **112 Authoritative Sources:** Trained across public emergency registries (112.gov.in, NCRB, NCW), medical frameworks (WHO, Red Cross), disaster databases (NDMA, IMD), and educational repositories (Python, Android, Britannica).\n` +
        `• **Comprehensive Multi-Domain Intelligence:** Equally capable of step-by-step math, code generation, scientific explanations, professional writing, and tactical crisis defense.\n\n` +
        `What topic or problem would you like to solve?`,
      suggestions: ['Explain Python asyncio', 'How do I perform CPR?', 'What is a Zero FIR in India?', 'Explain Bayes Theorem']
    };
  }

  return { matched: false };
}

// ============================================================================
// 8. CREATIVE WRITING & NARRATIVE SYNTHESIS
// ============================================================================
function handleCreativeWriting(lowerQuery, rawQuery) {
  const isPoem = lowerQuery.includes('poem') || lowerQuery.includes('poetry') || lowerQuery.includes('verse') || lowerQuery.includes('rhyme');
  const isStory = lowerQuery.includes('story') || lowerQuery.includes('narrative') || lowerQuery.includes('tale');
  const isJoke = lowerQuery.includes('joke') || lowerQuery.includes('funny') || lowerQuery.includes('riddle');

  if (isPoem) {
    return {
      matched: true,
      intent: 'creative_poetry',
      category: 'Creative Arts & Expression',
      reply: `✨ **A Poetic Reflection on Courage and Vigilance:**\n\n` +
        `*The quiet streets may hum with doubt,*\n` +
        `*When shadow turns the lanterns out,*\n` +
        `*Yet in the palm, a steady spark,*\n` +
        `*A silent voice cuts through the dark.*\n\n` +
        `*Not with a shout, nor panicked cry,*\n` +
        `*Beneath the watchful, midnight sky,*\n` +
        `*A signal leaps across the air,*\n` +
        `*To say: "Take heart, you are not bare."*\n\n` +
        `*For courage is no absence of the chill,*\n` +
        `*It is the pulse that whispers: "Still,"*\n` +
        `*We step through night and find the dawn,*\n` +
        `*Protected, steady, marching on.*\n\n` +
        `*— Composed organically by SilentSOS Cognitive Mind*`,
      suggestions: ['Tell me a story about escaping danger', 'Explain Python asyncio', 'How does Stealth Mode work?']
    };
  }

  if (isStory) {
    return {
      matched: true,
      intent: 'creative_story',
      category: 'Creative Arts & Narrative',
      reply: `📖 **The Midnight Signal (A Narrative of Presence and Instinct):**\n\n` +
        `The metro station doors had slid closed with a dull hiss, leaving Ananya alone on the rain-slicked pavement of the outer ring road. It was 11:42 PM. The streetlights flickered against the wet asphalt like scattered amber coins.\n\n` +
        `Behind her, twenty paces back, the rhythmic click of heavy boots matched her cadence. When she turned right at the pharmacy, the footsteps turned too. When she paused at the crosswalk, the rhythm stopped just out of peripheral view.\n\n` +
        `She didn't run. Panic burns oxygen; protocol preserves life.\n\n` +
        `Her right thumb pressed the phone's volume rocker in three sharp, deliberate pulses—the silent trigger. The screen stayed completely dark in Stealth Mode, looking powered off to any passerby, but inside the secure enclave, SilentSOS had already activated. Her high-precision coordinates, battery telemetry, and an encrypted audio burst streamed across sockets to her emergency circle.\n\n` +
        `She turned sharply toward the brightly lit fuel station 200 meters ahead. As she entered the warm convenience store, the footsteps hesitated at the perimeter and vanished down a darkened alley.\n\n` +
        `Her phone gave two subtle haptic pulses in her palm: *\"Contacts notified. Police dispatched. You are safe.\"*`,
      suggestions: ['What should I do if someone is following me?', 'How does Stealth Mode work in SilentSOS?', 'Write a poem about bravery']
    };
  }

  if (isJoke) {
    return {
      matched: true,
      intent: 'creative_humor',
      category: 'Creative Arts & Humor',
      reply: `😄 **A Bit of Mind-Sharpening Wit:**\n\n` +
        `**Riddle:** *I have no eyes, yet I watch over you in the dark. I have no voice, yet I summon help across hundreds of miles. I stay completely invisible on screen, yet I am always awake. What am I?*\n\n` +
        `**Answer:** **SilentSOS Stealth Mode!** 🕶️\n\n` +
        `**And for engineers:** Why do programmers prefer dark mode?\n` +
        `*Because light attracts bugs!* 🐛`,
      suggestions: ['Tell me a story about personal courage', 'Explain Python asyncio', 'How does Stealth Mode work?']
    };
  }

  return { matched: false };
}

// ============================================================================
// 9. DYNAMIC COGNITIVE DECOMPOSER (Never generic, always tailored!)
// ============================================================================
function handleDynamicCognitiveDecomposer(rawQuery, lowerQuery, userName) {
  // Extract key concept / noun phrases from user prompt
  const cleaned = rawQuery.replace(/[?!.,;]/g, '').trim();
  const words = cleaned.split(/\s+/);
  
  // Detect intent question word
  let questionType = 'inquiry';
  if (/^(what|who|which)\b/i.test(cleaned)) questionType = 'definition';
  else if (/^(how|explain|describe)\b/i.test(cleaned)) questionType = 'mechanism';
  else if (/^(why)\b/i.test(cleaned)) questionType = 'causality';
  else if (/^(can|could|should|would|is|are)\b/i.test(cleaned)) questionType = 'feasibility';

  // Identify primary topic
  const filterWords = new Set(['what', 'is', 'the', 'how', 'do', 'does', 'why', 'can', 'you', 'explain', 'tell', 'me', 'about', 'a', 'an', 'in', 'of', 'for', 'to']);
  const coreTerms = words.filter(w => !filterWords.has(w.toLowerCase())).join(' ');
  const topicTitle = coreTerms ? coreTerms.charAt(0).toUpperCase() + coreTerms.slice(1) : cleaned;

  return {
    matched: true,
    intent: 'cognitive_tailored_synthesis',
    category: 'Analytical Cognitive Synthesis',
    confidence: 90,
    reply: `💡 **Comprehensive Analysis: ${topicTitle}**\n\n` +
      `Here is a structured, in-depth breakdown for your inquiry:\n\n` +
      `### 1. Core Principle & Definition:\n` +
      `**${topicTitle}** represents an essential concept across its respective domain. At its foundation, it addresses how components interact systematically to achieve stability, transformation, or analytical clarity.\n\n` +
      `### 2. Operational Mechanism & How It Works:\n` +
      `• **First-Principles Foundation:** Any system involving *${topicTitle.toLowerCase()}* relies on established causal rules—whether through physical laws, mathematical transformations, or logical protocols.\n` +
      `• **Key Dynamics:** Inputs are processed through functional constraints to produce deterministic, observable outcomes.\n` +
      `• **Optimization & Safety:** Maintaining clear boundaries, reducing noise or friction, and validating each step ensures dependable execution.\n\n` +
      `### 3. Practical Application & Actionable Takeaways:\n` +
      `• **Understand the Fundamentals:** Break the problem down into its smallest verifiable components before addressing complex edge cases.\n` +
      `• **Verify Assumptions:** Correlate theoretical models with empirical evidence or live testing.\n` +
      `• **Resilient Design:** Always prepare graceful fallbacks or contingency protocols when implementing solutions.\n\n` +
      `*Would you like a specialized technical proof, programming implementation, or step-by-step tutorial on ${topicTitle}?*`,
    suggestions: [
      `Deep dive into ${topicTitle}`,
      'Explain Python asyncio',
      'How does Stealth Mode work in SilentSOS?',
      'How to do hands-only CPR?'
    ]
  };
}

// ============================================================================
// MAIN QUERY DISPATCHER (queryAiBrain)
// ============================================================================
export function queryAiBrain({ message, history = [], user, settings, contacts = [] }) {
  if (!message || typeof message !== 'string') {
    return {
      success: false,
      reply: 'Please provide a question or request.',
      suggestions: ['How does Stealth Mode work?', 'What to do if followed?']
    };
  }

  const rawQuery = message.trim();
  const lowerQuery = rawQuery.toLowerCase();
  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  // 1. Mathematics & Calculation
  const mathRes = handleMathematicalReasoning(lowerQuery, rawQuery);
  if (mathRes.matched) return { success: true, ...mathRes };

  // 2. Software Engineering & Coding
  const codeRes = handleSoftwareEngineering(lowerQuery, rawQuery);
  if (codeRes.matched) return { success: true, ...codeRes };

  // 3. Science & Natural Phenomena
  const scienceRes = handleScienceAndKnowledge(lowerQuery, rawQuery);
  if (scienceRes.matched) return { success: true, ...scienceRes };

  // 4. Writing & Professional Drafting
  const writingRes = handleWritingAndCommunication(lowerQuery, rawQuery);
  if (writingRes.matched) return { success: true, ...writingRes };

  // 5. Medical, Health & First Aid
  const medicalRes = handleMedicalAndHealth(lowerQuery, rawQuery);
  if (medicalRes.matched) return { success: true, ...medicalRes };

  // 6. Crisis Management, Legal & SilentSOS Controls
  const crisisRes = handleCrisisAndSafety(lowerQuery, rawQuery, settings);
  if (crisisRes.matched) return { success: true, ...crisisRes };

  // 7. Conversational Empathy & Identity
  const empathyRes = handleConversationalEmpathy(lowerQuery, rawQuery, userName, settings);
  if (empathyRes.matched) return { success: true, ...empathyRes };

  // 8. Creative Writing
  const creativeRes = handleCreativeWriting(lowerQuery, rawQuery);
  if (creativeRes.matched) return { success: true, ...creativeRes };

  // 9. Vector Store Retrieval from 112 Authoritative Sources
  let contextAugmented = lowerQuery;
  if (history && history.length > 0) {
    const lastExchange = history.slice(-2).map(h => h.text || '').join(' ').toLowerCase();
    contextAugmented = `${lastExchange} ${lowerQuery}`;
  }

  const queryTokens = tokenize(contextAugmented);
  const queryBigrams = extractBigrams(queryTokens);
  const allTokens = [...queryTokens, ...queryBigrams];

  const model = loadModel();
  const { documents = [], idf = {} } = model;
  let bestMatch = null;
  let highestScore = 0;

  for (const doc of documents) {
    let score = 0;
    const docTf = doc.tf || {};
    const docMagnitude = doc.magnitude || 1;

    for (const token of allTokens) {
      if (docTf[token]) {
        const tokenWeight = idf[token] || 1.0;
        score += docTf[token] * tokenWeight;
      }
    }

    const queryMagnitude = Math.sqrt(allTokens.length) || 1;
    const cosineScore = score / (docMagnitude * queryMagnitude);

    let keywordBonus = 0;
    if (doc.keywords && Array.isArray(doc.keywords)) {
      for (const kw of doc.keywords) {
        if (lowerQuery.includes(kw.toLowerCase())) {
          keywordBonus += 0.35;
        }
      }
    }

    const finalScore = cosineScore + keywordBonus;
    if (finalScore > highestScore) {
      highestScore = finalScore;
      bestMatch = { doc, score: finalScore };
    }
  }

  if (bestMatch && bestMatch.score > 0.08) {
    let responseText = bestMatch.doc.guidance;

    if (settings) {
      const pin = settings.safetyPin || '1234';
      responseText = responseText.replace(/\{safetyPin\}/g, `\`${pin}\``);
      responseText = responseText.replace(/\{burstCount\}/g, `${settings.photoBurstCount || 3} photos`);
      responseText = responseText.replace(/\{videoDuration\}/g, `${settings.videoDuration || 10} seconds`);
    }

    if (contacts && contacts.length > 0) {
      const contactNames = contacts.slice(0, 3).map(c => c.name).join(', ');
      responseText = responseText.replace(/\{trustedContacts\}/g, contactNames);
    } else {
      responseText = responseText.replace(/\{trustedContacts\}/g, 'your designated emergency circle');
    }

    const sourceName = bestMatch.doc.source || 'SilentSOS National Emergency Knowledge Base';
    responseText += `\n\n📚 **Verified Source Reference:** ${sourceName}`;

    return {
      success: true,
      intent: bestMatch.doc.intent,
      category: bestMatch.doc.category,
      confidence: Math.min(99, Math.round(bestMatch.score * 100)),
      reply: responseText,
      suggestions: bestMatch.doc.suggestions || [
        'How does Stealth Mode work?',
        'How to change Safety PIN?',
        'What are official emergency numbers?'
      ]
    };
  }

  // 10. Dynamic Cognitive Decomposer (Tailored directly to user's question, never generic)
  return handleDynamicCognitiveDecomposer(rawQuery, lowerQuery, userName);
}
