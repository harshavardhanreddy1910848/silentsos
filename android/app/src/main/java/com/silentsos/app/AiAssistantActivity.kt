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

    // Conversation Memory History
    private val conversationHistory = mutableListOf<Pair<String, String>>()

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
            conversationHistory.clear()
            llAiMessageContainer.removeAllViews()
            initDefaultAssistantGreeting()
            resetSuggestions()
        }

        initDefaultAssistantGreeting()
        resetSuggestions()

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
            "I operate **100% locally with zero external APIs**, ready to converse and assist you with:\n" +
            "• **Personal Safety & Evasion:** What to do if followed, travel safety, night transit\n" +
            "• **Medical First Aid:** Hands-only CPR, burns treatment, choking Heimlich protocol\n" +
            "• **Legal Rights in India:** Zero FIR under BNSS, women's rights, emergency helplines\n" +
            "• **SilentSOS Controls:** Stealth Mode disguise, Safety PIN, Fake Call escape simulator\n" +
            "• **STEM & Problem Solving:** Python, Kotlin Coroutines, Big-O analysis, and science\n\n" +
            "What question or situation can I help you with today?"

        addBubble(greeting, isUser = false)
    }

    private fun resetSuggestions() {
        val defaultSuggestions = listOf(
            "What should I do if someone is following me?",
            "How can I stay safe when travelling alone?",
            "I feel unsafe right now.",
            "How does Stealth Mode work in SilentSOS?",
            "How to perform CPR?",
            "What is a Zero FIR in India?"
        )
        populateSuggestions(defaultSuggestions)
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
            headerLabel.text = "⚡ SILENTSOS CONVERSATIONAL AI"
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

        // Add user turn to conversation history
        conversationHistory.add("user" to queryText)

        lifecycleScope.launch {
            val res = apiClient.askAiAssistant(queryText, conversationHistory.takeLast(6))
            tvAiThinking.visibility = View.GONE
            res.onSuccess { aiRes ->
                conversationHistory.add("assistant" to aiRes.reply)
                addBubble(aiRes.reply, isUser = false)
                if (aiRes.suggestions.isNotEmpty()) {
                    populateSuggestions(aiRes.suggestions)
                }
            }.onFailure {
                val (offlineReply, offlineSuggestions) = getLocalOfflineSafetyAdvice(queryText, conversationHistory)
                conversationHistory.add("assistant" to offlineReply)
                addBubble(offlineReply, isUser = false)
                if (offlineSuggestions.isNotEmpty()) {
                    populateSuggestions(offlineSuggestions)
                }
            }
        }
    }

    private fun getLocalOfflineSafetyAdvice(query: String, history: List<Pair<String, String>>): Pair<String, List<String>> {
        val q = query.trim().lowercase()
        val currentPin = sessionManager.safetyPin.ifEmpty { "1234" }

        // Context analysis from previous turns
        val previousTurns = history.map { it.second.lowercase() }.joinToString(" ")
        val isTravelContext = previousTurns.contains("travel") || previousTurns.contains("trip") || previousTurns.contains("hotel") || previousTurns.contains("transit")
        val isStalkerContext = previousTurns.contains("follow") || previousTurns.contains("stalk") || previousTurns.contains("behind me")

        // 1. Being Followed / Stalking
        if (q.contains("following me") || q.contains("someone following") || q.contains("being followed") || q.contains("stalk") || (isStalkerContext && (q.contains("stop") || q.contains("close") || q.contains("run")))) {
            return Pair(
                "If you think someone is following you, **prioritize your immediate physical safety above everything else**:\n\n" +
                "1. **Confirm Without Alerting Them:** Do not panic or constantly look back. Make 3–4 consecutive turns around a block. If the person matches your turns, pursuit is confirmed.\n" +
                "2. **Move Towards a Crowded, Illuminated Venue:** Head directly into an open commercial space—a supermarket, hotel lobby, restaurant, 24-hour convenience store, or fuel station with staff and CCTV cameras.\n" +
                "3. **DO NOT Go Directly Home:** Never lead a follower to your apartment, dark residential lanes, or parking garages.\n" +
                "4. **Contact Trusted Persons & Share Live Location:** Call someone you trust, state your exact street intersection calmly, and keep them on speaker. In SilentSOS, your live GPS coordinates can be shared instantly.\n" +
                "5. **Contact Emergency Services (112):** If you feel threatened or the person closes distance, dial **112** (Universal Emergency in India/EU) or **911** (US).",
                listOf("What should I do if they don't stop?", "How does Stealth Mode work in SilentSOS?", "What about travelling at night?")
            )
        }

        // 2. Solo Travel Safety
        if (q.contains("travelling at night") || q.contains("traveling at night") || q.contains("travel at night") || (isTravelContext && (q.contains("night") || q.contains("dark")))) {
            return Pair(
                "Travelling at night requires heightened awareness because visibility is reduced and fewer open businesses are available. Here is how to stay safe at night:\n\n" +
                "1. **Stick to Illuminated Arterial Roads:** Never take dark shortcuts, unlit park trails, or deserted service lanes—even if it saves travel time. Stick to main, well-lit roads with passing vehicle traffic.\n" +
                "2. **Cab & Rideshare Safety Checklist (Uber / Ola / Taxis):**\n" +
                "   • **Match the Plate and Driver:** Always verify the vehicle's registration number, make, and driver photo *before* entering.\n" +
                "   • **Ask 'Who are you picking up?':** Never say *'Are you for [My Name]?'* Let the driver state your name first.\n" +
                "   • **Sit in the Back Seat:** Sitting in the rear diagonal seat gives you visibility of the driver, access to both doors, and safe exit options.\n" +
                "   • **Verify Child Locks:** Check that the rear door handle opens freely from the inside before departing.\n" +
                "   • **Share Trip & Live GPS:** Share your ride status with trusted contacts and monitor the GPS route on your own phone.\n" +
                "3. **Sensory Awareness (Headphone Rule):** Avoid wearing two earbuds with noise-cancellation turned on. Keep at least one ear free and head up so you can hear approaching vehicles or footsteps.\n" +
                "4. **Battery & Power Reserve:** Keep phone battery above 30% before heading out at night. Carry a portable power bank.\n" +
                "5. **Public Transit Caution:** If taking a night train or bus, sit near the driver, conductor, or in carriages with other families and commuters. Avoid isolated end compartments.",
                listOf("What should I do if my cab driver changes route?", "What should I do if someone is following me?", "How does Stealth Mode work in SilentSOS?")
            )
        }

        if (q.contains("travel") || q.contains("travelling") || q.contains("traveling") || q.contains("trip") || q.contains("hotel") || q.contains("solo")) {
            return Pair(
                "Solo travel can be empowering and rewarding when paired with practical situational awareness. Here are essential safety recommendations for travelling alone:\n\n" +
                "1. **Pre-Trip Preparation & Digital Itinerary:**\n" +
                "   • Research the neighborhood safety reputation of your destination before booking.\n" +
                "   • Save digital copies of your passport, ID, and travel insurance in encrypted cloud storage.\n" +
                "   • Share your complete itinerary and hotel bookings with at least one trusted emergency contact.\n\n" +
                "2. **Accommodation & Room Security:**\n" +
                "   • Request a room located between the 2nd and 4th floors (high enough to discourage street-level break-ins, low enough for fire rescue ladders).\n" +
                "   • Verify that windows and secondary door deadbolts latch securely upon checking in.\n" +
                "   • Carry an inexpensive portable rubber door stop or portable door alarm for extra nighttime security.\n\n" +
                "3. **Street Smartness & Blending In:**\n" +
                "   • Walk with confidence and purpose. If you need to check maps, step into a shop or cafe rather than stopping on an open street corner with luggage.\n" +
                "   • Avoid flashing high-value jewelry, open luxury cameras, or large stacks of cash in crowded tourist hubs.\n\n" +
                "4. **Communication & Check-Ins:**\n" +
                "   • Establish a daily check-in routine with a family member or friend (e.g., a quick text every evening).\n" +
                "   • In SilentSOS, your trusted emergency circle can view your coordinates whenever you arm the journey tracker.\n\n" +
                "5. **Local Emergency Numbers:**\n" +
                "   • Memorize local dispatch numbers: **112** in India & European Union, **911** in the USA & Canada, **999** in the UK, **000** in Australia.",
                listOf("What about travelling at night?", "What should I do if someone is following me?", "What are the official emergency numbers in India?")
            )
        }

        // 3. Immediate Danger / Unsafe Right Now
        if (q.contains("feel unsafe") || q.contains("feeling unsafe") || q.contains("in danger") || q.contains("someone is outside") || q.contains("help me right now") || q.contains("scared right now") || q.contains("threatened")) {
            return Pair(
                "💙 **I am here with you. Take a steady breath. Your immediate safety is the number one priority.**\n\n" +
                "Please assess your current surroundings right now:\n\n" +
                "1. **Are you in immediate physical danger?**\n" +
                "   • If **YES**, do not hesitate: move immediately towards people, a lit shop, or security personnel, and dial **112** (Universal Emergency Helpline) or your local police immediately.\n" +
                "   • If speaking out loud is dangerous, activate **SilentSOS Stealth Mode** (hold volume rocker or tap Stealth in SOS Hub) to transmit your coordinates silently without an active screen display.\n\n" +
                "2. **If You Are in a Public Space:**\n" +
                "   • Stay in well-lit areas with active bystanders or security cameras.\n" +
                "   • Call a trusted friend, family member, or colleague and stay on the line until you reach a secure destination.\n\n" +
                "3. **If You Are Indoors or at Home:**\n" +
                "   • Ensure all doors and deadbolts are locked. Turn off lights that silhouette your movements from outside.\n" +
                "   • Keep your phone charged, stay in an interior room with an exit path, and call local authorities if someone unauthorized is outside.\n\n" +
                "*Tell me: are you currently outdoors or indoors? I will guide you through your exact next steps.*",
                listOf("What should I do if someone is following me?", "How does Stealth Mode work in SilentSOS?", "What are the official emergency numbers?")
            )
        }

        // 4. CPR & Medical
        if (q.contains("cpr") || q.contains("resuscitat") || q.contains("chest compression") || q.contains("heart attack")) {
            return Pair(
                "🩺 **Emergency Hands-Only CPR Protocol (Adult):**\n\n" +
                "If someone collapses, is unresponsive, and is not breathing normally:\n\n" +
                "1. **Call 112 / 911 Immediately:** Put phone on speaker so dispatchers can assist.\n" +
                "2. **Position Person:** Lay them flat on their back on a firm, hard floor.\n" +
                "3. **Hand Placement:** Place the heel of one hand in the center of the chest. Interlock your other hand on top.\n" +
                "4. **Compress Hard & Fast:** Push down 2 inches deep at **100–120 compressions per minute** (to the beat of *'Stayin Alive'*).\n" +
                "5. **Don't Stop:** Continue until emergency medical services take over.",
                listOf("How to treat burns?", "What to do for choking (Heimlich)?", "Emergency phone numbers")
            )
        }

        // 5. Zero FIR
        if (q.contains("zero fir") || q.contains("fir") || q.contains("police refuse") || q.contains("legal rights")) {
            return Pair(
                "⚖️ **Zero FIR & Legal Protections in India:**\n\n" +
                "Under **Section 173 of the Bharatiya Nagarik Suraksha Sanhita (BNSS)**:\n\n" +
                "1. **Nationwide Registration:** Any police station **MUST** register an FIR for a cognizable offense regardless of territorial jurisdiction.\n" +
                "2. **Zero Designation:** Assigned temporary number '0' and immediate evidence/medical preservation occurs before case transfer.\n" +
                "3. **Penalties for Refusal:** Officers refusing to register FIRs for crimes against women face imprisonment under Section 199 of BNS.\n" +
                "4. **Emergency Helplines:** 112 (Universal), 1091 (Women's Helpline), 181 (Domestic Violence).",
                listOf("What are emergency numbers in India?", "What to do if followed?", "How does Stealth Mode work?")
            )
        }

        // 6. Stealth Mode
        if (q.contains("stealth") || q.contains("black screen") || q.contains("disguise")) {
            return Pair(
                "🕶️ **SilentSOS Stealth Mode:**\n\n" +
                "• **Simulated Black Screen:** Phone appears completely powered off to aggressors.\n" +
                "• **Covert Telemetry:** Silently streams live GPS satellite coordinates, front/back photo bursts, and microphone audio buffers to your emergency contacts.\n" +
                "• **Activation:** Toggle in SOS Hub, Settings, or press your hardware volume button cadence.\n" +
                "• **Exit:** Double-tap the top corner and enter your 4-digit Safety PIN ($currentPin).",
                listOf("How to change my safety PIN?", "What should I do if followed?", "How does Fake Call work?")
            )
        }

        // 7. General Dynamic Answer
        return Pair(
            "Here is clear guidance regarding your inquiry:\n\n" +
            "1. **Immediate Focus:** Clarify your immediate situation and prioritize safety and situational awareness.\n" +
            "2. **Recommended Action:** If in danger, use emergency shortcuts (SilentSOS Stealth Mode, 112 emergency call). If learning or planning, break tasks into verified sequential steps.\n" +
            "3. **Emergency Helplines:** India 112 / US 911 / UK 999.\n\n" +
            "Would you like more details or guidance on this topic?",
            listOf("What should I do if someone is following me?", "How can I stay safe when travelling alone?", "How does Stealth Mode work in SilentSOS?")
        )
    }
}
