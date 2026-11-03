package com.silentsos.app

import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.LayoutInflater
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class AdminDashboardActivity : AppCompatActivity() {

    private lateinit var apiClient: ApiClient
    private lateinit var sessionManager: SessionManager

    // Top Header Views
    private lateinit var tvAdminActiveBadge: TextView
    private lateinit var ivAdminRefresh: ImageView
    private lateinit var ivAdminLogout: ImageView
    private lateinit var pbAdminMainLoading: ProgressBar

    // Tab Navigation
    private lateinit var tabNavDashboard: TextView
    private lateinit var tabNavAlerts: TextView
    private lateinit var tabNavUsers: TextView
    private lateinit var tabNavFeedback: TextView
    private lateinit var tabNavSettings: TextView

    // Tab View Containers
    private lateinit var llViewDashboard: LinearLayout
    private lateinit var llViewAlerts: LinearLayout
    private lateinit var llViewUsers: LinearLayout
    private lateinit var llViewFeedback: LinearLayout
    private lateinit var llViewSettings: LinearLayout

    // Dashboard Tab Views
    private lateinit var llActiveIncidentBanner: LinearLayout
    private lateinit var tvActiveBannerTimer: TextView
    private lateinit var tvActiveBannerDetails: TextView
    private lateinit var btnActiveBannerResolve: View
    private lateinit var tvDashTotalUsers: TextView
    private lateinit var tvDashActiveAlerts: TextView
    private lateinit var tvDashTotalFeedback: TextView
    private lateinit var tvDashAvgRating: TextView
    private lateinit var llRecentActivitiesList: LinearLayout
    private lateinit var llRecentFeedbackList: LinearLayout

    // Alerts Tab Views
    private lateinit var chipAlertsAll: TextView
    private lateinit var chipAlertsActive: TextView
    private lateinit var chipAlertsSent: TextView
    private lateinit var chipAlertsCancelled: TextView
    private lateinit var etAlertsSearch: EditText
    private lateinit var llAlertsList: LinearLayout

    // Users Tab Views
    private lateinit var etUsersSearch: EditText
    private lateinit var tvUsersCountLabel: TextView
    private lateinit var llUsersList: LinearLayout

    // Feedback Tab Views
    private lateinit var chipFbCatAll: TextView
    private lateinit var chipFbCatBug: TextView
    private lateinit var chipFbCatFeature: TextView
    private lateinit var chipFbCatUi: TextView
    private lateinit var chipFbCatGeneral: TextView
    private lateinit var etFeedbackSearch: EditText
    private lateinit var llFeedbackList: LinearLayout

    // Settings Tab Views
    private lateinit var etAdminProfileName: EditText
    private lateinit var etAdminProfileNewPass: EditText
    private lateinit var btnAdminSaveProfile: View
    private lateinit var etGlobalEmails: EditText
    private lateinit var etGlobalSmsTemplate: EditText
    private lateinit var tvSensLow: TextView
    private lateinit var tvSensMed: TextView
    private lateinit var tvSensHigh: TextView
    private lateinit var btnSaveGlobalSettings: View

    // In-Memory Data Caches
    private var allAlerts: List<AdminAlertItem> = emptyList()
    private var allUsers: List<AdminUserItem> = emptyList()
    private var allFeedback: List<AdminFeedbackItem> = emptyList()
    private var currentSettings: AdminSettingsData? = null

    // State Variables
    private enum class AdminTab { DASHBOARD, ALERTS, USERS, FEEDBACK, SETTINGS }
    private var activeTab = AdminTab.DASHBOARD
    private var currentAlertsFilter = "All"
    private var currentFeedbackCategory = "All"
    private var selectedSensitivity = "Medium"
    private var pollJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_dashboard)

        apiClient = ApiClient(this)
        sessionManager = SessionManager(this)

        if (!sessionManager.isLoggedIn || !sessionManager.isAdmin) {
            Toast.makeText(this, "Administrator clearance required.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, AdminLoginActivity::class.java))
            finish()
            return
        }

        bindViews()
        setupListeners()
        selectTab(AdminTab.DASHBOARD)
        loadInitialData()
        startPeriodicPolling()
    }

    override fun onDestroy() {
        super.onDestroy()
        pollJob?.cancel()
    }

    private fun bindViews() {
        tvAdminActiveBadge = findViewById(R.id.tvAdminActiveBadge)
        ivAdminRefresh = findViewById(R.id.ivAdminRefresh)
        ivAdminLogout = findViewById(R.id.ivAdminLogout)
        pbAdminMainLoading = findViewById(R.id.pbAdminMainLoading)

        tabNavDashboard = findViewById(R.id.tabNavDashboard)
        tabNavAlerts = findViewById(R.id.tabNavAlerts)
        tabNavUsers = findViewById(R.id.tabNavUsers)
        tabNavFeedback = findViewById(R.id.tabNavFeedback)
        tabNavSettings = findViewById(R.id.tabNavSettings)

        llViewDashboard = findViewById(R.id.llViewDashboard)
        llViewAlerts = findViewById(R.id.llViewAlerts)
        llViewUsers = findViewById(R.id.llViewUsers)
        llViewFeedback = findViewById(R.id.llViewFeedback)
        llViewSettings = findViewById(R.id.llViewSettings)

        // Dashboard
        llActiveIncidentBanner = findViewById(R.id.llActiveIncidentBanner)
        tvActiveBannerTimer = findViewById(R.id.tvActiveBannerTimer)
        tvActiveBannerDetails = findViewById(R.id.tvActiveBannerDetails)
        btnActiveBannerResolve = findViewById(R.id.btnActiveBannerResolve)
        tvDashTotalUsers = findViewById(R.id.tvDashTotalUsers)
        tvDashActiveAlerts = findViewById(R.id.tvDashActiveAlerts)
        tvDashTotalFeedback = findViewById(R.id.tvDashTotalFeedback)
        tvDashAvgRating = findViewById(R.id.tvDashAvgRating)
        llRecentActivitiesList = findViewById(R.id.llRecentActivitiesList)
        llRecentFeedbackList = findViewById(R.id.llRecentFeedbackList)

        // Alerts
        chipAlertsAll = findViewById(R.id.chipAlertsAll)
        chipAlertsActive = findViewById(R.id.chipAlertsActive)
        chipAlertsSent = findViewById(R.id.chipAlertsSent)
        chipAlertsCancelled = findViewById(R.id.chipAlertsCancelled)
        etAlertsSearch = findViewById(R.id.etAlertsSearch)
        llAlertsList = findViewById(R.id.llAlertsList)

        // Users
        etUsersSearch = findViewById(R.id.etUsersSearch)
        tvUsersCountLabel = findViewById(R.id.tvUsersCountLabel)
        llUsersList = findViewById(R.id.llUsersList)

        // Feedback
        chipFbCatAll = findViewById(R.id.chipFbCatAll)
        chipFbCatBug = findViewById(R.id.chipFbCatBug)
        chipFbCatFeature = findViewById(R.id.chipFbCatFeature)
        chipFbCatUi = findViewById(R.id.chipFbCatUi)
        chipFbCatGeneral = findViewById(R.id.chipFbCatGeneral)
        etFeedbackSearch = findViewById(R.id.etFeedbackSearch)
        llFeedbackList = findViewById(R.id.llFeedbackList)

        // Settings
        etAdminProfileName = findViewById(R.id.etAdminProfileName)
        etAdminProfileNewPass = findViewById(R.id.etAdminProfileNewPass)
        btnAdminSaveProfile = findViewById(R.id.btnAdminSaveProfile)
        etGlobalEmails = findViewById(R.id.etGlobalEmails)
        etGlobalSmsTemplate = findViewById(R.id.etGlobalSmsTemplate)
        tvSensLow = findViewById(R.id.tvSensLow)
        tvSensMed = findViewById(R.id.tvSensMed)
        tvSensHigh = findViewById(R.id.tvSensHigh)
        btnSaveGlobalSettings = findViewById(R.id.btnSaveGlobalSettings)
    }

    private fun setupListeners() {
        // Tab Bar Clicks
        tabNavDashboard.setOnClickListener { selectTab(AdminTab.DASHBOARD) }
        tabNavAlerts.setOnClickListener { selectTab(AdminTab.ALERTS) }
        tabNavUsers.setOnClickListener { selectTab(AdminTab.USERS) }
        tabNavFeedback.setOnClickListener { selectTab(AdminTab.FEEDBACK) }
        tabNavSettings.setOnClickListener { selectTab(AdminTab.SETTINGS) }

        // Header Actions
        ivAdminRefresh.setOnClickListener {
            loadInitialData()
            Toast.makeText(this, "Admin records refreshed", Toast.LENGTH_SHORT).show()
        }

        ivAdminLogout.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Administrator Sign Out")
                .setMessage("Are you sure you want to end your administrative security session?")
                .setPositiveButton("Sign Out") { _, _ ->
                    sessionManager.logout()
                    val intent = Intent(this, AuthActivity::class.java)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    finish()
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        // Alerts Filter Chips
        chipAlertsAll.setOnClickListener { setAlertFilter("All", chipAlertsAll) }
        chipAlertsActive.setOnClickListener { setAlertFilter("Active", chipAlertsActive) }
        chipAlertsSent.setOnClickListener { setAlertFilter("Sent", chipAlertsSent) }
        chipAlertsCancelled.setOnClickListener { setAlertFilter("Cancelled", chipAlertsCancelled) }

        etAlertsSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { renderAlertsList() }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        // Users Search
        etUsersSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { renderUsersList() }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        // Feedback Category Chips
        chipFbCatAll.setOnClickListener { setFeedbackCategory("All", chipFbCatAll) }
        chipFbCatBug.setOnClickListener { setFeedbackCategory("Bug", chipFbCatBug) }
        chipFbCatFeature.setOnClickListener { setFeedbackCategory("Feature", chipFbCatFeature) }
        chipFbCatUi.setOnClickListener { setFeedbackCategory("UI/UX", chipFbCatUi) }
        chipFbCatGeneral.setOnClickListener { setFeedbackCategory("General", chipFbCatGeneral) }

        etFeedbackSearch.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) { renderFeedbackList() }
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
        })

        // Settings Sensitivity
        tvSensLow.setOnClickListener { setSensitivity("Low") }
        tvSensMed.setOnClickListener { setSensitivity("Medium") }
        tvSensHigh.setOnClickListener { setSensitivity("High") }

        btnAdminSaveProfile.setOnClickListener { saveAdminProfile() }
        btnSaveGlobalSettings.setOnClickListener { saveGlobalSettings() }
    }

    private fun selectTab(tab: AdminTab) {
        activeTab = tab

        // Update tab button appearances
        val tabs = listOf(
            tabNavDashboard to AdminTab.DASHBOARD,
            tabNavAlerts to AdminTab.ALERTS,
            tabNavUsers to AdminTab.USERS,
            tabNavFeedback to AdminTab.FEEDBACK,
            tabNavSettings to AdminTab.SETTINGS
        )

        for ((view, t) in tabs) {
            if (t == tab) {
                view.setBackgroundResource(R.drawable.bg_auth_tab_active)
                view.setTextColor(Color.WHITE)
            } else {
                view.setBackgroundColor(Color.TRANSPARENT)
                view.setTextColor(Color.parseColor("#94a3b8"))
            }
        }

        // Toggle container visibilities
        llViewDashboard.visibility = if (tab == AdminTab.DASHBOARD) View.VISIBLE else View.GONE
        llViewAlerts.visibility = if (tab == AdminTab.ALERTS) View.VISIBLE else View.GONE
        llViewUsers.visibility = if (tab == AdminTab.USERS) View.VISIBLE else View.GONE
        llViewFeedback.visibility = if (tab == AdminTab.FEEDBACK) View.VISIBLE else View.GONE
        llViewSettings.visibility = if (tab == AdminTab.SETTINGS) View.VISIBLE else View.GONE
    }

    private fun loadInitialData() {
        pbAdminMainLoading.visibility = View.VISIBLE

        lifecycleScope.launch {
            // Load stats, alerts, users, feedback, and settings in parallel
            val statsDeferred = apiClient.fetchAdminStats()
            val alertsDeferred = apiClient.fetchAdminAlerts()
            val usersDeferred = apiClient.fetchAdminUsers()
            val feedbackDeferred = apiClient.fetchAdminFeedback()
            val settingsDeferred = apiClient.fetchAdminSettings()

            pbAdminMainLoading.visibility = View.GONE

            alertsDeferred.onSuccess {
                allAlerts = it
                updateActiveBadge()
                renderDashboardActivities()
                renderAlertsList()
            }

            usersDeferred.onSuccess {
                allUsers = it
                tvDashTotalUsers.text = it.size.toString()
                renderUsersList()
            }

            feedbackDeferred.onSuccess {
                allFeedback = it
                tvDashTotalFeedback.text = it.size.toString()
                renderDashboardFeedback()
                renderFeedbackList()
            }

            statsDeferred.onSuccess { stats ->
                tvDashTotalUsers.text = stats.totalUsers.toString()
                tvDashActiveAlerts.text = stats.activeAlerts.toString()
                tvDashTotalFeedback.text = stats.totalFeedback.toString()
                tvDashAvgRating.text = "${stats.avgRating} ★"
            }

            settingsDeferred.onSuccess { settings ->
                currentSettings = settings
                populateSettings(settings)
            }
        }
    }

    private fun startPeriodicPolling() {
        pollJob?.cancel()
        pollJob = lifecycleScope.launch {
            while (isActive) {
                delay(12000) // Poll every 12 seconds for real-time emergency events
                apiClient.fetchAdminAlerts().onSuccess {
                    allAlerts = it
                    updateActiveBadge()
                    if (activeTab == AdminTab.DASHBOARD) {
                        renderDashboardActivities()
                    } else if (activeTab == AdminTab.ALERTS) {
                        renderAlertsList()
                    }
                }
            }
        }
    }

    private fun updateActiveBadge() {
        val activeCount = allAlerts.count { it.status.equals("Active", ignoreCase = true) }
        tvDashActiveAlerts.text = activeCount.toString()
        if (activeCount > 0) {
            tvAdminActiveBadge.visibility = View.VISIBLE
            tvAdminActiveBadge.text = "$activeCount ACTIVE"

            // Active incident banner
            val firstActive = allAlerts.firstOrNull { it.status.equals("Active", ignoreCase = true) }
            if (firstActive != null) {
                llActiveIncidentBanner.visibility = View.VISIBLE
                val elapsedMin = Math.max(1, (System.currentTimeMillis() - firstActive.timestamp) / 60000)
                tvActiveBannerTimer.text = "${elapsedMin}m AGO"
                tvActiveBannerDetails.text = "User: ${firstActive.userName} (${firstActive.userEmail})\nType: ${firstActive.type}"
                btnActiveBannerResolve.setOnClickListener {
                    resolveAlert(firstActive.id)
                }
            }
        } else {
            tvAdminActiveBadge.visibility = View.GONE
            llActiveIncidentBanner.visibility = View.GONE
        }
    }

    // ==========================================
    // 📊 TAB 1: DASHBOARD RENDERING
    // ==========================================

    private fun renderDashboardActivities() {
        llRecentActivitiesList.removeAllViews()
        val recent = allAlerts.take(5)
        if (recent.isEmpty()) {
            val emptyTv = TextView(this).apply {
                text = "No emergency alert events recorded yet."
                setTextColor(Color.parseColor("#64748b"))
                textSize = 12f
                setPadding(0, 8, 0, 8)
            }
            llRecentActivitiesList.addView(emptyTv)
            return
        }

        for (alert in recent) {
            val card = createAlertCardView(alert, compact = true)
            llRecentActivitiesList.addView(card)
        }
    }

    private fun renderDashboardFeedback() {
        llRecentFeedbackList.removeAllViews()
        val recent = allFeedback.take(3)
        if (recent.isEmpty()) {
            val emptyTv = TextView(this).apply {
                text = "No user feedback entries available."
                setTextColor(Color.parseColor("#64748b"))
                textSize = 12f
                setPadding(0, 8, 0, 8)
            }
            llRecentFeedbackList.addView(emptyTv)
            return
        }

        for (fb in recent) {
            val card = createFeedbackCardView(fb)
            llRecentFeedbackList.addView(card)
        }
    }

    // ==========================================
    // 🚨 TAB 2: ALERTS LIST & RESOLUTION
    // ==========================================

    private fun setAlertFilter(status: String, selectedChip: TextView) {
        currentAlertsFilter = status
        val chips = listOf(chipAlertsAll, chipAlertsActive, chipAlertsSent, chipAlertsCancelled)
        for (c in chips) {
            if (c == selectedChip) {
                c.setBackgroundResource(R.drawable.bg_auth_tab_active)
                c.setTextColor(Color.WHITE)
            } else {
                c.setBackgroundResource(R.drawable.bg_card_surface)
                c.setTextColor(Color.parseColor("#94a3b8"))
            }
        }
        renderAlertsList()
    }

    private fun renderAlertsList() {
        llAlertsList.removeAllViews()
        val query = etAlertsSearch.text.toString().trim().lowercase()

        val filtered = allAlerts.filter { alert ->
            val matchFilter = when (currentAlertsFilter) {
                "Active" -> alert.status.equals("Active", ignoreCase = true)
                "Sent" -> alert.status.equals("Sent", ignoreCase = true) || alert.status.equals("Resolved", ignoreCase = true)
                "Cancelled" -> alert.status.equals("Cancelled", ignoreCase = true)
                else -> true
            }

            val matchQuery = query.isEmpty() ||
                    alert.userName.lowercase().contains(query) ||
                    alert.userEmail.lowercase().contains(query) ||
                    alert.type.lowercase().contains(query) ||
                    alert.id.lowercase().contains(query)

            matchFilter && matchQuery
        }

        if (filtered.isEmpty()) {
            val emptyTv = TextView(this).apply {
                text = "No alerts found matching filter criteria."
                setTextColor(Color.parseColor("#64748b"))
                textSize = 12f
                setPadding(0, 16, 0, 16)
            }
            llAlertsList.addView(emptyTv)
            return
        }

        for (alert in filtered) {
            val card = createAlertCardView(alert, compact = false)
            llAlertsList.addView(card)
        }
    }

    private fun createAlertCardView(alert: AdminAlertItem, compact: Boolean): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundResource(R.drawable.bg_card_surface)
            setPadding(32, 28, 32, 28)
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            params.setMargins(0, 0, 0, 20)
            layoutParams = params
        }

        // Header: Type + Status Badge
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
        }

        val tvType = TextView(this).apply {
            text = alert.type.uppercase()
            setTextColor(Color.WHITE)
            textSize = 12.5f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        header.addView(tvType)

        val tvStatus = TextView(this).apply {
            text = alert.status.uppercase()
            textSize = 10f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(16, 6, 16, 6)
            when (alert.status.lowercase()) {
                "active" -> {
                    setBackgroundResource(R.drawable.bg_badge_red)
                    setTextColor(Color.parseColor("#f87171"))
                }
                "sent", "resolved" -> {
                    setBackgroundResource(R.drawable.bg_badge_green)
                    setTextColor(Color.parseColor("#10b981"))
                }
                else -> {
                    setBackgroundResource(R.drawable.bg_badge_amber)
                    setTextColor(Color.parseColor("#f59e0b"))
                }
            }
        }
        header.addView(tvStatus)
        card.addView(header)

        // User Info & Time
        val dateStr = SimpleDateFormat("MMM dd, yyyy • HH:mm:ss", Locale.getDefault()).format(Date(alert.timestamp))
        val tvUser = TextView(this).apply {
            text = "User: ${alert.userName} • ${alert.userEmail}\nTime: $dateStr"
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 11.5f
            setPadding(0, 10, 0, 8)
        }
        card.addView(tvUser)

        // GPS Location Link if available
        if (alert.location != null && alert.location.lat != 0.0) {
            val tvLoc = TextView(this).apply {
                text = "📍 Location: ${String.format("%.5f", alert.location.lat)}, ${String.format("%.5f", alert.location.lng)} (Open Google Maps)"
                setTextColor(Color.parseColor("#38bdf8"))
                textSize = 11f
                setPadding(0, 0, 0, 8)
                setOnClickListener {
                    val mapUri = Uri.parse("https://maps.google.com/?q=${alert.location.lat},${alert.location.lng}")
                    startActivity(Intent(Intent.ACTION_VIEW, mapUri))
                }
            }
            card.addView(tvLoc)
        }

        // Evidence telemetry: Photos, Video, Audio
        val tvEvidence = TextView(this).apply {
            text = "Evidence: 📷 ${alert.evidence.photos} Photos  •  🎥 ${alert.evidence.videos} Videos  •  🎙️ ${alert.evidence.audio} Audio"
            setTextColor(Color.parseColor("#64748b"))
            textSize = 10.5f
            setPadding(0, 0, 0, 12)
        }
        card.addView(tvEvidence)

        if (!compact) {
            // Action Buttons Row: Resolve (if active) & Delete
            val actionsRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.END
                setPadding(0, 6, 0, 0)
            }

            if (alert.status.equals("Active", ignoreCase = true)) {
                val btnResolve = TextView(this).apply {
                    text = "Resolve Incident"
                    setTextColor(Color.parseColor("#10b981"))
                    setBackgroundResource(R.drawable.bg_badge_green)
                    textSize = 11f
                    typeface = android.graphics.Typeface.DEFAULT_BOLD
                    setPadding(24, 12, 24, 12)
                    setOnClickListener { resolveAlert(alert.id) }
                }
                actionsRow.addView(btnResolve)
            }

            val btnDelete = ImageView(this).apply {
                setImageResource(R.drawable.ic_trash_vector)
                setColorFilter(Color.parseColor("#ef4444"))
                setPadding(16, 8, 8, 8)
                layoutParams = LinearLayout.LayoutParams(70, 70)
                setOnClickListener { confirmDeleteAlert(alert.id) }
            }
            actionsRow.addView(btnDelete)
            card.addView(actionsRow)
        }

        return card
    }

    private fun resolveAlert(alertId: String) {
        pbAdminMainLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            val res = apiClient.resolveAdminAlert(alertId)
            pbAdminMainLoading.visibility = View.GONE
            res.onSuccess {
                Toast.makeText(this@AdminDashboardActivity, "Emergency incident marked as resolved.", Toast.LENGTH_SHORT).show()
                allAlerts = allAlerts.map { if (it.id == alertId) it.copy(status = "Sent") else it }
                updateActiveBadge()
                renderDashboardActivities()
                renderAlertsList()
            }.onFailure {
                Toast.makeText(this@AdminDashboardActivity, "Failed to resolve: ${it.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun confirmDeleteAlert(alertId: String) {
        AlertDialog.Builder(this)
            .setTitle("Delete Incident Record")
            .setMessage("Are you sure you want to permanently delete this SOS alert record and associated evidence telemetry?")
            .setPositiveButton("Delete Permanently") { _, _ ->
                pbAdminMainLoading.visibility = View.VISIBLE
                lifecycleScope.launch {
                    val res = apiClient.deleteAdminAlert(alertId)
                    pbAdminMainLoading.visibility = View.GONE
                    res.onSuccess {
                        Toast.makeText(this@AdminDashboardActivity, "Alert record deleted.", Toast.LENGTH_SHORT).show()
                        allAlerts = allAlerts.filter { it.id != alertId }
                        updateActiveBadge()
                        renderDashboardActivities()
                        renderAlertsList()
                    }.onFailure {
                        Toast.makeText(this@AdminDashboardActivity, "Failed to delete: ${it.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ==========================================
    // 👥 TAB 3: USERS MANAGEMENT
    // ==========================================

    private fun renderUsersList() {
        llUsersList.removeAllViews()
        val query = etUsersSearch.text.toString().trim().lowercase()

        val filtered = allUsers.filter { user ->
            query.isEmpty() ||
                    user.name.lowercase().contains(query) ||
                    user.email.lowercase().contains(query) ||
                    user.id.lowercase().contains(query)
        }

        tvUsersCountLabel.text = "Showing ${filtered.size} of ${allUsers.size} registered users"

        if (filtered.isEmpty()) {
            val emptyTv = TextView(this).apply {
                text = "No users found matching query."
                setTextColor(Color.parseColor("#64748b"))
                textSize = 12f
                setPadding(0, 16, 0, 16)
            }
            llUsersList.addView(emptyTv)
            return
        }

        for (user in filtered) {
            val card = createUserCardView(user)
            llUsersList.addView(card)
        }
    }

    private fun createUserCardView(user: AdminUserItem): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundResource(R.drawable.bg_card_surface)
            setPadding(30, 26, 30, 26)
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            params.setMargins(0, 0, 0, 18)
            layoutParams = params
        }

        // Header Row: User Name & Badges
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
        }

        val tvName = TextView(this).apply {
            text = user.name
            setTextColor(Color.WHITE)
            textSize = 13.5f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        header.addView(tvName)

        // Role Badge
        val tvRole = TextView(this).apply {
            text = user.role.uppercase()
            textSize = 9.5f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(14, 4, 14, 4)
            if (user.role.equals("admin", ignoreCase = true)) {
                setBackgroundResource(R.drawable.bg_badge_purple)
                setTextColor(Color.parseColor("#c084fc"))
            } else {
                setBackgroundResource(R.drawable.bg_badge_cyan)
                setTextColor(Color.parseColor("#38bdf8"))
            }
        }
        header.addView(tvRole)

        // Status Badge
        val tvStatus = TextView(this).apply {
            text = if (user.disabled) "DISABLED" else "ACTIVE"
            textSize = 9.5f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(14, 4, 14, 4)
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            params.setMargins(10, 0, 0, 0)
            layoutParams = params

            if (user.disabled) {
                setBackgroundResource(R.drawable.bg_badge_red)
                setTextColor(Color.parseColor("#f87171"))
            } else {
                setBackgroundResource(R.drawable.bg_badge_green)
                setTextColor(Color.parseColor("#10b981"))
            }
        }
        header.addView(tvStatus)
        card.addView(header)

        // Email & ID
        val tvEmail = TextView(this).apply {
            text = "${user.email}\nID: ${user.id}"
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 11.5f
            setPadding(0, 6, 0, 14)
        }
        card.addView(tvEmail)

        // Action Buttons Row: Toggle Status, Edit, Delete
        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.END
        }

        // Toggle Status Button
        val btnToggle = TextView(this).apply {
            text = if (user.disabled) "Enable" else "Disable"
            setTextColor(if (user.disabled) Color.parseColor("#10b981") else Color.parseColor("#f59e0b"))
            setBackgroundResource(if (user.disabled) R.drawable.bg_badge_green else R.drawable.bg_badge_amber)
            textSize = 11f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(20, 8, 20, 8)
            setOnClickListener { toggleUserStatus(user) }
        }
        actions.addView(btnToggle)

        // Edit Button
        val btnEdit = TextView(this).apply {
            text = "Edit"
            setTextColor(Color.WHITE)
            setBackgroundResource(R.drawable.bg_auth_pill)
            textSize = 11f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setPadding(20, 8, 20, 8)
            val p = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            p.setMargins(14, 0, 0, 0)
            layoutParams = p
            setOnClickListener { showEditUserDialog(user) }
        }
        actions.addView(btnEdit)

        // Delete Button
        val btnDelete = ImageView(this).apply {
            setImageResource(R.drawable.ic_trash_vector)
            setColorFilter(Color.parseColor("#ef4444"))
            setPadding(16, 6, 6, 6)
            layoutParams = LinearLayout.LayoutParams(64, 64)
            setOnClickListener { confirmDeleteUser(user) }
        }
        actions.addView(btnDelete)

        card.addView(actions)
        return card
    }

    private fun toggleUserStatus(user: AdminUserItem) {
        val targetDisabled = !user.disabled
        pbAdminMainLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            val res = apiClient.updateAdminUser(user.id, disabled = targetDisabled)
            pbAdminMainLoading.visibility = View.GONE
            res.onSuccess { updated ->
                Toast.makeText(this@AdminDashboardActivity, "User status updated.", Toast.LENGTH_SHORT).show()
                allUsers = allUsers.map { if (it.id == user.id) it.copy(disabled = targetDisabled) else it }
                renderUsersList()
            }.onFailure {
                Toast.makeText(this@AdminDashboardActivity, "Failed: ${it.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun showEditUserDialog(user: AdminUserItem) {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_admin_edit_user, null)
        val tvDialogUserId: TextView = dialogView.findViewById(R.id.tvDialogUserId)
        val etDialogUserName: EditText = dialogView.findViewById(R.id.etDialogUserName)
        val etDialogUserEmail: EditText = dialogView.findViewById(R.id.etDialogUserEmail)
        val tvDialogRoleUser: TextView = dialogView.findViewById(R.id.tvDialogRoleUser)
        val tvDialogRoleAdmin: TextView = dialogView.findViewById(R.id.tvDialogRoleAdmin)
        val switchDialogDisabled: SwitchCompat = dialogView.findViewById(R.id.switchDialogDisabled)
        val etDialogUserPassword: EditText = dialogView.findViewById(R.id.etDialogUserPassword)
        val btnDialogCancel: View = dialogView.findViewById(R.id.btnDialogCancel)
        val btnDialogSaveUser: View = dialogView.findViewById(R.id.btnDialogSaveUser)

        tvDialogUserId.text = "Account UID: ${user.id}"
        etDialogUserName.setText(user.name)
        etDialogUserEmail.setText(user.email)
        switchDialogDisabled.isChecked = user.disabled

        var chosenRole = user.role.lowercase()
        fun updateRoleUI() {
            if (chosenRole == "admin") {
                tvDialogRoleAdmin.setBackgroundResource(R.drawable.bg_auth_tab_active)
                tvDialogRoleAdmin.setTextColor(Color.WHITE)
                tvDialogRoleUser.setBackgroundColor(Color.TRANSPARENT)
                tvDialogRoleUser.setTextColor(Color.parseColor("#94a3b8"))
            } else {
                tvDialogRoleUser.setBackgroundResource(R.drawable.bg_auth_tab_active)
                tvDialogRoleUser.setTextColor(Color.WHITE)
                tvDialogRoleAdmin.setBackgroundColor(Color.TRANSPARENT)
                tvDialogRoleAdmin.setTextColor(Color.parseColor("#94a3b8"))
            }
        }
        updateRoleUI()

        tvDialogRoleUser.setOnClickListener { chosenRole = "user"; updateRoleUI() }
        tvDialogRoleAdmin.setOnClickListener { chosenRole = "admin"; updateRoleUI() }

        val dialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .create()

        btnDialogCancel.setOnClickListener { dialog.dismiss() }

        btnDialogSaveUser.setOnClickListener {
            val newName = etDialogUserName.text.toString().trim()
            val newEmail = etDialogUserEmail.text.toString().trim()
            val newPass = etDialogUserPassword.text.toString().trim()
            val isDisabled = switchDialogDisabled.isChecked

            if (newName.isEmpty() || newEmail.isEmpty()) {
                Toast.makeText(this, "Name and Email cannot be empty", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            dialog.dismiss()
            pbAdminMainLoading.visibility = View.VISIBLE

            lifecycleScope.launch {
                val res = apiClient.updateAdminUser(
                    id = user.id,
                    name = newName,
                    email = newEmail,
                    role = chosenRole,
                    disabled = isDisabled,
                    password = if (newPass.isNotEmpty()) newPass else null
                )
                pbAdminMainLoading.visibility = View.GONE
                res.onSuccess { updated ->
                    Toast.makeText(this@AdminDashboardActivity, "User record updated.", Toast.LENGTH_SHORT).show()
                    allUsers = allUsers.map { if (it.id == user.id) updated else it }
                    renderUsersList()
                }.onFailure {
                    Toast.makeText(this@AdminDashboardActivity, "Update failed: ${it.message}", Toast.LENGTH_LONG).show()
                }
            }
        }

        dialog.show()
    }

    private fun confirmDeleteUser(user: AdminUserItem) {
        if (user.id == sessionManager.currentUser?.id) {
            Toast.makeText(this, "You cannot delete your own admin account.", Toast.LENGTH_SHORT).show()
            return
        }

        AlertDialog.Builder(this)
            .setTitle("Delete User Account")
            .setMessage("Are you sure you want to permanently delete user '${user.name}' (${user.email})?")
            .setPositiveButton("Delete User") { _, _ ->
                pbAdminMainLoading.visibility = View.VISIBLE
                lifecycleScope.launch {
                    val res = apiClient.deleteAdminUser(user.id)
                    pbAdminMainLoading.visibility = View.GONE
                    res.onSuccess {
                        Toast.makeText(this@AdminDashboardActivity, "User account deleted.", Toast.LENGTH_SHORT).show()
                        allUsers = allUsers.filter { it.id != user.id }
                        tvDashTotalUsers.text = allUsers.size.toString()
                        renderUsersList()
                    }.onFailure {
                        Toast.makeText(this@AdminDashboardActivity, "Failed: ${it.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ==========================================
    // 💬 TAB 4: FEEDBACK VIEW
    // ==========================================

    private fun setFeedbackCategory(category: String, selectedChip: TextView) {
        currentFeedbackCategory = category
        val chips = listOf(chipFbCatAll, chipFbCatBug, chipFbCatFeature, chipFbCatUi, chipFbCatGeneral)
        for (c in chips) {
            if (c == selectedChip) {
                c.setBackgroundResource(R.drawable.bg_auth_tab_active)
                c.setTextColor(Color.WHITE)
            } else {
                c.setBackgroundResource(R.drawable.bg_card_surface)
                c.setTextColor(Color.parseColor("#94a3b8"))
            }
        }
        renderFeedbackList()
    }

    private fun renderFeedbackList() {
        llFeedbackList.removeAllViews()
        val query = etFeedbackSearch.text.toString().trim().lowercase()

        val filtered = allFeedback.filter { fb ->
            val matchCat = when (currentFeedbackCategory) {
                "Bug" -> fb.category.contains("bug", ignoreCase = true)
                "Feature" -> fb.category.contains("feature", ignoreCase = true)
                "UI/UX" -> fb.category.contains("ui", ignoreCase = true)
                "General" -> fb.category.contains("general", ignoreCase = true)
                else -> true
            }

            val matchQuery = query.isEmpty() ||
                    fb.userName.lowercase().contains(query) ||
                    fb.userEmail.lowercase().contains(query) ||
                    fb.message.lowercase().contains(query)

            matchCat && matchQuery
        }

        if (filtered.isEmpty()) {
            val emptyTv = TextView(this).apply {
                text = "No user feedback entries matching filter."
                setTextColor(Color.parseColor("#64748b"))
                textSize = 12f
                setPadding(0, 16, 0, 16)
            }
            llFeedbackList.addView(emptyTv)
            return
        }

        for (fb in filtered) {
            val card = createFeedbackCardView(fb)
            llFeedbackList.addView(card)
        }
    }

    private fun createFeedbackCardView(fb: AdminFeedbackItem): View {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundResource(R.drawable.bg_card_surface)
            setPadding(30, 26, 30, 26)
            val params = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            params.setMargins(0, 0, 0, 18)
            layoutParams = params
        }

        // Header: User Name + Rating Stars
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = android.view.Gravity.CENTER_VERTICAL
        }

        val tvName = TextView(this).apply {
            text = fb.userName
            setTextColor(Color.WHITE)
            textSize = 13f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        header.addView(tvName)

        val tvStars = TextView(this).apply {
            val starCount = fb.rating.coerceIn(1, 5)
            text = "★".repeat(starCount) + "☆".repeat(5 - starCount)
            setTextColor(Color.parseColor("#f59e0b"))
            textSize = 14f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }
        header.addView(tvStars)
        card.addView(header)

        // Email, Category & Date
        val dateStr = SimpleDateFormat("MMM dd, yyyy • HH:mm", Locale.getDefault()).format(Date(fb.createdAt))
        val tvMeta = TextView(this).apply {
            text = "${fb.userEmail}  •  Category: ${fb.category}  •  $dateStr"
            setTextColor(Color.parseColor("#94a3b8"))
            textSize = 11f
            setPadding(0, 4, 0, 8)
        }
        card.addView(tvMeta)

        // User Feedback Comment Message
        val tvMsg = TextView(this).apply {
            text = "\"${fb.message}\""
            setTextColor(Color.WHITE)
            textSize = 12.5f
            setPadding(0, 0, 0, 12)
        }
        card.addView(tvMsg)

        // Delete Button
        val btnDelete = ImageView(this).apply {
            setImageResource(R.drawable.ic_trash_vector)
            setColorFilter(Color.parseColor("#ef4444"))
            val p = LinearLayout.LayoutParams(60, 60)
            p.gravity = android.view.Gravity.END
            layoutParams = p
            setOnClickListener { confirmDeleteFeedback(fb.id) }
        }
        card.addView(btnDelete)

        return card
    }

    private fun confirmDeleteFeedback(id: String) {
        AlertDialog.Builder(this)
            .setTitle("Delete Feedback")
            .setMessage("Are you sure you want to delete this user feedback entry?")
            .setPositiveButton("Delete") { _, _ ->
                pbAdminMainLoading.visibility = View.VISIBLE
                lifecycleScope.launch {
                    val res = apiClient.deleteAdminFeedback(id)
                    pbAdminMainLoading.visibility = View.GONE
                    res.onSuccess {
                        Toast.makeText(this@AdminDashboardActivity, "Feedback entry deleted.", Toast.LENGTH_SHORT).show()
                        allFeedback = allFeedback.filter { it.id != id }
                        tvDashTotalFeedback.text = allFeedback.size.toString()
                        renderDashboardFeedback()
                        renderFeedbackList()
                    }.onFailure {
                        Toast.makeText(this@AdminDashboardActivity, "Failed to delete: ${it.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ==========================================
    // ⚙️ TAB 5: SETTINGS VIEW
    // ==========================================

    private fun populateSettings(data: AdminSettingsData) {
        etAdminProfileName.setText(sessionManager.currentUser?.name ?: "Administrator")
        etGlobalEmails.setText(data.globalEmergencyEmails)
        etGlobalSmsTemplate.setText(data.messageTemplate)
        setSensitivity(data.gestureSensitivity)
    }

    private fun setSensitivity(sens: String) {
        selectedSensitivity = sens
        val views = listOf(tvSensLow to "Low", tvSensMed to "Medium", tvSensHigh to "High")
        for ((v, name) in views) {
            if (name.equals(sens, ignoreCase = true)) {
                v.setBackgroundResource(R.drawable.bg_auth_tab_active)
                v.setTextColor(Color.WHITE)
            } else {
                v.setBackgroundColor(Color.TRANSPARENT)
                v.setTextColor(Color.parseColor("#94a3b8"))
            }
        }
    }

    private fun saveAdminProfile() {
        val newName = etAdminProfileName.text.toString().trim()
        val newPass = etAdminProfileNewPass.text.toString().trim()

        if (newName.isEmpty()) {
            Toast.makeText(this, "Administrator name cannot be empty", Toast.LENGTH_SHORT).show()
            return
        }

        pbAdminMainLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            val adminId = sessionManager.currentUser?.id ?: ""
            val res = apiClient.updateAdminUser(
                id = adminId,
                name = newName,
                password = if (newPass.isNotEmpty()) newPass else null
            )
            pbAdminMainLoading.visibility = View.GONE
            res.onSuccess { updated ->
                sessionManager.currentUser = User(updated.id, updated.name, updated.email, updated.role)
                Toast.makeText(this@AdminDashboardActivity, "Administrator profile updated.", Toast.LENGTH_SHORT).show()
                etAdminProfileNewPass.setText("")
            }.onFailure {
                Toast.makeText(this@AdminDashboardActivity, "Profile update failed: ${it.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun saveGlobalSettings() {
        val emails = etGlobalEmails.text.toString().trim()
        val template = etGlobalSmsTemplate.text.toString().trim()

        val updated = (currentSettings ?: AdminSettingsData()).copy(
            globalEmergencyEmails = emails,
            messageTemplate = template,
            gestureSensitivity = selectedSensitivity
        )

        pbAdminMainLoading.visibility = View.VISIBLE
        lifecycleScope.launch {
            val res = apiClient.updateAdminSettings(updated)
            pbAdminMainLoading.visibility = View.GONE
            res.onSuccess {
                currentSettings = updated
                Toast.makeText(this@AdminDashboardActivity, "Global SOS parameters updated successfully.", Toast.LENGTH_SHORT).show()
            }.onFailure {
                Toast.makeText(this@AdminDashboardActivity, "Failed to update global settings: ${it.message}", Toast.LENGTH_LONG).show()
            }
        }
    }
}

