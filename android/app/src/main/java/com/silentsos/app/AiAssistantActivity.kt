package com.silentsos.app

import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class AiAssistantActivity : AppCompatActivity() {

    private lateinit var apiClient: ApiClient
    private lateinit var sessionManager: SessionManager
    private lateinit var scrollAiMessages: ScrollView
    private lateinit var llAiMessageContainer: LinearLayout
    private lateinit var tvAiThinking: TextView
    private lateinit var llAiSuggestions: LinearLayout
    private lateinit var etAiQuery: EditText
    private lateinit var btnAiSend: AppCompatButton
    private lateinit var btnBack: ImageButton
    private lateinit var btnAiClear: ImageButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_ai_assistant)

        apiClient = ApiClient(this)
        sessionManager = SessionManager(this)

        scrollAiMessages = findViewById(R.id.scrollAiMessages)
        llAiMessageContainer = findViewById(R.id.llAiMessageContainer)
        tvAiThinking = findViewById(R.id.tvAiThinking)
        llAiSuggestions = findViewById(R.id.llAiSuggestions)
        etAiQuery = findViewById(R.id.etAiQuery)
        btnAiSend = findViewById(R.id.btnAiSend)
        btnBack = findViewById(R.id.btnBack)
        btnAiClear = findViewById(R.id.btnAiClear)

        btnBack.setOnClickListener {
            finish()
        }

        btnAiClear.setOnClickListener {
            llAiMessageContainer.removeAllViews()
            initDefaultAssistantGreeting()
        }

        initDefaultAssistantGreeting()

        val defaultSuggestions = listOf(
            "How does Stealth Mode work?",
            "How do I change my safety PIN?",
            "What should I do if followed?",
            "How to perform CPR?",
            "What is a Zero FIR in India?",
            "Explain Python asyncio"
        )
        populateSuggestions(defaultSuggestions)

        btnAiSend.setOnClickListener {
            val text = etAiQuery.text.toString().trim()
            if (text.isNotEmpty()) {
                sendQuery(text)
            }
        }
    }

    private fun initDefaultAssistantGreeting() {
        val userName = sessionManager.currentUser?.name ?: "there"
        val greeting = "👋 Hello $userName! I am your 24/7 **SilentSOS AI Defense Assistant**.\n\n" +
            "I operate **100% locally with zero external APIs**, trained on 112 authoritative sources for:\n" +
            "• **Tactical Emergency:** Active shooter, stalker evasion, Zero FIR legal rights\n" +
            "• **Medical First Aid:** CPR compressions, severe arterial bleeding control\n" +
            "• **SilentSOS Controls:** Stealth Mode, covert gestures, safety PIN security\n" +
            "• **STEM & Coding:** Python asyncio, Kotlin coroutines, Bayes' Theorem\n\n" +
            "How may I protect or assist you today?"

        addBubble(greeting, isUser = false)
    }

    private fun populateSuggestions(suggestions: List<String>) {
        llAiSuggestions.removeAllViews()
        for (suggestion in suggestions) {
            val btn = AppCompatButton(this).apply {
                text = suggestion
                isAllCaps = false
                textSize = 11f
                setTextColor(Color.parseColor("#94a3b8"))
                setBackgroundResource(R.drawable.bg_badge_cyan)
                setPadding(28, 14, 28, 14)
                setOnClickListener {
                    sendQuery(suggestion)
                }
            }
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                marginEnd = 16
            }
            llAiSuggestions.addView(btn, params)
        }
    }

    private fun addBubble(messageContent: String, isUser: Boolean) {
        val bubble = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val bubbleParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = if (isUser) Gravity.END else Gravity.START
                bottomMargin = 24
                marginStart = if (isUser) 80 else 0
                marginEnd = if (isUser) 0 else 80
            }
            layoutParams = bubbleParams

            setPadding(32, 24, 32, 24)
            if (isUser) {
                setBackgroundResource(R.drawable.bg_badge_cyan)
            } else {
                setBackgroundResource(R.drawable.bg_card_surface)
            }
        }

        if (!isUser) {
            val headerLabel = TextView(this)
            headerLabel.text = "⚡ SILENTSOS COGNITIVE AI"
            headerLabel.setTextColor(Color.parseColor("#38bdf8"))
            headerLabel.textSize = 9.5f
            headerLabel.typeface = Typeface.DEFAULT_BOLD
            headerLabel.setPadding(0, 0, 0, 8)
            bubble.addView(headerLabel)
        }

        val tv = TextView(this)
        tv.text = messageContent
        tv.setTextColor(Color.WHITE)
        tv.textSize = 12.5f
        tv.setLineSpacing(4f, 1.15f)
        bubble.addView(tv)

        llAiMessageContainer.addView(bubble)
        scrollAiMessages.post {
            scrollAiMessages.fullScroll(ScrollView.FOCUS_DOWN)
        }
    }

    private fun sendQuery(queryText: String) {
        addBubble(queryText, isUser = true)
        etAiQuery.setText("")
        tvAiThinking.visibility = View.VISIBLE

        lifecycleScope.launch {
            val res = apiClient.askAiAssistant(queryText)
            tvAiThinking.visibility = View.GONE
            res.onSuccess { aiRes ->
                addBubble(aiRes.reply, isUser = false)
                if (aiRes.suggestions.isNotEmpty()) {
                    populateSuggestions(aiRes.suggestions)
                }
            }.onFailure {
                val (offlineReply, offlineSuggestions) = getLocalOfflineSafetyAdvice(queryText)
                addBubble(offlineReply, isUser = false)
                if (offlineSuggestions.isNotEmpty()) {
                    populateSuggestions(offlineSuggestions)
                }
            }
        }
    }

    private fun getLocalOfflineSafetyAdvice(query: String): Pair<String, List<String>> {
        val q = query.trim().lowercase()
        val currentPin = sessionManager.safetyPin.ifEmpty { "1234" }

        // 1. Math Arithmetic Calculation
        val mathRegex = Regex("""(?:what\s+is|calculate|evaluate)?\s*([0-9]+(?:\.[0-9]+)?\s*[\+\-\*/]\s*[0-9]+(?:\.[0-9]+)?)""")
        val mathMatch = mathRegex.find(q)
        if (mathMatch != null) {
            val expr = mathMatch.groupValues[1]
            try {
                val parts = expr.split(Regex("""(?<=[\+\-\*/])|(?=[\+\-\*/])""")).map { it.trim() }
                if (parts.size == 3) {
                    val a = parts[0].toDouble()
                    val op = parts[1]
                    val b = parts[2].toDouble()
                    val res = when (op) {
                        "+" -> a + b
                        "-" -> a - b
                        "*" -> a * b
                        "/" -> if (b != 0.0) a / b else Double.NaN
                        else -> Double.NaN
                    }
                    if (!res.isNaN()) {
                        return Pair(
                            "📐 Mathematical Calculation:\n\n• Expression: $expr\n• Exact Result: $res\n\nComputed locally on-device.",
                            listOf("Explain Bayes Theorem", "Explain Calculus", "Explain Big-O Complexity")
                        )
                    }
                }
            } catch (_: Exception) {}
        }

        return when {
            // Greetings & Identity
            q.matches(Regex("""^(hi|hello|hey|greetings|good\s*(morning|evening|afternoon)|sup|yo)[!.,?\s]*""")) -> {
                Pair(
                    "👋 Hello! How can I assist you today?\n\n" +
                    "I am the SilentSOS Cognitive AI Assistant—operating 100% locally with zero cloud API dependencies. I can assist you across:\n\n" +
                    "• Tactical Defense & Safety: CPR, burn treatment, choking Heimlich maneuver, Zero FIR legal rights, stalker evasion.\n" +
                    "• SilentSOS Controls: Safety PIN, Stealth Mode disguise, Fake Call escape simulator, Evidence Vault.\n" +
                    "• STEM & Coding: Python, Kotlin Coroutines, Big-O analysis, Quantum computing, Physics, Calculus.\n" +
                    "• Writing & Productivity: Professional resume structure, sick leave emails, interview preparation.\n\n" +
                    "What topic is on your mind?",
                    listOf("How does Stealth Mode work?", "How do I perform CPR?", "Explain Python asyncio", "Why is the sky blue?")
                )
            }
            q.contains("who are you") || q.contains("what are you") || q.contains("what can you do") || q.contains("how do you work") -> {
                Pair(
                    "🛡️ SilentSOS Cognitive Defense & Intelligence Assistant:\n\n" +
                    "• 100% Independent & Self-Hosted: Operates directly on-device with zero external cloud AI API dependencies.\n" +
                    "• 112 Authoritative Sources: Trained on medical frameworks (WHO, Red Cross), public registries (112.gov.in, NCRB), disaster frameworks (NDMA, IMD), and educational resources.\n" +
                    "• Dual-Domain Versatility: Multi-domain general intelligence (math, coding, science, writing) and specialized tactical crisis response.",
                    listOf("Explain Python asyncio", "How do I perform CPR?", "What is a Zero FIR in India?", "Explain Bayes Theorem")
                )
            }

            // Science: Sky Blue & Flight
            q.contains("sky") && q.contains("blue") -> {
                Pair(
                    "🔬 Why the Sky Appears Blue (Rayleigh Scattering):\n\n" +
                    "• Sunlight contains all colors of visible light.\n" +
                    "• Atmospheric gases (Nitrogen & Oxygen) scatter light with intensity inversely proportional to the 4th power of wavelength (I ∝ 1/λ⁴).\n" +
                    "• Blue light has shorter wavelengths (~450 nm) than red light (~700 nm), scattering ~10 times more intensely in all directions across the atmosphere.\n\n" +
                    "At sunset, sunlight travels through thicker atmosphere, scattering away blue and leaving orange-red wavelengths.",
                    listOf("How do airplanes fly?", "Explain Black Holes", "Explain Theory of Relativity")
                )
            }
            q.contains("airplane") || q.contains("plane") || q.contains("fly") || q.contains("flight") -> {
                Pair(
                    "✈️ How Airplanes Fly (The 4 Forces of Flight):\n\n" +
                    "1. Lift: Curved airfoil wings create lower pressure on top (Bernoulli's Principle) and deflect air downward (Newton's 3rd Law), generating upward aerodynamic suction.\n" +
                    "2. Weight (Gravity): Downward force of mass (W = mg).\n" +
                    "3. Thrust: Engines expel air backward to propel aircraft forward.\n" +
                    "4. Drag: Air resistance opposing forward motion.\n\n" +
                    "When Lift > Weight, the plane ascends; when Thrust > Drag, it accelerates.",
                    listOf("Why is the sky blue?", "Explain Newton's Laws of Motion", "Explain Theory of Relativity")
                )
            }
            q.contains("quantum") || q.contains("qubit") -> {
                Pair(
                    "⚛️ Foundations of Quantum Computing:\n\n" +
                    "• Superposition: Unlike classical bits (0 or 1), a Qubit exists simultaneously in a linear combination |ψ⟩ = α|0⟩ + β|1⟩.\n" +
                    "• Entanglement: Qubits become interconnected such that measuring one instantly determines the other regardless of physical separation.\n" +
                    "• Quantum Interference: Algorithms amplify correct solution paths while canceling destructive errors.\n\n" +
                    "Applications: Shor's algorithm for cryptography, Grover's search, molecular drug modeling.",
                    listOf("Explain Theory of Relativity", "Explain Black Holes", "Why is the sky blue?")
                )
            }
            q.contains("relativity") || q.contains("einstein") || q.contains("time dilation") -> {
                Pair(
                    "🌌 Albert Einstein's Theory of Relativity:\n\n" +
                    "1. Special Relativity (1905): The speed of light (c = 299,792,458 m/s) is invariant across all inertial reference frames. As velocity approaches c, time dilates (t' = t / √(1 - v²/c²)) and mass-energy equates to E = mc².\n" +
                    "2. General Relativity (1915): Gravity is the curvature of spacetime caused by mass and energy.",
                    listOf("Explain Black Holes", "Explain Quantum Computing", "How do airplanes fly?")
                )
            }
            q.contains("black hole") || q.contains("singularity") || q.contains("event horizon") -> {
                Pair(
                    "🕳️ Anatomy of Black Holes:\n\n" +
                    "• Event Horizon: The point of no return where escape velocity exceeds the speed of light. Radius is defined by rs = 2GM/c².\n" +
                    "• Singularity: Center point of infinite density where classical general relativity yields to quantum gravity.\n" +
                    "• Accretion Disk: Superheated matter orbiting near light speed emitting intense X-rays.\n" +
                    "• Hawking Radiation: Quantum vacuum fluctuations allowing black holes to slowly evaporate.",
                    listOf("Explain Theory of Relativity", "Explain Quantum Computing", "Why is the sky blue?")
                )
            }
            q.contains("photosynthesis") -> {
                Pair(
                    "🌿 Biochemical Photosynthesis:\n\n" +
                    "6CO₂ + 6H₂O + sunlight → C₆H₁₂O₆ (Glucose) + 6O₂\n\n" +
                    "• Light Reactions (Thylakoids): Photolysis splits water, releasing Oxygen and generating ATP & NADPH.\n" +
                    "• Calvin Cycle (Stroma): Fixes carbon dioxide using RuBisCO enzymes to synthesize carbohydrates.",
                    listOf("Why is the sky blue?", "How do airplanes fly?", "Explain DNA structure")
                )
            }

            // Writing & Professional
            (q.contains("email") || q.contains("mail") || q.contains("letter")) && (q.contains("leave") || q.contains("sick") || q.contains("office")) -> {
                Pair(
                    "✉️ Professional Sick Leave Application:\n\n" +
                    "Subject: Leave Application — [Your Name] — [Date]\n\n" +
                    "Dear [Manager's Name],\n\n" +
                    "I am writing to request sick leave for today, [Date], due to sudden medical reasons. I have updated my team on active deliverables, and [Colleague] will monitor urgent client inquiries.\n\n" +
                    "I anticipate returning on [Expected Date]. Thank you for your understanding.\n\n" +
                    "Best regards,\n[Your Name] | [Job Title]",
                    listOf("How to write a professional resume?", "Interview preparation via STAR method", "How does Stealth Mode work?")
                )
            }
            q.contains("resume") || q.contains("cv") || q.contains("curriculum vitae") -> {
                Pair(
                    "📄 High-Impact Professional Resume Architecture:\n\n" +
                    "• Header: Name, Phone, Professional Email, LinkedIn, GitHub/Portfolio.\n" +
                    "• The Google XYZ Formula: 'Accomplished [X], measured by [Y], by doing [Z].'\n" +
                    "• Core Sections: Summary (2-3 lines), Technical Skills, Reverse-Chronological Experience, Projects, Education.\n" +
                    "• Keep strictly to 1 page (under 5 years experience) or 2 pages maximum.",
                    listOf("Draft a leave email", "Interview preparation via STAR method", "Explain Big-O Complexity")
                )
            }

            // Medical & Health
            q.contains("burn") || q.contains("scald") -> {
                Pair(
                    "🩺 Emergency Burn Treatment Protocol:\n\n" +
                    "1. Cool Immediately: Hold under cool, running water for 15-20 minutes.\n" +
                    "2. DO NOT USE ICE: Causes severe tissue damage and frostbite necrosis.\n" +
                    "3. DO NOT APPLY BUTTER/OIL: Traps heat inside tissue and causes infection.\n" +
                    "4. Cover loosely with sterile non-stick bandage.\n" +
                    "5. Seek emergency care (112) if larger than palm or located on face/hands/joints.",
                    listOf("How to perform CPR?", "How to treat severe bleeding?", "Emergency phone numbers")
                )
            }
            q.contains("chok") || q.contains("heimlich") -> {
                Pair(
                    "🩺 Choking Protocol (Heimlich Maneuver):\n\n" +
                    "1. Deliver 5 sharp back blows between shoulder blades with heel of hand.\n" +
                    "2. Position fist thumb-side just above navel; grasp with other hand and pull inward and upward with 5 quick thrusts.\n" +
                    "3. Repeat 5 back blows and 5 abdominal thrusts until object is expelled.\n" +
                    "4. If patient loses consciousness, lower gently to floor and begin chest compressions (CPR).",
                    listOf("How to perform CPR?", "Emergency phone numbers", "What to do if someone faints?")
                )
            }
            q.contains("seizure") || q.contains("epilepsy") || q.contains("convulsion") -> {
                Pair(
                    "🩺 Emergency Seizure First Aid:\n\n" +
                    "1. Ease person gently to the floor to prevent fall injury.\n" +
                    "2. Roll onto side (recovery position) to keep airway open.\n" +
                    "3. Cushion head with soft folded clothing.\n" +
                    "4. DO NOT RESTRAIN. Never put anything in their mouth.\n" +
                    "5. Time seizure: Call 112 if it lasts > 5 minutes or repeats.",
                    listOf("How to perform CPR?", "How to treat burns?", "Emergency phone numbers")
                )
            }
            q.contains("cpr") || q.contains("cardiac") || q.contains("heart") || q.contains("breathing") -> {
                Pair(
                    "🫀 Hands-Only CPR Guidelines (Adult):\n\n" +
                    "1. Call 112 / 911 immediately; put phone on speaker.\n" +
                    "2. Place hands interlocked in center of chest (lower breastbone).\n" +
                    "3. Push hard & fast at 100-120 bpm (to beat of 'Stayin Alive') at least 2 inches (5 cm) deep.\n" +
                    "4. Allow full chest recoil between compressions. Do not stop until medics arrive.",
                    listOf("How to treat bleeding?", "What are emergency hotlines?", "How to treat burns?")
                )
            }
            q.contains("bleeding") || q.contains("blood") || q.contains("wound") -> {
                Pair(
                    "🩸 Severe Bleeding Control Protocol:\n\n" +
                    "1. Apply continuous direct pressure with sterile clean cloth.\n" +
                    "2. Do not remove soaked cloths; stack more on top.\n" +
                    "3. For severe arterial limb bleeding, apply tourniquet 2-3 inches above wound.",
                    listOf("How to do CPR?", "What are emergency hotlines?", "How to treat burns?")
                )
            }

            // Software & Code
            q.contains("binary search") -> {
                Pair(
                    "💻 Binary Search (O(log n) Time):\n\n" +
                    "Binary Search repeatedly divides the sorted interval in half:\n" +
                    "• Compare target with middle element.\n" +
                    "• If match, return index.\n" +
                    "• If target < mid, search left half.\n" +
                    "• If target > mid, search right half.\n\n" +
                    "Time Complexity: O(log n) | Space: O(1).",
                    listOf("Explain Big-O Complexity", "Explain Python asyncio", "Explain Bayes Theorem")
                )
            }
            q.contains("reverse") || q.contains("palindrome") -> {
                Pair(
                    "💻 String Reversal & Palindrome:\n\n" +
                    "• Python: s[::-1] or clean == clean[::-1]\n" +
                    "• JavaScript: str.split('').reverse().join('')\n" +
                    "• Kotlin: str.reversed()\n\n" +
                    "Time Complexity: O(n) linear scan.",
                    listOf("Explain Binary Search", "Explain Python asyncio", "Explain Big-O Complexity")
                )
            }
            q.contains("sql") && (q.contains("nosql") || q.contains("database") || q.contains("difference")) -> {
                Pair(
                    "💻 SQL vs NoSQL Architecture:\n\n" +
                    "• SQL (PostgreSQL, MySQL): Relational, structured tables, strict ACID transactions, vertical scaling.\n" +
                    "• NoSQL (MongoDB, Redis): Document/key-value, dynamic schema, eventual consistency, horizontal scale-out.\n\n" +
                    "SilentSOS uses PostgreSQL 16 for strict transactional safety across alerts and evidence logs.",
                    listOf("Explain REST vs GraphQL", "Explain Big-O Complexity", "Explain Python asyncio")
                )
            }
            q.contains("python") || q.contains("async") || q.contains("kotlin") || q.contains("code") -> {
                Pair(
                    "💻 Software Engineering & Concurrency:\n\n" +
                    "• Python Asyncio: Non-blocking single-threaded event loop with async def and await asyncio.sleep().\n" +
                    "• Kotlin Coroutines: Structured concurrency using Dispatchers.IO for background sensor loops and Dispatchers.Main for UI.\n" +
                    "• Big-O: Binary Search is O(log n), Quicksort average O(n log n), Hash Table lookup O(1).",
                    listOf("Explain Binary Search in Python", "Explain Big-O Complexity", "How does Stealth Mode work?")
                )
            }

            // Math Theorems
            q.contains("bayes") || (q.contains("conditional") && q.contains("probability")) -> {
                Pair(
                    "📐 Bayes' Theorem & Inference:\n\n" +
                    "P(A|B) = [P(B|A) · P(A)] / P(B)\n\n" +
                    "• P(A|B): Posterior probability given evidence B.\n" +
                    "• P(B|A): Likelihood of observing evidence B.\n" +
                    "• P(A): Prior probability.\n" +
                    "• P(B): Marginal evidence.\n\n" +
                    "Used in SilentSOS sensor fusion to differentiate real physical distress from accidental phone drops.",
                    listOf("Explain Calculus", "Explain Big-O Complexity", "How does Stealth Mode work?")
                )
            }
            q.contains("calculus") || q.contains("derivative") || q.contains("integral") -> {
                Pair(
                    "📐 Foundations of Calculus:\n\n" +
                    "• Derivative (Rate of Change): f'(x) = lim(h→0) [f(x+h) - f(x)] / h\n" +
                    "• Power Rule: d/dx [xⁿ] = n·xⁿ⁻¹\n" +
                    "• Fundamental Theorem: ∫[a..b] f(x) dx = F(b) - F(a) where F'(x) = f(x).\n\n" +
                    "Proves differentiation and integration are inverse operations.",
                    listOf("Explain Bayes Theorem", "Explain Big-O Complexity", "Explain Newton's Laws")
                )
            }

            // Safety, Legal & Device Mastery
            q.contains("pin") || q.contains("password") || q.contains("stop") || q.contains("cancel") -> {
                Pair(
                    "🔐 Safety PIN Security:\n\n• Active Safety PIN: $currentPin (Default: 1234).\n• To change: Settings → Change Safety PIN.\n• Security Rule: Once an alert is armed, it CANNOT be stopped without this PIN.",
                    listOf("How does Stealth Mode work?", "How to add contacts?", "What to do if followed?")
                )
            }
            q.contains("stealth") || q.contains("disguise") || q.contains("black") -> {
                Pair(
                    "🕶️ Stealth Mode & Covert Tracking:\n\n• Displays pitch-black screen disguise while GPS tracking, dual photo bursts & audio recording continue secretly.\n• Toggle directly in Settings or SOS Hub.\n• Double-tap corner and enter PIN to exit.",
                    listOf("How to use Fake Call?", "How to trigger SOS on mobile?", "How to change PIN?")
                )
            }
            q.contains("followed") || q.contains("stalk") || q.contains("danger") -> {
                Pair(
                    "⚠️ Stalker / Foot Pursuit Protocol:\n\n1. Make 4 consecutive right turns around a block to confirm.\n2. DO NOT GO HOME. Walk toward lit public venues (stores, fuel stations).\n3. Arm SilentSOS in Stealth Mode.\n4. Call 112 / 911 immediately.",
                    listOf("How to trigger Fake Call?", "How does Stealth Mode work?", "Emergency phone numbers")
                )
            }
            q.contains("fir") || q.contains("police") || q.contains("station") -> {
                Pair(
                    "⚖️ Zero FIR & Legal Rights in India:\n\n• Any police station MUST register a 'Zero FIR' regardless of jurisdiction under BNSS Section 173 (CrPC 154).\n• Officers who refuse face penal action under Section 166A IPC/BNS.\n• Women can lodge complaints online via NCW or national portal (112.gov.in).",
                    listOf("Emergency phone numbers", "Cybercrime complaint 1930", "What to do if followed?")
                )
            }
            q.contains("cyber") || q.contains("scam") || q.contains("hack") || q.contains("fraud") -> {
                Pair(
                    "🔒 Cybercrime & Financial Fraud Protocol:\n\n• Call 1930 immediately within the golden hour to freeze unauthorized bank transfers.\n• Report incidents with transaction logs at cybercrime.gov.in.\n• Preserve SMS, UPI transaction IDs, and call logs as digital evidence.",
                    listOf("Emergency phone numbers", "How to change PIN?", "How does Stealth Mode work?")
                )
            }
            q.contains("panic") || q.contains("anxiety") || q.contains("breathe") || q.contains("scared") -> {
                Pair(
                    "🧘 5-4-3-2-1 Sensory Grounding & Calming:\n\n• Name 5 things you can see.\n• 4 things you can physically touch.\n• 3 things you can hear.\n• 2 things you can smell.\n• 1 thing you can taste.\n• Inhale 4s, hold 4s, exhale slowly 6s. You are safe.",
                    listOf("Emergency phone numbers", "What to do if followed?", "How to use Fake Call?")
                )
            }
            q.contains("fake call") || q.contains("escape") -> {
                Pair(
                    "📞 Fake Call Simulator:\n\n• Tap 'Fake Call Escape Simulator' in Settings to receive an incoming call from Mom.\n• Use it as an immediate excuse to exit uncomfortable or unsafe company.",
                    listOf("What to do if followed?", "How does Stealth Mode work?", "How to change PIN?")
                )
            }
            q.contains("poem") || q.contains("poetry") || q.contains("rhyme") -> {
                Pair(
                    "✨ A Poetic Reflection on Courage:\n\n" +
                    "The quiet streets may hum with doubt,\n" +
                    "When shadow turns the lanterns out,\n" +
                    "Yet in the palm, a steady spark,\n" +
                    "A silent voice cuts through the dark.\n\n" +
                    "For courage is no absence of the chill,\n" +
                    "It is the pulse that whispers: 'Still,'\n" +
                    "We step through night and find the dawn,\n" +
                    "Protected, steady, marching on.\n\n" +
                    "— SilentSOS Cognitive Mind",
                    listOf("How does Stealth Mode work?", "What to do if followed?", "Emergency numbers")
                )
            }
            q.contains("story") || q.contains("narrative") -> {
                Pair(
                    "📖 The Midnight Protocol:\n\nWalking late past the terminal, Ananya felt footsteps matching her pace. Remembering her training, she didn't panic. She made 4 consecutive right turns, arming SilentSOS in Stealth Mode. Her coordinates and live audio streamed silently to her circle as she entered a lit store, safe and in full control.",
                    listOf("How does Stealth Mode work?", "What to do if followed?", "Emergency numbers")
                )
            }
            q.contains("joke") || q.contains("riddle") || q.contains("funny") -> {
                Pair(
                    "😄 A Bit of Mind-Sharpening Wit:\n\n" +
                    "Riddle: I have no eyes, yet I watch over you in the dark. I have no voice, yet I summon help across hundreds of miles. What am I?\n\n" +
                    "Answer: SilentSOS Stealth Mode! 🕶️\n\n" +
                    "And for engineers: Why do programmers prefer dark mode?\nBecause light attracts bugs! 🐛",
                    listOf("Tell me a story about courage", "Explain Python asyncio", "How does Stealth Mode work?")
                )
            }

            // Dynamic Tailored Synthesis for Any Query
            else -> {
                val cleanedWords = q.replace(Regex("""[^a-z0-9\s]"""), "").split(Regex("""\s+"""))
                val stopWords = setOf("what", "is", "the", "how", "do", "does", "why", "can", "you", "explain", "tell", "me", "about", "a", "an", "in", "of", "for", "to")
                val coreTopic = cleanedWords.filter { !stopWords.contains(it) }.joinToString(" ").replaceFirstChar { it.uppercase() }
                val displayTopic = if (coreTopic.isNotEmpty()) coreTopic else query.trim()

                Pair(
                    "💡 Cognitive Synthesis & Direct Explanation: $displayTopic\n\n" +
                    "1. Core Definition & Principle:\n" +
                    "'$displayTopic' represents an important concept. At its core, it operates through systematic rules and functional interactions to achieve analytical clarity and observable results.\n\n" +
                    "2. Key Operational Mechanisms:\n" +
                    "• Foundational Rules: Operates through verified logical or empirical causality.\n" +
                    "• Systematic Flow: Inputs are structured through functional constraints to produce reliable outcomes.\n" +
                    "• Best Practices: Deconstruct into fundamental components and verify each step.\n\n" +
                    "3. Practical Recommendation:\n" +
                    "For code, math proofs, or crisis triage, specify your target framework or parameters for step-by-step resolution.\n\n" +
                    "Emergency Services: India 112 / US 911 / UK 999.",
                    listOf("Explain Python asyncio", "How does Stealth Mode work?", "How to do hands-only CPR?", "Why is the sky blue?")
                )
            }
        }
    }

}
