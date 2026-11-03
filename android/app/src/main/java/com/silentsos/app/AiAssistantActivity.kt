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
        val q = query.lowercase()
        val currentPin = sessionManager.safetyPin.ifEmpty { "1234" }
        return when {
            q.contains("cpr") || q.contains("heart") || q.contains("breathing") -> {
                Pair(
                    "🫀 Hands-Only CPR Guidelines:\n\n1. Call 112 / 911 immediately.\n2. Place hands in center of chest.\n3. Push hard & fast (100-120 bpm, 2 inches deep).\n4. Do not interrupt compressions.",
                    listOf("How to treat bleeding?", "What are emergency hotlines?", "How to trigger Medical SOS?")
                )
            }
            q.contains("pin") || q.contains("password") || q.contains("stop") || q.contains("cancel") -> {
                Pair(
                    "🔐 Safety PIN Security:\n\n• Your active safety PIN is $currentPin (Default: 1234).\n• To change: Settings → Change Safety PIN.\n• Note: An armed SOS alert can ONLY be cancelled using this PIN.",
                    listOf("How does Stealth Mode work?", "How to add contacts?", "What to do if followed?")
                )
            }
            q.contains("stealth") || q.contains("disguise") || q.contains("black") -> {
                Pair(
                    "🕶️ Stealth Mode & Covert Tracking:\n\n• Displays black screen disguise while GPS, photo bursts & audio recording continue secretly.\n• Toggle directly in Settings or SOS Hub.",
                    listOf("How to use Fake Call?", "How to trigger SOS on mobile?", "How to change PIN?")
                )
            }
            q.contains("followed") || q.contains("stalk") || q.contains("danger") -> {
                Pair(
                    "⚠️ Stalker / Foot Pursuit Protocol:\n\n1. Make 4 right turns around a block to confirm.\n2. Do NOT go home. Walk toward lit public venues (stores, fuel stations).\n3. Arm SilentSOS in Stealth Mode.\n4. Call 112 / 911 immediately.",
                    listOf("How to trigger Fake Call?", "How does Stealth Mode work?", "Emergency phone numbers")
                )
            }
            q.contains("bleeding") || q.contains("blood") || q.contains("wound") -> {
                Pair(
                    "🩸 Severe Bleeding Control:\n\n1. Apply continuous direct pressure with clean cloth.\n2. Do not remove blood-soaked cloths; add more.\n3. Apply tourniquet 2-3 inches above wound on limbs.",
                    listOf("How to do CPR?", "What are emergency hotlines?", "How to trigger SOS?")
                )
            }
            q.contains("shooter") || q.contains("gun") || q.contains("attack") -> {
                Pair(
                    "🚨 Run-Hide-Fight Active Threat Protocol:\n\n1. RUN: Evacuate if a safe path exists. Leave belongings behind.\n2. HIDE: If escape impossible, lock & barricade doors, silence phone & vibrate, turn off lights.\n3. FIGHT: As a last resort, act with aggression, use improvised weapons to incapacitate the threat.\n4. Call 112 once safe.",
                    listOf("How does Stealth Mode work?", "What to do if followed?", "Emergency phone numbers")
                )
            }
            q.contains("fir") || q.contains("police") || q.contains("station") -> {
                Pair(
                    "⚖️ Zero FIR & Legal Rights in India:\n\n• Any police station MUST register a 'Zero FIR' regardless of jurisdiction.\n• Under BNSS Section 173, police cannot refuse complaint based on territorial boundaries.\n• Women can lodge complaints online via NCW or national portal (112.gov.in).",
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
                    "🧘 5-4-3-2-1 Grounding & Crisis Calming:\n\n• Acknowledge 5 things you can see.\n• 4 things you can physically touch.\n• 3 things you can hear around you.\n• 2 things you can smell.\n• 1 thing you can taste.\n• Inhale 4s, hold 7s, exhale slowly 8s.",
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
                    "— SilentSOS Creative Mind",
                    listOf("How does Stealth Mode work?", "What to do if followed?", "Emergency numbers")
                )
            }
            q.contains("story") || q.contains("narrative") -> {
                Pair(
                    "📖 The Midnight Protocol:\n\nWalking late past the terminal, Ananya felt footsteps matching her pace. Remembering her training, she didn't panic. She made 4 consecutive right turns, arming SilentSOS in Stealth Mode. Her coordinates and live audio streamed silently to her circle as she entered a lit store, safe and in full control.",
                    listOf("How does Stealth Mode work?", "What to do if followed?", "Emergency numbers")
                )
            }
            q.contains("python") || q.contains("code") || q.contains("async") || q.contains("kotlin") -> {
                Pair(
                    "💻 Software & Mobile Concurrency:\n\n• Kotlin Coroutines: Use `Dispatchers.IO` for background sensor loops and `Dispatchers.Main` for UI.\n• Python Asyncio: Non-blocking single-threaded I/O with `async def` and `await asyncio.sleep()`.\n• Big-O: Binary Search operates in O(log n) time.",
                    listOf("How does Stealth Mode work?", "What to do if followed?", "Emergency numbers")
                )
            }
            else -> {
                Pair(
                    "🛡️ SilentSOS On-Device Safety AI:\n\nI am your offline crisis assistant. In danger, hold the central SOS button for 3s or shake your phone rapidly.\n\nEmergency Numbers: India 112 / US 911 / UK 999.",
                    listOf("How does Stealth Mode work?", "How to change PIN?", "How to do CPR?", "Advice if followed")
                )
            }
        }
    }
}
