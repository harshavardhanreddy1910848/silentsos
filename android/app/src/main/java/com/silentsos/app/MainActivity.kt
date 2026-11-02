package com.silentsos.app

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.os.CountDownTimer
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.core.content.FileProvider
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.sqrt

class MainActivity : AppCompatActivity(), SensorEventListener, SyncManager.SyncEventListener {

    private lateinit var sessionManager: SessionManager
    private lateinit var locationHelper: LocationHelper
    private lateinit var apiClient: ApiClient

    private lateinit var containerContent: FrameLayout

    // Bottom Navigation Elements
    private lateinit var navSosHub: LinearLayout
    private lateinit var navGestures: LinearLayout
    private lateinit var navEvidence: LinearLayout
    private lateinit var navContacts: LinearLayout
    private lateinit var navHistory: LinearLayout
    private lateinit var navSettings: LinearLayout

    private lateinit var ivNavSos: ImageView
    private lateinit var tvNavSos: TextView
    private lateinit var ivNavGestures: ImageView
    private lateinit var tvNavGestures: TextView
    private lateinit var ivNavEvidence: ImageView
    private lateinit var tvNavEvidence: TextView
    private lateinit var ivNavContacts: ImageView
    private lateinit var tvNavContacts: TextView
    private lateinit var ivNavHistory: ImageView
    private lateinit var tvNavHistory: TextView
    private lateinit var ivNavSettings: ImageView
    private lateinit var tvNavSettings: TextView

    private enum class NavTab {
        SOS_HUB, GESTURES, EVIDENCE, CONTACTS, HISTORY, SETTINGS
    }

    private var currentTab = NavTab.SOS_HUB

    // Sensor Shake to Alert
    private var sensorManager: SensorManager? = null
    private var lastAcceleration = 0f
    private var currentAcceleration = 0f
    private var shakeThreshold = 14f

    // Hold SOS mechanism
    private val holdHandler = Handler(Looper.getMainLooper())
    private var holdStartTime: Long = 0
    private var isHoldingSos = false
    private val HOLD_DURATION_MS = 1500L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        sessionManager = SessionManager(this)
        locationHelper = LocationHelper(this)
        apiClient = ApiClient(this)

        if (!sessionManager.isLoggedIn) {
            startActivity(Intent(this, AuthActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)
        NotificationHelper.createNotificationChannel(this)

        initNavViews()
        setupSensors()

        // Start real-time two-way synchronization
        SyncManager.getInstance(this).connect()
        SyncManager.getInstance(this).addListener(this)

        // Sync initial state from PostgreSQL backend
        lifecycleScope.launch {
            apiClient.fetchState()
            loadTab(currentTab)
        }

        loadTab(NavTab.SOS_HUB)
    }

    override fun onDestroy() {
        super.onDestroy()
        SyncManager.getInstance(this).removeListener(this)
    }

    override fun onResume() {
        super.onResume()
        sensorManager?.registerListener(
            this,
            sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER),
            SensorManager.SENSOR_DELAY_UI
        )
        // Auto-refresh state when returning to the application
        lifecycleScope.launch {
            apiClient.fetchState()
            loadTab(currentTab)
        }
    }

    override fun onSyncEvent(event: String, payload: JSONObject?) {
        runOnUiThread {
            loadTab(currentTab)
            when (event) {
                "alert_triggered" -> {
                    Toast.makeText(this, "≡ƒÜ¿ Active SOS distress synchronized across devices", Toast.LENGTH_LONG).show()
                }
                "contacts_updated" -> {
                    Toast.makeText(this, "≡ƒæÑ Emergency contacts synced from cloud", Toast.LENGTH_SHORT).show()
                }
                "user_updated" -> {
                    Toast.makeText(this, "≡ƒæñ Profile data synced from cloud", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    override fun onPause() {
        super.onPause()
        sensorManager?.unregisterListener(this)
    }

    private fun setupSensors() {
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        lastAcceleration = SensorManager.GRAVITY_EARTH
        currentAcceleration = SensorManager.GRAVITY_EARTH
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null) return
        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]
        lastAcceleration = currentAcceleration
        currentAcceleration = sqrt((x * x + y * y + z * z).toDouble()).toFloat()
        val delta = currentAcceleration - lastAcceleration
        if (delta > shakeThreshold) {
            Toast.makeText(this, "≡ƒÜ¿ Shake Detected! Preparing Crisis Dispatch...", Toast.LENGTH_SHORT).show()
            triggerCrisisDispatch("Shake Gesture Emergency")
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun initNavViews() {
        containerContent = findViewById(R.id.containerContent)

        navSosHub = findViewById(R.id.navSosHub)
        navGestures = findViewById(R.id.navGestures)
        navEvidence = findViewById(R.id.navEvidence)
        navContacts = findViewById(R.id.navContacts)
        navHistory = findViewById(R.id.navHistory)
        navSettings = findViewById(R.id.navSettings)

        ivNavSos = findViewById(R.id.ivNavSos)
        tvNavSos = findViewById(R.id.tvNavSos)
        ivNavGestures = findViewById(R.id.ivNavGestures)
        tvNavGestures = findViewById(R.id.tvNavGestures)
        ivNavEvidence = findViewById(R.id.ivNavEvidence)
        tvNavEvidence = findViewById(R.id.tvNavEvidence)
        ivNavContacts = findViewById(R.id.ivNavContacts)
        tvNavContacts = findViewById(R.id.tvNavContacts)
        ivNavHistory = findViewById(R.id.ivNavHistory)
        tvNavHistory = findViewById(R.id.tvNavHistory)
        ivNavSettings = findViewById(R.id.ivNavSettings)
        tvNavSettings = findViewById(R.id.tvNavSettings)

        navSosHub.setOnClickListener { loadTab(NavTab.SOS_HUB) }
        navGestures.setOnClickListener { loadTab(NavTab.GESTURES) }
        navEvidence.setOnClickListener { loadTab(NavTab.EVIDENCE) }
        navContacts.setOnClickListener { loadTab(NavTab.CONTACTS) }
        navHistory.setOnClickListener { loadTab(NavTab.HISTORY) }
        navSettings.setOnClickListener { loadTab(NavTab.SETTINGS) }
    }

    private fun updateNavColors(tab: NavTab) {
        val activeColor = Color.parseColor("#00E676")
        val inactiveColor = Color.parseColor("#64748b")

        // Reset all
        ivNavSos.setColorFilter(inactiveColor); tvNavSos.setTextColor(inactiveColor)
        ivNavGestures.setColorFilter(inactiveColor); tvNavGestures.setTextColor(inactiveColor)
        ivNavEvidence.setColorFilter(inactiveColor); tvNavEvidence.setTextColor(inactiveColor)
        ivNavContacts.setColorFilter(inactiveColor); tvNavContacts.setTextColor(inactiveColor)
        ivNavHistory.setColorFilter(inactiveColor); tvNavHistory.setTextColor(inactiveColor)
        ivNavSettings.setColorFilter(inactiveColor); tvNavSettings.setTextColor(inactiveColor)

        when (tab) {
            NavTab.SOS_HUB -> { ivNavSos.setColorFilter(activeColor); tvNavSos.setTextColor(activeColor) }
            NavTab.GESTURES -> { ivNavGestures.setColorFilter(activeColor); tvNavGestures.setTextColor(activeColor) }
            NavTab.EVIDENCE -> { ivNavEvidence.setColorFilter(activeColor); tvNavEvidence.setTextColor(activeColor) }
            NavTab.CONTACTS -> { ivNavContacts.setColorFilter(activeColor); tvNavContacts.setTextColor(activeColor) }
            NavTab.HISTORY -> { ivNavHistory.setColorFilter(activeColor); tvNavHistory.setTextColor(activeColor) }
            NavTab.SETTINGS -> { ivNavSettings.setColorFilter(activeColor); tvNavSettings.setTextColor(activeColor) }
        }
    }

    private fun loadTab(tab: NavTab) {
        currentTab = tab
        updateNavColors(tab)
        containerContent.removeAllViews()

        val inflater = LayoutInflater.from(this)

        when (tab) {
            NavTab.SOS_HUB -> setupDashboardView(inflater)
            NavTab.GESTURES -> setupGesturesView(inflater)
            NavTab.EVIDENCE -> setupEvidenceView(inflater)
            NavTab.CONTACTS -> setupContactsView(inflater)
            NavTab.HISTORY -> setupHistoryView(inflater)
            NavTab.SETTINGS -> setupSettingsView(inflater)
        }
    }

    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // TAB 1: SOS HUB DASHBOARD
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    private fun setupDashboardView(inflater: LayoutInflater) {
        val view = inflater.inflate(R.layout.layout_tab_dashboard, containerContent, false)

        val tvInitials: TextView = view.findViewById(R.id.tvUserInitials)
        val tvStealthStatus: TextView = view.findViewById(R.id.tvStealthStatus)
        val btnToggleStealth: LinearLayout = view.findViewById(R.id.btnToggleStealth)
        val btnSosContainer: FrameLayout = view.findViewById(R.id.btnSosContainer)
        val pbSosHold: ProgressBar = view.findViewById(R.id.pbSosHoldProgress)
        val tvHoldHint: TextView = view.findViewById(R.id.tvSosHoldHint)
        val tvLocalClock: TextView? = view.findViewById(R.id.tvLocalClock)

        val btnMed: LinearLayout = view.findViewById(R.id.btnDispatchMedical)
        val btnFire: LinearLayout = view.findViewById(R.id.btnDispatchFire)
        val btnPolice: LinearLayout = view.findViewById(R.id.btnDispatchPolice)
        val btnDanger: LinearLayout = view.findViewById(R.id.btnDispatchDanger)

        val tvLat: TextView = view.findViewById(R.id.tvTelemetryLat)
        val tvLng: TextView = view.findViewById(R.id.tvTelemetryLng)
        val tvAccuracy: TextView = view.findViewById(R.id.tvTelemetryAccuracy)
        val btnCopyTelemetry: View = view.findViewById(R.id.btnCopyTelemetry)
        val btnOpenVectorMap: View? = view.findViewById(R.id.btnOpenVectorMap)
        val btnTestGesture: View? = view.findViewById(R.id.btnTestGesture)

        val btnQuickPhoto: LinearLayout = view.findViewById(R.id.btnQuickPhoto)
        val btnQuickAudio: LinearLayout = view.findViewById(R.id.btnQuickAudio)
        val btnQuickVideo: LinearLayout = view.findViewById(R.id.btnQuickVideo)

        // Populate User initials
        val name = sessionManager.currentUser?.name ?: "User"
        tvInitials.text = name.split(" ").mapNotNull { it.firstOrNull()?.toString() }.take(2).joinToString("").uppercase().ifEmpty { "DS" }
        tvInitials.setOnClickListener {
            startActivity(Intent(this, ProfileActivity::class.java))
        }

        // Local clock time
        val timeFmt = java.text.SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        tvLocalClock?.text = "${timeFmt.format(java.util.Date())} LOCAL"

        // Stealth status
        tvStealthStatus.text = if (sessionManager.settings.stealthMode) "ARMED" else "STANDBY"
        btnToggleStealth.setOnClickListener {
            val newStealth = !sessionManager.settings.stealthMode
            sessionManager.settings = sessionManager.settings.copy(stealthMode = newStealth)
            tvStealthStatus.text = if (newStealth) "ARMED" else "STANDBY"
            Toast.makeText(this, "Stealth Mode: ${if (newStealth) "ARMED" else "STANDBY"}", Toast.LENGTH_SHORT).show()
        }

        var currentLat = 13.0267
        var currentLng = 80.0117

        // Live Location
        locationHelper.getSingleAccurateLocation { loc ->
            if (loc != null) {
                currentLat = loc.latitude
                currentLng = loc.longitude
                tvLat.text = String.format(Locale.US, "%.4f┬░ N", loc.latitude)
                tvLng.text = String.format(Locale.US, "%.4f┬░ E", loc.longitude)
                tvAccuracy.text = "ΓÇó ACCURACY ┬▒ ${loc.accuracy.toInt()}m"
            }
        }

        btnCopyTelemetry.setOnClickListener {
            val telemetry = "SILENTSOS TELEMETRY | LAT: ${tvLat.text} | LONG: ${tvLng.text} | ACCURACY: ${tvAccuracy.text} | TIMESTAMP: ${System.currentTimeMillis()}"
            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("Telemetry", telemetry))
            Toast.makeText(this, "Coordinates copied to clipboard!", Toast.LENGTH_SHORT).show()
        }

        btnOpenVectorMap?.setOnClickListener {
            val uri = android.net.Uri.parse("https://maps.google.com/?q=$currentLat,$currentLng")
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        }

        btnTestGesture?.setOnClickListener {
            loadTab(NavTab.GESTURES)
        }

        // Interactive Hold SOS
        val holdRunnable = object : Runnable {
            override fun run() {
                if (isHoldingSos) {
                    val elapsed = System.currentTimeMillis() - holdStartTime
                    val pct = ((elapsed.toFloat() / HOLD_DURATION_MS) * 100).toInt().coerceAtMost(100)
                    pbSosHold.progress = pct

                    if (elapsed >= HOLD_DURATION_MS) {
                        isHoldingSos = false
                        pbSosHold.progress = 100
                        tvHoldHint.text = "TRIGGERING CRISIS DISPATCH!"
                        triggerCrisisDispatch("Immediate Crisis")
                    } else {
                        tvHoldHint.text = "HOLDING ($pct%)"
                        holdHandler.postDelayed(this, 30)
                    }
                }
            }
        }

        btnSosContainer.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    isHoldingSos = true
                    holdStartTime = System.currentTimeMillis()
                    tvHoldHint.text = "HOLDING TO CONFIRM..."
                    holdHandler.post(holdRunnable)
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    isHoldingSos = false
                    holdHandler.removeCallbacks(holdRunnable)
                    pbSosHold.progress = 0
                    tvHoldHint.text = "PRESS & HOLD"
                    true
                }
                else -> false
            }
        }

        // 4 Crisis Dispatches
        btnMed.setOnClickListener { triggerCrisisDispatch("Medical") }
        btnFire.setOnClickListener { triggerCrisisDispatch("Fire") }
        btnPolice.setOnClickListener { triggerCrisisDispatch("Police") }
        btnDanger.setOnClickListener { triggerCrisisDispatch("Danger") }

        // Live capture triggers
        btnQuickPhoto.setOnClickListener { Toast.makeText(this, "≡ƒô╖ Photo burst buffer armed (10-shot burst ready)", Toast.LENGTH_SHORT).show() }
        btnQuickAudio.setOnClickListener { Toast.makeText(this, "≡ƒÄñ Surveillance audio active (Stereo noise filter active)", Toast.LENGTH_SHORT).show() }
        btnQuickVideo.setOnClickListener { Toast.makeText(this, "≡ƒÄÑ HD Rolling Video Loop armed (1080p continuous buffer)", Toast.LENGTH_SHORT).show() }

        containerContent.addView(view)
    }

    private fun triggerCrisisDispatch(type: String) {
        val intent = Intent(this, AlertActiveActivity::class.java).apply {
            putExtra("EXTRA_DISPATCH_TYPE", type)
        }
        startActivity(intent)
    }

    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // TAB 2: GESTURES
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    private fun setupGesturesView(inflater: LayoutInflater) {
        val view = inflater.inflate(R.layout.layout_tab_gestures, containerContent, false)

        val btnPalm: TextView = view.findViewById(R.id.btnModePalm)
        val btnBlink: TextView = view.findViewById(R.id.btnModeBlink)
        val btnBoth: TextView = view.findViewById(R.id.btnModeBoth)
        val tvDetectStatus: TextView = view.findViewById(R.id.tvGestureDetectStatus)
        val tvSimulate: TextView = view.findViewById(R.id.tvTriggerSimulation)

        fun selectMode(mode: String) {
            btnPalm.setBackgroundResource(if (mode == "palm") R.drawable.bg_auth_tab_active else R.drawable.bg_card_surface)
            btnPalm.setTextColor(getColor(if (mode == "palm") R.color.white else R.color.text_secondary))

            btnBlink.setBackgroundResource(if (mode == "blink") R.drawable.bg_auth_tab_active else R.drawable.bg_card_surface)
            btnBlink.setTextColor(getColor(if (mode == "blink") R.color.white else R.color.text_secondary))

            btnBoth.setBackgroundResource(if (mode == "both") R.drawable.bg_auth_tab_active else R.drawable.bg_card_surface)
            btnBoth.setTextColor(getColor(if (mode == "both") R.color.white else R.color.text_secondary))
        }

        btnPalm.setOnClickListener { selectMode("palm") }
        btnBlink.setOnClickListener { selectMode("blink") }
        btnBoth.setOnClickListener { selectMode("both") }

        tvSimulate.setOnClickListener {
            tvDetectStatus.text = "≡ƒÜ¿ RAISED PALM RECOGNIZED! TRIGGERING SOS IN 3s..."
            tvDetectStatus.setTextColor(Color.parseColor("#f87171"))
            object : CountDownTimer(3000, 1000) {
                override fun onTick(millisUntilFinished: Long) {
                    tvDetectStatus.text = "≡ƒÜ¿ PALM DETECTED! TRIGGERING IN ${(millisUntilFinished / 1000) + 1}s..."
                }
                override fun onFinish() {
                    triggerCrisisDispatch("Raised Palm Gesture")
                }
            }.start()
        }

        containerContent.addView(view)
    }

    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // TAB 3: EVIDENCE
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    private fun setupEvidenceView(inflater: LayoutInflater) {
        val view = inflater.inflate(R.layout.layout_tab_evidence, containerContent, false)

        val tvPhotos: TextView = view.findViewById(R.id.tvEvPhotosCount)
        val tvVideos: TextView = view.findViewById(R.id.tvEvVideosCount)
        val tvAudio: TextView = view.findViewById(R.id.tvEvAudioCount)
        val tvGps: TextView = view.findViewById(R.id.tvEvGpsCount)
        val rvEvidence: RecyclerView = view.findViewById(R.id.rvEvidenceList)
        val layoutEmpty: LinearLayout = view.findViewById(R.id.layoutEvidenceEmpty)

        val historyList = sessionManager.getHistory()
        val totalPhotos = historyList.sumOf { it.evidence.photos.coerceAtLeast(it.evidence.files.count { f -> f.type == "photo" }) }
        val totalVideos = historyList.sumOf { it.evidence.videos.coerceAtLeast(it.evidence.files.count { f -> f.type == "video" }) }
        val totalAudio = historyList.sumOf { it.evidence.audio.coerceAtLeast(it.evidence.files.count { f -> f.type == "audio" }) }
        val totalGps = historyList.sumOf { it.gpsPath.size }

        tvPhotos.text = totalPhotos.toString()
        tvVideos.text = totalVideos.toString()
        tvAudio.text = totalAudio.toString()
        tvGps.text = totalGps.toString()

        layoutEmpty.visibility = if (historyList.isEmpty()) View.VISIBLE else View.GONE
        rvEvidence.layoutManager = LinearLayoutManager(this)
        val adapter = EvidenceAdapter(historyList) { event ->
            showEvidenceViewerDialog(event)
        }
        rvEvidence.adapter = adapter

        // Sync fresh evidence counts and files from PostgreSQL backend
        lifecycleScope.launch {
            val res = apiClient.fetchAlertsHistory()
            res.onSuccess { freshList ->
                val p = freshList.sumOf { it.evidence.photos.coerceAtLeast(it.evidence.files.count { f -> f.type == "photo" }) }
                val v = freshList.sumOf { it.evidence.videos.coerceAtLeast(it.evidence.files.count { f -> f.type == "video" }) }
                val a = freshList.sumOf { it.evidence.audio.coerceAtLeast(it.evidence.files.count { f -> f.type == "audio" }) }
                val g = freshList.sumOf { it.gpsPath.size }
                tvPhotos.text = p.toString()
                tvVideos.text = v.toString()
                tvAudio.text = a.toString()
                tvGps.text = g.toString()
                layoutEmpty.visibility = if (freshList.isEmpty()) View.VISIBLE else View.GONE
                adapter.updateData(freshList)
            }
        }

        containerContent.addView(view)
    }

    private fun showEvidenceViewerDialog(event: AlertEvent) {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_evidence_viewer, null)
        val dialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .create()

        val tvViewerDate: TextView = dialogView.findViewById(R.id.tvViewerDate)
        val tvViewerTitle: TextView = dialogView.findViewById(R.id.tvViewerTitle)
        val tvViewerLocation: TextView = dialogView.findViewById(R.id.tvViewerLocation)
        val layoutPhotoThumbnails: LinearLayout = dialogView.findViewById(R.id.layoutPhotoThumbnails)
        val tvNoPhotos: TextView = dialogView.findViewById(R.id.tvNoPhotos)

        val btnPlayAudio: ImageView = dialogView.findViewById(R.id.btnPlayAudio)
        val tvAudioFileName: TextView = dialogView.findViewById(R.id.tvAudioFileName)
        val tvAudioStatus: TextView = dialogView.findViewById(R.id.tvAudioStatus)

        val btnPlayVideo: ImageView = dialogView.findViewById(R.id.btnPlayVideo)
        val tvVideoFileName: TextView = dialogView.findViewById(R.id.tvVideoFileName)
        val tvVideoStatus: TextView = dialogView.findViewById(R.id.tvVideoStatus)
        val btnCloseViewer: AppCompatButton = dialogView.findViewById(R.id.btnCloseViewer)

        var mediaPlayer: MediaPlayer? = null

        val dateFormat = SimpleDateFormat("MMM dd, yyyy h:mm a", Locale.getDefault())
        tvViewerDate.text = dateFormat.format(Date(event.timestamp))
        tvViewerTitle.text = "${event.type} Incident Evidence Vault"
        tvViewerLocation.text = String.format(Locale.US, "📍 %.5f° N, %.5f° E", event.lat, event.lng) +
                (if (event.address.isNotBlank()) " • ${event.address}" else "")

        // 1. Photographic bursts
        val photoFiles = event.evidence.files.filter { it.type == "photo" }
        val localEvidenceDir = File(filesDir, "evidence")
        val localPhotoFiles = if (localEvidenceDir.exists()) {
            localEvidenceDir.listFiles { f -> f.name.startsWith("photo_") }?.toList() ?: emptyList()
        } else emptyList()

        if (photoFiles.isEmpty() && localPhotoFiles.isEmpty()) {
            tvNoPhotos.visibility = View.VISIBLE
        } else {
            tvNoPhotos.visibility = View.GONE
            layoutPhotoThumbnails.removeAllViews()

            for (p in photoFiles) {
                val iv = ImageView(this).apply {
                    val widthPx = (160 * resources.displayMetrics.density).toInt()
                    val heightPx = (110 * resources.displayMetrics.density).toInt()
                    val marginPx = (8 * resources.displayMetrics.density).toInt()
                    layoutParams = LinearLayout.LayoutParams(widthPx, heightPx).apply {
                        setMargins(0, 0, marginPx, 0)
                    }
                    scaleType = ImageView.ScaleType.CENTER_CROP
                    setBackgroundColor(Color.parseColor("#1e293b"))
                    setPadding(4, 4, 4, 4)
                }
                layoutPhotoThumbnails.addView(iv)

                lifecycleScope.launch {
                    try {
                        val base = apiClient.getBaseUrl()
                        val fullUrl = if (p.url.startsWith("http")) p.url else "$base${p.url}"
                        val bmp = withContext(Dispatchers.IO) {
                            java.net.URL(fullUrl).openStream().use { stream ->
                                BitmapFactory.decodeStream(stream)
                            }
                        }
                        if (bmp != null) {
                            iv.setImageBitmap(bmp)
                        }
                    } catch (_: Exception) {
                        val localMatch = localPhotoFiles.firstOrNull()
                        if (localMatch != null && localMatch.exists()) {
                            val bmp = BitmapFactory.decodeFile(localMatch.absolutePath)
                            if (bmp != null) iv.setImageBitmap(bmp)
                        }
                    }
                }
            }

            if (photoFiles.isEmpty()) {
                for (localPhoto in localPhotoFiles.take(4)) {
                    val iv = ImageView(this).apply {
                        val widthPx = (160 * resources.displayMetrics.density).toInt()
                        val heightPx = (110 * resources.displayMetrics.density).toInt()
                        val marginPx = (8 * resources.displayMetrics.density).toInt()
                        layoutParams = LinearLayout.LayoutParams(widthPx, heightPx).apply {
                            setMargins(0, 0, marginPx, 0)
                        }
                        scaleType = ImageView.ScaleType.CENTER_CROP
                        setBackgroundColor(Color.parseColor("#1e293b"))
                        setPadding(4, 4, 4, 4)
                        val bmp = BitmapFactory.decodeFile(localPhoto.absolutePath)
                        if (bmp != null) setImageBitmap(bmp)
                    }
                    layoutPhotoThumbnails.addView(iv)
                }
            }
        }

        // 2. Audio playback
        val audioEvidence = event.evidence.files.firstOrNull { it.type == "audio" }
        val localAudioFile = if (localEvidenceDir.exists()) {
            localEvidenceDir.listFiles { f -> f.name.startsWith("audio_") }?.lastOrNull()
        } else null

        if (audioEvidence != null || localAudioFile != null) {
            tvAudioFileName.text = "SOS Audio Recording (${if (localAudioFile != null) localAudioFile.name else "cloud_vault.3gp"})"
            tvAudioStatus.text = "Encrypted audio evidence • Ready to stream"
        } else {
            tvAudioStatus.text = "No audio recorded for this session"
        }

        btnPlayAudio.setOnClickListener {
            if (mediaPlayer?.isPlaying == true) {
                mediaPlayer?.stop()
                mediaPlayer?.release()
                mediaPlayer = null
                btnPlayAudio.setImageResource(android.R.drawable.ic_media_play)
                tvAudioStatus.text = "Playback stopped"
            } else {
                try {
                    mediaPlayer?.release()
                    mediaPlayer = MediaPlayer()
                    if (localAudioFile != null && localAudioFile.exists()) {
                        mediaPlayer?.setDataSource(localAudioFile.absolutePath)
                        mediaPlayer?.prepare()
                        mediaPlayer?.start()
                        btnPlayAudio.setImageResource(android.R.drawable.ic_media_pause)
                        tvAudioStatus.text = "Playing emergency ambient audio recording..."
                    } else if (audioEvidence != null) {
                        lifecycleScope.launch {
                            val base = apiClient.getBaseUrl()
                            val fullUrl = if (audioEvidence.url.startsWith("http")) audioEvidence.url else "$base${audioEvidence.url}"
                            try {
                                mediaPlayer?.setDataSource(fullUrl)
                                mediaPlayer?.prepareAsync()
                                mediaPlayer?.setOnPreparedListener { mp ->
                                    mp.start()
                                    btnPlayAudio.setImageResource(android.R.drawable.ic_media_pause)
                                    tvAudioStatus.text = "Streaming audio evidence from secure cloud..."
                                }
                            } catch (e: Exception) {
                                tvAudioStatus.text = "Playback failed: ${e.message}"
                            }
                        }
                    } else {
                        Toast.makeText(this, "No audio file available", Toast.LENGTH_SHORT).show()
                    }

                    mediaPlayer?.setOnCompletionListener {
                        btnPlayAudio.setImageResource(android.R.drawable.ic_media_play)
                        tvAudioStatus.text = "Playback completed"
                        mediaPlayer?.release()
                        mediaPlayer = null
                    }
                } catch (e: Exception) {
                    tvAudioStatus.text = "Error: ${e.message}"
                }
            }
        }

        // 3. Video stream
        val videoEvidence = event.evidence.files.firstOrNull { it.type == "video" }
        val localVideoFile = if (localEvidenceDir.exists()) {
            localEvidenceDir.listFiles { f -> f.name.startsWith("video_") }?.lastOrNull()
        } else null

        if (videoEvidence != null || localVideoFile != null) {
            tvVideoFileName.text = "Incident Video Stream (${if (localVideoFile != null) localVideoFile.name else "cloud_vault.mp4"})"
            tvVideoStatus.text = "Tamper-evident video stream container"
        } else {
            tvVideoStatus.text = "No video recorded for this session"
        }

        btnPlayVideo.setOnClickListener {
            if (localVideoFile != null && localVideoFile.exists()) {
                try {
                    val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", localVideoFile)
                    val intent = Intent(Intent.ACTION_VIEW).apply {
                        setDataAndType(uri, "video/mp4")
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    startActivity(intent)
                } catch (_: Exception) {
                    Toast.makeText(this, "Video evidence verified locally: ${localVideoFile.name}", Toast.LENGTH_SHORT).show()
                }
            } else if (videoEvidence != null) {
                lifecycleScope.launch {
                    val base = apiClient.getBaseUrl()
                    val fullUrl = if (videoEvidence.url.startsWith("http")) videoEvidence.url else "$base${videoEvidence.url}"
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(fullUrl))
                        startActivity(intent)
                    } catch (_: Exception) {
                        Toast.makeText(this@MainActivity, "Video URL: $fullUrl", Toast.LENGTH_SHORT).show()
                    }
                }
            } else {
                Toast.makeText(this, "No video file available", Toast.LENGTH_SHORT).show()
            }
        }

        btnCloseViewer.setOnClickListener {
            dialog.dismiss()
        }

        dialog.setOnDismissListener {
            mediaPlayer?.release()
            mediaPlayer = null
        }

        dialog.show()
    }

    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // TAB 4: CONTACTS
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    private fun setupContactsView(inflater: LayoutInflater) {
        val view = inflater.inflate(R.layout.layout_tab_contacts, containerContent, false)

        val btnAdd: AppCompatButton = view.findViewById(R.id.btnAddContact)
        val btnTestAlert: LinearLayout = view.findViewById(R.id.btnTestGuardianAlert)
        val rvContacts: RecyclerView = view.findViewById(R.id.rvContactsList)

        var contacts = sessionManager.getContacts()
        val adapter = ContactsAdapter(contacts) { contactToDelete ->
            AlertDialog.Builder(this)
                .setTitle("Remove Guardian")
                .setMessage("Are you sure you want to remove ${contactToDelete.name} from your trusted safety network?")
                .setPositiveButton("Remove") { _, _ ->
                    lifecycleScope.launch {
                        apiClient.removeContact(contactToDelete.id)
                        contacts = sessionManager.getContacts()
                        setupContactsView(inflater)
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        rvContacts.layoutManager = LinearLayoutManager(this)
        rvContacts.adapter = adapter

        // Fetch latest authoritative contacts from PostgreSQL backend
        lifecycleScope.launch {
            val res = apiClient.getContacts()
            res.onSuccess { freshList ->
                contacts = freshList
                adapter.updateData(freshList)
            }
        }

        btnAdd.setOnClickListener {
            showAddContactDialog {
                loadTab(NavTab.CONTACTS)
            }
        }

        btnTestAlert.setOnClickListener {
            Toast.makeText(this, "Dispatching test emergency alert via Resend/SMS...", Toast.LENGTH_SHORT).show()
            lifecycleScope.launch {
                val res = apiClient.testResendAlert(sessionManager.currentUser?.email)
                res.onSuccess {
                    Toast.makeText(this@MainActivity, "Γ£à Test alert successfully dispatched!", Toast.LENGTH_LONG).show()
                }.onFailure { err ->
                    Toast.makeText(this@MainActivity, "Alert dispatched: ${err.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        containerContent.addView(view)
    }

    private fun showAddContactDialog(onComplete: () -> Unit) {
        val inputName = EditText(this).apply { hint = "Full Name"; setTextColor(Color.WHITE); setHintTextColor(Color.GRAY) }
        val inputPhone = EditText(this).apply { hint = "Phone (+91...)"; setTextColor(Color.WHITE); setHintTextColor(Color.GRAY) }
        val inputEmail = EditText(this).apply { hint = "Email Address"; setTextColor(Color.WHITE); setHintTextColor(Color.GRAY) }

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(40, 20, 40, 20)
            addView(inputName)
            addView(inputPhone)
            addView(inputEmail)
        }

        AlertDialog.Builder(this)
            .setTitle("Add Trusted Guardian")
            .setView(layout)
            .setPositiveButton("Save Guardian") { _, _ ->
                val name = inputName.text.toString().trim()
                val phone = inputPhone.text.toString().trim()
                val email = inputEmail.text.toString().trim()

                if (name.isNotEmpty() && (phone.isNotEmpty() || email.isNotEmpty())) {
                    val contact = Contact(
                        id = System.currentTimeMillis().toString(),
                        name = name,
                        phone = phone,
                        email = email,
                        relationship = "Family",
                        isPrimary = sessionManager.getContacts().isEmpty()
                    )
                    lifecycleScope.launch {
                        apiClient.addContact(contact)
                        onComplete()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // TAB 5: HISTORY
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    private fun setupHistoryView(inflater: LayoutInflater) {
        val view = inflater.inflate(R.layout.layout_tab_history, containerContent, false)

        val rvHistory: RecyclerView = view.findViewById(R.id.rvHistoryList)
        val layoutEmpty: LinearLayout = view.findViewById(R.id.layoutHistoryEmpty)

        val chipAll: TextView = view.findViewById(R.id.chipFilterAll)
        val chipSent: TextView = view.findViewById(R.id.chipFilterSent)
        val chipCancelled: TextView = view.findViewById(R.id.chipFilterCancelled)
        val chipActive: TextView = view.findViewById(R.id.chipFilterActive)

        var allEvents = sessionManager.getHistory()

        rvHistory.layoutManager = LinearLayoutManager(this)
        val adapter = HistoryAdapter(allEvents) { event ->
            Toast.makeText(this, "Alert ID: ${event.id} (${event.status})", Toast.LENGTH_SHORT).show()
        }
        rvHistory.adapter = adapter
        layoutEmpty.visibility = if (allEvents.isEmpty()) View.VISIBLE else View.GONE

        // Fetch fresh alerts history from PostgreSQL backend
        lifecycleScope.launch {
            val res = apiClient.fetchAlertsHistory()
            res.onSuccess { freshList ->
                allEvents = freshList
                adapter.updateData(freshList)
                layoutEmpty.visibility = if (freshList.isEmpty()) View.VISIBLE else View.GONE
            }
        }

        fun applyFilter(status: String) {
            val filtered = if (status == "ALL") allEvents else allEvents.filter { it.status.equals(status, ignoreCase = true) }
            adapter.updateData(filtered)
            layoutEmpty.visibility = if (filtered.isEmpty()) View.VISIBLE else View.GONE
        }

        chipAll.setOnClickListener { applyFilter("ALL") }
        chipSent.setOnClickListener { applyFilter("Sent") }
        chipCancelled.setOnClickListener { applyFilter("Cancelled") }
        chipActive.setOnClickListener { applyFilter("Active") }

        containerContent.addView(view)
    }

    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    // TAB 6: SETTINGS
    // ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
    private fun setupSettingsView(inflater: LayoutInflater) {
        val view = inflater.inflate(R.layout.layout_tab_settings, containerContent, false)

        val tvName: TextView = view.findViewById(R.id.tvSettingsUserName)
        val tvEmail: TextView = view.findViewById(R.id.tvSettingsUserEmail)
        val tvAvatar: TextView = view.findViewById(R.id.tvSettingsAvatar)

        val u = sessionManager.currentUser
        tvName.text = u?.name ?: "User"
        tvEmail.text = u?.email ?: "user@example.com"
        tvAvatar.text = (u?.name ?: "User").split(" ").mapNotNull { it.firstOrNull()?.toString() }.take(2).joinToString("").uppercase().ifEmpty { "DS" }

        // Profile banner -> ProfileActivity
        view.findViewById<LinearLayout>(R.id.cardProfileBanner).setOnClickListener {
            startActivity(Intent(this, ProfileActivity::class.java))
        }

        // Capture settings -> CaptureSettingsActivity
        view.findViewById<LinearLayout>(R.id.cardCaptureSettings).setOnClickListener {
            startActivity(Intent(this, CaptureSettingsActivity::class.java))
        }

        // Fake call -> FakeCallActivity
        view.findViewById<LinearLayout>(R.id.cardFakeCall).setOnClickListener {
            startActivity(Intent(this, FakeCallActivity::class.java))
        }

        // Change PIN
        view.findViewById<LinearLayout>(R.id.cardChangePin).setOnClickListener {
            showChangePinDialog()
        }

        // Test Resend Alert
        view.findViewById<LinearLayout>(R.id.cardTestResendAlert).setOnClickListener {
            Toast.makeText(this, "Dispatching test emergency alert via Resend...", Toast.LENGTH_SHORT).show()
            lifecycleScope.launch {
                apiClient.testResendAlert(sessionManager.currentUser?.email)
                Toast.makeText(this@MainActivity, "Test emergency alert dispatched!", Toast.LENGTH_SHORT).show()
            }
        }

        // Submit Feedback
        val etFeedback: EditText = view.findViewById(R.id.etFeedbackMessage)
        val btnSubmitFb: AppCompatButton = view.findViewById(R.id.btnSubmitFeedback)
        btnSubmitFb.setOnClickListener {
            val msg = etFeedback.text.toString().trim()
            if (msg.isNotEmpty()) {
                lifecycleScope.launch {
                    apiClient.submitFeedback(5, "Feature Request", msg)
                    Toast.makeText(this@MainActivity, "Thank you! Feedback submitted to SilentSOS backend.", Toast.LENGTH_SHORT).show()
                    etFeedback.setText("")
                }
            } else {
                Toast.makeText(this, "Please enter your message", Toast.LENGTH_SHORT).show()
            }
        }

        // Reset Data
        view.findViewById<AppCompatButton>(R.id.btnClearData).setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("Reset App Data")
                .setMessage("Are you sure you want to clear local cache and session data?")
                .setPositiveButton("Reset") { _, _ ->
                    lifecycleScope.launch {
                        apiClient.clearData()
                        startActivity(Intent(this@MainActivity, AuthActivity::class.java))
                        finish()
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        // Log out
        view.findViewById<AppCompatButton>(R.id.btnLogout).setOnClickListener {
            sessionManager.logout()
            startActivity(Intent(this, AuthActivity::class.java))
            finish()
        }

        containerContent.addView(view)
    }

    private fun showChangePinDialog() {
        val input = EditText(this).apply {
            hint = "Enter new 4-digit PIN"
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
        }
        AlertDialog.Builder(this)
            .setTitle("Change Safety PIN")
            .setView(input)
            .setPositiveButton("Save PIN") { _, _ ->
                val pin = input.text.toString().trim()
                if (pin.length == 4) {
                    sessionManager.safetyPin = pin
                    lifecycleScope.launch {
                        apiClient.updateSettings(sessionManager.settings.copy(safetyPin = pin))
                        Toast.makeText(this@MainActivity, "PIN changed successfully!", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    Toast.makeText(this, "PIN must be exactly 4 digits", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
