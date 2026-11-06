package com.silentsos.app

import android.os.Bundle
import android.view.Gravity
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.launch

/**
 * Data representation of an in-memory conversation message.
 * Stored strictly in volatile memory (never persisted to disk or database).
 */
data class ChatMessage(
    val role: String, // "user" or "assistant"
    val content: String,
    val suggestions: List<String> = emptyList(),
    val isError: Boolean = false
)

class AiAssistantActivity : AppCompatActivity() {

    private lateinit var apiClient: ApiClient
    private lateinit var locationHelper: LocationHelper
    private var currentLat: Double? = null
    private var currentLng: Double? = null

    private val messages = mutableListOf<ChatMessage>()
    private lateinit var chatAdapter: AiChatAdapter

    private var isLoading = false

    // View references
    private lateinit var scrollAiWelcome: ScrollView
    private lateinit var rvAiMessages: RecyclerView
    private lateinit var etAiInput: EditText
    private lateinit var btnAiSend: ImageButton
    private lateinit var pbAiLoading: ProgressBar
    private lateinit var btnAiBack: ImageButton
    private lateinit var btnAiReset: ImageButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_ai_assistant)

        apiClient = ApiClient(this)
        locationHelper = LocationHelper(this)

        // Read last known location if permissions are granted
        locationHelper.getSingleAccurateLocation { loc ->
            if (loc != null) {
                currentLat = loc.latitude
                currentLng = loc.longitude
            }
        }

        initViews()
        setupRecyclerView()
        setupListeners()
    }

    private fun initViews() {
        scrollAiWelcome = findViewById(R.id.scrollAiWelcome)
        rvAiMessages = findViewById(R.id.rvAiMessages)
        etAiInput = findViewById(R.id.etAiInput)
        btnAiSend = findViewById(R.id.btnAiSend)
        pbAiLoading = findViewById(R.id.pbAiLoading)
        btnAiBack = findViewById(R.id.btnAiBack)
        btnAiReset = findViewById(R.id.btnAiReset)
    }

    private fun setupRecyclerView() {
        chatAdapter = AiChatAdapter(messages) { suggestion ->
            sendQuery(suggestion)
        }
        val layoutManager = LinearLayoutManager(this)
        layoutManager.stackFromEnd = true
        rvAiMessages.layoutManager = layoutManager
        rvAiMessages.adapter = chatAdapter
    }

    private fun setupListeners() {
        btnAiBack.setOnClickListener {
            finish()
        }

        btnAiReset.setOnClickListener {
            resetConversation()
        }

        // Welcome prompt category cards
        findViewById<LinearLayout>(R.id.cardPromptMedical).setOnClickListener {
            sendQuery("What should I do if someone collapses?")
        }
        findViewById<LinearLayout>(R.id.cardPromptWomen).setOnClickListener {
            sendQuery("What should I do if someone is following me?")
        }
        findViewById<LinearLayout>(R.id.cardPromptLegal).setOnClickListener {
            sendQuery("What is a Zero FIR in India?")
        }
        findViewById<LinearLayout>(R.id.cardPromptFeatures).setOnClickListener {
            sendQuery("How does Stealth Mode work?")
        }

        // Send button
        btnAiSend.setOnClickListener {
            handleSend()
        }

        // Soft keyboard send action
        etAiInput.setOnEditorActionListener { _, actionId, event ->
            if (actionId == EditorInfo.IME_ACTION_SEND ||
                (event != null && event.keyCode == KeyEvent.KEYCODE_ENTER && !event.isShiftPressed)
            ) {
                handleSend()
                true
            } else {
                false
            }
        }
    }

    private fun handleSend() {
        val query = etAiInput.text.toString().trim()
        if (query.isEmpty() || isLoading) return
        sendQuery(query)
    }

    private fun sendQuery(queryText: String) {
        if (isLoading) return

        etAiInput.setText("")

        // Switch from Welcome view to Message Feed
        if (scrollAiWelcome.visibility != View.GONE) {
            scrollAiWelcome.visibility = View.GONE
            rvAiMessages.visibility = View.VISIBLE
        }

        // Add user question
        val userMsg = ChatMessage(role = "user", content = queryText)
        messages.add(userMsg)
        chatAdapter.notifyItemInserted(messages.size - 1)
        rvAiMessages.scrollToPosition(messages.size - 1)

        // Loading state
        setLoadingState(true)

        // Build bounded history: exclude current message, exclude errors, last 6
        val history = messages
            .dropLast(1)
            .filter { !it.isError }
            .takeLast(6)
            .map { Pair(it.role, it.content) }

        lifecycleScope.launch {
            val result = apiClient.sendAiChatMessage(
                message = queryText,
                history = history,
                latitude = currentLat,
                longitude = currentLng
            )

            setLoadingState(false)

            result.onSuccess { response ->
                val assistantMsg = ChatMessage(
                    role = "assistant",
                    content = response.reply,
                    suggestions = response.suggestions
                )
                messages.add(assistantMsg)
                chatAdapter.notifyItemInserted(messages.size - 1)
                rvAiMessages.smoothScrollToPosition(messages.size - 1)
            }.onFailure {
                val errorMsg = ChatMessage(
                    role = "assistant",
                    content = "Unable to connect to the SilentSOS safety assistant. Please try again. In an immediate emergency, contact your local emergency services.",
                    isError = true
                )
                messages.add(errorMsg)
                chatAdapter.notifyItemInserted(messages.size - 1)
                rvAiMessages.smoothScrollToPosition(messages.size - 1)
            }
        }
    }

    private fun setLoadingState(loading: Boolean) {
        isLoading = loading
        pbAiLoading.visibility = if (loading) View.VISIBLE else View.GONE
        btnAiSend.isEnabled = !loading
        btnAiSend.alpha = if (loading) 0.5f else 1.0f
    }

    private fun resetConversation() {
        if (isLoading) return
        val count = messages.size
        messages.clear()
        if (count > 0) {
            chatAdapter.notifyItemRangeRemoved(0, count)
        }
        scrollAiWelcome.visibility = View.VISIBLE
        rvAiMessages.visibility = View.GONE
        etAiInput.setText("")
    }

    /**
     * RecyclerView Adapter handling distinct User and Assistant bubble viewholders.
     */
    private class AiChatAdapter(
        private val items: List<ChatMessage>,
        private val onSuggestionClicked: (String) -> Unit
    ) : RecyclerView.Adapter<RecyclerView.ViewHolder>() {

        companion object {
            private const val TYPE_USER = 1
            private const val TYPE_ASSISTANT = 2
        }

        override fun getItemViewType(position: Int): Int {
            return if (items[position].role == "user") TYPE_USER else TYPE_ASSISTANT
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
            val inflater = LayoutInflater.from(parent.context)
            return if (viewType == TYPE_USER) {
                val v = inflater.inflate(R.layout.item_chat_bubble_user, parent, false)
                UserViewHolder(v)
            } else {
                val v = inflater.inflate(R.layout.item_chat_bubble_ai, parent, false)
                AssistantViewHolder(v)
            }
        }

        override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
            val item = items[position]
            if (holder is UserViewHolder) {
                holder.bind(item)
            } else if (holder is AssistantViewHolder) {
                holder.bind(item, onSuggestionClicked)
            }
        }

        override fun getItemCount(): Int = items.size

        class UserViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
            private val tvUserMessage: TextView = itemView.findViewById(R.id.tvUserMessage)

            fun bind(item: ChatMessage) {
                tvUserMessage.text = item.content
            }
        }

        class AssistantViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
            private val tvAiMessage: TextView = itemView.findViewById(R.id.tvAiMessage)
            private val layoutAiErrorNotice: LinearLayout = itemView.findViewById(R.id.layoutAiErrorNotice)
            private val scrollAiSuggestions: View = itemView.findViewById(R.id.scrollAiSuggestions)
            private val llAiSuggestions: LinearLayout = itemView.findViewById(R.id.llAiSuggestions)

            fun bind(item: ChatMessage, onSuggestionClicked: (String) -> Unit) {
                tvAiMessage.text = item.content

                // Connection / safety notice on errors
                layoutAiErrorNotice.visibility = if (item.isError) View.VISIBLE else View.GONE

                // Suggestions list
                if (item.suggestions.isNotEmpty()) {
                    scrollAiSuggestions.visibility = View.VISIBLE
                    llAiSuggestions.removeAllViews()

                    val context = itemView.context
                    val density = context.resources.displayMetrics.density
                    val marginEndPx = (8 * density).toInt()
                    val padStartEndPx = (14 * density).toInt()
                    val padTopBottomPx = (10 * density).toInt()
                    val minHeightPx = (48 * density).toInt()

                    for (suggestion in item.suggestions) {
                        val chip = TextView(context).apply {
                            text = suggestion
                            textSize = 12.5f
                            setTextColor(0xFF00E676.toInt()) // Tactical emerald accent
                            setBackgroundResource(R.drawable.bg_chip_suggestion)
                            setPadding(padStartEndPx, padTopBottomPx, padStartEndPx, padTopBottomPx)
                            minHeight = minHeightPx
                            gravity = Gravity.CENTER_VERTICAL
                            isClickable = true
                            isFocusable = true
                            setOnClickListener {
                                onSuggestionClicked(suggestion)
                            }
                        }

                        val lp = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        ).apply {
                            rightMargin = marginEndPx
                        }

                        llAiSuggestions.addView(chip, lp)
                    }
                } else {
                    scrollAiSuggestions.visibility = View.GONE
                    llAiSuggestions.removeAllViews()
                }
            }
        }
    }
}

