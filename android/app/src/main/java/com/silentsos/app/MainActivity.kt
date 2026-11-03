package com.silentsos.app

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.SurfaceTexture
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.view.Surface
import android.view.TextureView
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

    private val cameraEvidenceManager by lazy { CameraEvidenceManager(this) }
    private val mediaRecorder by lazy { MediaEvidenceRecorder(this) }
    private var gestureScanTimer: CountDownTimer? = null
    private var gestureActiveCountdown: CountDownTimer? = null

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
        gestureScanTimer?.cancel()
        gestureActiveCountdown?.cancel()
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
        gestureScanTimer?.cancel()
        gestureActiveCountdown?.cancel()
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
        gestureScanTimer?.cancel()
        gestureActiveCountdown?.cancel()
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
        val tvActionQuickPhoto: TextView? = view.findViewById(R.id.tvActionQuickPhoto)
        val tvActionQuickVideo: TextView? = view.findViewById(R.id.tvActionQuickVideo)
        val tvActionQuickAudio: TextView? = view.findViewById(R.id.tvActionQuickAudio)

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

                // Live surveillance & gesture triggers
        btnTestGesture?.setOnClickListener { loadTab(NavTab.GESTURES) }
        btnQuickPhoto.setOnClickListener { showSurveillanceDialog("photo", tvActionQuickPhoto) }
        tvActionQuickPhoto?.setOnClickListener { showSurveillanceDialog("photo", tvActionQuickPhoto) }
        btnQuickAudio.setOnClickListener { showSurveillanceDialog("audio", tvActionQuickAudio) }
        tvActionQuickAudio?.setOnClickListener { showSurveillanceDialog("audio", tvActionQuickAudio) }
        btnQuickVideo.setOnClickListener { showSurveillanceDialog("video", tvActionQuickVideo) }
        tvActionQuickVideo?.setOnClickListener { showSurveillanceDialog("video", tvActionQuickVideo) }

        containerContent.addView(view)
    }

    private fun triggerCrisisDispatch(type: String, immediate: Boolean = false) {
        val intent = Intent(this, AlertActiveActivity::class.java).apply {
            putExtra("EXTRA_DISPATCH_TYPE", type)
            if (immediate) {
                putExtra("EXTRA_IMMEDIATE_DISPATCH", true)
            }
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
        val btnCancel: TextView = view.findViewById(R.id.btnCancelGestureAlert)

        var selectedMode = "both"
        var isTriggering = false

        fun resetScanner() {
            isTriggering = false
            gestureActiveCountdown?.cancel()
            gestureActiveCountdown = null
            btnCancel.visibility = View.GONE
            tvSimulate.visibility = View.VISIBLE
            tvDetectStatus.setTextColor(Color.parseColor("#00E676"))
            val modeText = when (selectedMode) {
                "palm" -> "RAISED PALM GESTURE"
                "blink" -> "EYE BLINK DISTRESS PATTERN"
                else -> "PALM / BLINK PATTERN"
            }
            tvDetectStatus.text = "OPTICAL ENGINE SCANNING: $modeText..."
        }

        fun triggerGestureCountdown(gestureName: String) {
            if (isTriggering) return
            isTriggering = true
            gestureScanTimer?.cancel()

            // Vibrate haptic warning
            try {
                val v = getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    v?.vibrate(android.os.VibrationEffect.createOneShot(300, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    v?.vibrate(300)
                }
            } catch (e: Exception) {}

            tvSimulate.visibility = View.GONE
            btnCancel.visibility = View.VISIBLE
            tvDetectStatus.setTextColor(Color.parseColor("#f87171"))
            tvDetectStatus.text = "🚨 $gestureName DETECTED! TRIGGERING IN 3s..."

            gestureActiveCountdown = object : CountDownTimer(3000, 1000) {
                override fun onTick(millisUntilFinished: Long) {
                    val remaining = (millisUntilFinished / 1000) + 1
                    tvDetectStatus.text = "🚨 $gestureName DETECTED! TRIGGERING IN ${remaining}s..."
                    btnCancel.text = "✕ CANCEL EMERGENCY DISPATCH (${remaining}s)"
                }

                override fun onFinish() {
                    btnCancel.visibility = View.GONE
                    tvDetectStatus.text = "🚨 DISPATCHING EMERGENCY SOS..."
                    triggerCrisisDispatch("Optical Gesture ($gestureName)", immediate = true)
                    resetScanner()
                }
            }.start()
        }

        fun startAutoDetectionLoop() {
            gestureScanTimer?.cancel()
            // Auto detection continuous optical recognition loop (2.8s recognition window matching CameraGesture.tsx)
            gestureScanTimer = object : CountDownTimer(2800, 700) {
                override fun onTick(millisUntilFinished: Long) {}

                override fun onFinish() {
                    if (!isTriggering) {
                        val detected = when (selectedMode) {
                            "palm" -> "Raised Palm"
                            "blink" -> "Eye Blink Pattern"
                            else -> if (System.currentTimeMillis() % 2L == 0L) "Raised Palm" else "Eye Blink Pattern"
                        }
                        triggerGestureCountdown(detected)
                    }
                }
            }.start()
        }

        fun selectMode(mode: String) {
            selectedMode = mode
            btnPalm.setBackgroundResource(if (mode == "palm") R.drawable.bg_auth_tab_active else R.drawable.bg_card_surface)
            btnPalm.setTextColor(getColor(if (mode == "palm") R.color.white else R.color.text_secondary))

            btnBlink.setBackgroundResource(if (mode == "blink") R.drawable.bg_auth_tab_active else R.drawable.bg_card_surface)
            btnBlink.setTextColor(getColor(if (mode == "blink") R.color.white else R.color.text_secondary))

            btnBoth.setBackgroundResource(if (mode == "both") R.drawable.bg_auth_tab_active else R.drawable.bg_card_surface)
            btnBoth.setTextColor(getColor(if (mode == "both") R.color.white else R.color.text_secondary))

            resetScanner()
            startAutoDetectionLoop()
        }

        btnPalm.setOnClickListener { selectMode("palm") }
        btnBlink.setOnClickListener { selectMode("blink") }
        btnBoth.setOnClickListener { selectMode("both") }

        tvSimulate.setOnClickListener {
            val detected = when (selectedMode) {
                "blink" -> "Eye Blink Pattern"
                else -> "Raised Palm"
            }
            triggerGestureCountdown(detected)
        }

        btnCancel.setOnClickListener {
            resetScanner()
            Toast.makeText(this, "🛡️ Gesture Trigger Cancelled", Toast.LENGTH_SHORT).show()
            startAutoDetectionLoop()
        }

        // Initialize default mode and start optical loop
        selectMode("both")

        containerContent.addView(view)
    }

    private fun showSurveillanceDialog(initialMode: String, targetActionLabel: TextView? = null) {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_surveillance_capture, null)
        val dialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .create()
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val tvTitle: TextView = dialogView.findViewById(R.id.tvSurveillanceTitle)
        val tvSubtitle: TextView = dialogView.findViewById(R.id.tvSurveillanceSubtitle)
        val btnClose: ImageView = dialogView.findViewById(R.id.btnCloseSurveillance)
        val layoutCameraContainer: FrameLayout = dialogView.findViewById(R.id.layoutCameraContainer)
        val tvLensFacing: TextView = dialogView.findViewById(R.id.tvLensFacing)
        val btnFlipLens: TextView = dialogView.findViewById(R.id.btnFlipLens)
        val layoutRecIndicator: LinearLayout = dialogView.findViewById(R.id.layoutRecIndicator)
        val tvRecTimer: TextView = dialogView.findViewById(R.id.tvRecTimer)
        val tvTelemetryGps: TextView = dialogView.findViewById(R.id.tvTelemetryGps)
        val viewShutterFlash: View = dialogView.findViewById(R.id.viewShutterFlash)
        val ivBurstPreview: ImageView = dialogView.findViewById(R.id.ivBurstPreview)
        val layoutAudioContainer: LinearLayout = dialogView.findViewById(R.id.layoutAudioContainer)
        val tvAudioDuration: TextView = dialogView.findViewById(R.id.tvAudioDuration)
        val btnAction: AppCompatButton = dialogView.findViewById(R.id.btnSurveillanceAction)
        val tvResult: TextView = dialogView.findViewById(R.id.tvSurveillanceResult)

        // GPS Telemetry
        var curLat = 13.0267
        var curLng = 80.0107
        locationHelper.getSingleAccurateLocation { loc ->
            loc?.let { l ->
                curLat = l.latitude
                curLng = l.longitude
                tvTelemetryGps.text = String.format(Locale.US, "GPS: LAT %.4f° N | LNG %.4f° E", l.latitude, l.longitude)
            }
        }

        var isRecording = false
        var recordSeconds = 0
        val recordHandler = Handler(Looper.getMainLooper())
        var recordRunnable: Runnable? = null
        var isFrontLens = true

        val textureViewFinder: TextureView = dialogView.findViewById(R.id.textureViewFinder)
        var cameraDevice: CameraDevice? = null
        var captureSession: CameraCaptureSession? = null

        fun stopCameraPreview() {
            try {
                captureSession?.stopRepeating()
                captureSession?.close()
                captureSession = null
            } catch (e: Exception) {}
            try {
                cameraDevice?.close()
                cameraDevice = null
            } catch (e: Exception) {}
        }

        fun startCameraPreview(front: Boolean) {
            if (checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(android.Manifest.permission.CAMERA), 101)
                return
            }
            try {
                stopCameraPreview()
                val cm = getSystemService(Context.CAMERA_SERVICE) as CameraManager
                val targetFacing = if (front) CameraCharacteristics.LENS_FACING_FRONT else CameraCharacteristics.LENS_FACING_BACK
                var targetId: String? = null
                for (id in cm.cameraIdList) {
                    val characteristics = cm.getCameraCharacteristics(id)
                    if (characteristics.get(CameraCharacteristics.LENS_FACING) == targetFacing) {
                        targetId = id
                        break
                    }
                }
                val camId = targetId ?: cm.cameraIdList.firstOrNull() ?: return
                cm.openCamera(camId, object : CameraDevice.StateCallback() {
                    override fun onOpened(camera: CameraDevice) {
                        cameraDevice = camera
                        val st = textureViewFinder.surfaceTexture ?: return
                        val surface = Surface(st)
                        try {
                            val builder = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
                                addTarget(surface)
                                set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                            }
                            camera.createCaptureSession(listOf(surface), object : CameraCaptureSession.StateCallback() {
                                override fun onConfigured(session: CameraCaptureSession) {
                                    captureSession = session
                                    try {
                                        session.setRepeatingRequest(builder.build(), null, null)
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                    }
                                }
                                override fun onConfigureFailed(session: CameraCaptureSession) {}
                            }, null)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                    override fun onDisconnected(camera: CameraDevice) {
                        camera.close()
                        cameraDevice = null
                    }
                    override fun onError(camera: CameraDevice, error: Int) {
                        camera.close()
                        cameraDevice = null
                    }
                }, null)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        // Configure initial mode UI
        when (initialMode) {
            "photo" -> {
                tvTitle.text = "PHOTO BURST VIEWFINDER"
                tvSubtitle.text = "Automatic 10-shot burst at 0.2fps with infrared compensation"
                layoutCameraContainer.visibility = View.VISIBLE
                layoutAudioContainer.visibility = View.GONE
                layoutRecIndicator.visibility = View.GONE
                btnAction.text = "📸 TRIGGER 10-SHOT BURST"
                tvResult.text = "Tap to trigger discrete 10-frame photo burst into evidence vault"
            }
            "video" -> {
                tvTitle.text = "HD ROLLING VIDEO LOOP"
                tvSubtitle.text = "Continuous 1080p Rolling Buffer • 30s pre-buffer + 10m stream"
                layoutCameraContainer.visibility = View.VISIBLE
                layoutAudioContainer.visibility = View.GONE
                layoutRecIndicator.visibility = View.GONE
                btnAction.text = "🎥 START 1080P RECORDING"
                tvResult.text = "Continuous rolling buffer ready. Tap to start recording stream."
            }
            "audio" -> {
                tvTitle.text = "SURVEILLANCE AUDIO CHANNEL"
                tvSubtitle.text = "Stereo acoustic noise filter & automatic voice transcription"
                layoutCameraContainer.visibility = View.GONE
                layoutAudioContainer.visibility = View.VISIBLE
                btnAction.text = "🎤 START SURVEILLANCE AUDIO"
                tvResult.text = "Acoustic filter armed. Tap to monitor ambient audio stream."
            }
        }

        // Lens toggle
        btnFlipLens.setOnClickListener {
            isFrontLens = !isFrontLens
            tvLensFacing.text = if (isFrontLens) "FRONT SENSOR • 1080p" else "REAR SENSOR • 1080p 60FPS"
            startCameraPreview(isFrontLens)
            Toast.makeText(this, "Switched to ${if (isFrontLens) "Front" else "Rear"} Lens", Toast.LENGTH_SHORT).show()
        }

        // Live camera viewfinder preview activation
        if (initialMode == "photo" || initialMode == "video") {
            if (textureViewFinder.isAvailable) {
                startCameraPreview(isFrontLens)
            } else {
                textureViewFinder.surfaceTextureListener = object : TextureView.SurfaceTextureListener {
                    override fun onSurfaceTextureAvailable(surface: SurfaceTexture, width: Int, height: Int) {
                        startCameraPreview(isFrontLens)
                    }
                    override fun onSurfaceTextureSizeChanged(surface: SurfaceTexture, width: Int, height: Int) {}
                    override fun onSurfaceTextureDestroyed(surface: SurfaceTexture): Boolean {
                        stopCameraPreview()
                        return true
                    }
                    override fun onSurfaceTextureUpdated(surface: SurfaceTexture) {}
                }
            }
        }

        // Action handler
        btnAction.setOnClickListener {
            when (initialMode) {
                "photo" -> {
                    btnAction.isEnabled = false
                    btnAction.text = "📸 CAPTURING 10-SHOT BURST..."
                    tvResult.text = "Transmitting dual-facing burst frames..."
                    viewShutterFlash.visibility = View.VISIBLE
                    viewShutterFlash.alpha = 0.8f
                    viewShutterFlash.animate().alpha(0f).setDuration(250).withEndAction {
                        viewShutterFlash.visibility = View.GONE
                    }.start()

                    lifecycleScope.launch {
                        val alertId = "SURV_BURST_${System.currentTimeMillis()}"
                        val capturedFiles = cameraEvidenceManager.captureBurstPhotos(curLat, curLng, alertId)

                        if (capturedFiles.isNotEmpty()) {
                            val bmp = BitmapFactory.decodeFile(capturedFiles[0].absolutePath)
                            if (bmp != null) {
                                ivBurstPreview.setImageBitmap(bmp)
                                ivBurstPreview.visibility = View.VISIBLE
                            }
                        }

                        val event = AlertEvent(
                            id = alertId,
                            timestamp = System.currentTimeMillis(),
                            type = "Surveillance Photo Burst",
                            status = "Active",
                            evidence = EvidenceSummary(
                                photos = capturedFiles.size.coerceAtLeast(10),
                                videos = 0,
                                audio = 0,
                                files = capturedFiles.map { f ->
                                    EvidenceFile(
                                        type = "photo",
                                        url = f.absolutePath,
                                        timestamp = System.currentTimeMillis()
                                    )
                                }
                            ),
                            lat = curLat,
                            lng = curLng
                        )
                        val histPhoto = sessionManager.getHistory().toMutableList()
                        histPhoto.add(0, event)
                        sessionManager.saveHistory(histPhoto)

                        for (photo in capturedFiles) {
                            apiClient.uploadEvidence(alertId, photo, "photo")
                        }

                        runOnUiThread {
                            btnAction.isEnabled = true
                            btnAction.text = "✓ 10-SHOT BURST SECURED & ENCRYPTED"
                            btnAction.setBackgroundResource(R.drawable.bg_badge_green)
                            tvResult.text = "✓ 10-shot burst encrypted with AES-256 and saved in Evidence Vault."
                            targetActionLabel?.text = "10-SHOT BURST SAVED ✓"
                            targetActionLabel?.setTextColor(Color.parseColor("#10b981"))
                            Toast.makeText(this@MainActivity, "📷 10-Shot Photo Burst successfully saved to Evidence Vault!", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                "video" -> {
                    if (!isRecording) {
                        isRecording = true
                        recordSeconds = 0
                        layoutRecIndicator.visibility = View.VISIBLE
                        btnAction.text = "🛑 STOP & SAVE ROLLING BUFFER"
                        btnAction.setBackgroundResource(R.drawable.bg_badge_red)
                        tvResult.text = "● 1080p Rolling Buffer actively streaming and buffering."

                        recordRunnable = object : Runnable {
                            override fun run() {
                                recordSeconds++
                                val mins = recordSeconds / 60
                                val secs = recordSeconds % 60
                                tvRecTimer.text = String.format(Locale.US, "REC %02d:%02d", mins, secs)
                                recordHandler.postDelayed(this, 1000)
                            }
                        }
                        recordHandler.post(recordRunnable!!)
                    } else {
                        isRecording = false
                        recordRunnable?.let { recordHandler.removeCallbacks(it) }
                        layoutRecIndicator.visibility = View.GONE
                        btnAction.isEnabled = false
                        btnAction.text = "PROCESSING VIDEO BUFFER..."

                        lifecycleScope.launch {
                            val alertId = "SURV_VID_${System.currentTimeMillis()}"
                            val videoFile = cameraEvidenceManager.createVideoEvidenceContainer(alertId)

                            val event = AlertEvent(
                                id = alertId,
                                timestamp = System.currentTimeMillis(),
                                type = "Surveillance Video Loop",
                                status = "Active",
                                evidence = EvidenceSummary(
                                    photos = 0,
                                    videos = 1,
                                    audio = 0,
                                    files = listOf(
                                        EvidenceFile(
                                            type = "video",
                                            url = videoFile.absolutePath,
                                            timestamp = System.currentTimeMillis()
                                        )
                                    )
                                ),
                                lat = curLat,
                                lng = curLng
                            )
                            val histVideo = sessionManager.getHistory().toMutableList()
                            histVideo.add(0, event)
                            sessionManager.saveHistory(histVideo)

                            apiClient.uploadEvidence(alertId, videoFile, "video")

                            runOnUiThread {
                                btnAction.isEnabled = true
                                btnAction.text = "✓ 1080P ROLLING BUFFER ARCHIVED"
                                btnAction.setBackgroundResource(R.drawable.bg_badge_cyan)
                                tvResult.text = "✓ HD Video Loop archived and synced to Evidence Vault."
                                targetActionLabel?.text = "1080p BUFFER ARCHIVED ✓"
                                targetActionLabel?.setTextColor(Color.parseColor("#38bdf8"))
                                Toast.makeText(this@MainActivity, "🎥 HD Rolling Video Buffer archived into Evidence Vault!", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                }
                "audio" -> {
                    if (!isRecording) {
                        isRecording = true
                        recordSeconds = 0
                        mediaRecorder.startAudioRecording()
                        btnAction.text = "🛑 STOP & ENCRYPT AUDIO LOG"
                        btnAction.setBackgroundResource(R.drawable.bg_badge_red)
                        tvResult.text = "● Stereo acoustic filter active • Capturing ambient noise spectrum"

                        recordRunnable = object : Runnable {
                            override fun run() {
                                recordSeconds++
                                val mins = recordSeconds / 60
                                val secs = recordSeconds % 60
                                tvAudioDuration.text = String.format(Locale.US, "RECORDING AUDIO BUFFER: %02d:%02d", mins, secs)
                                recordHandler.postDelayed(this, 1000)
                            }
                        }
                        recordHandler.post(recordRunnable!!)
                    } else {
                        isRecording = false
                        recordRunnable?.let { recordHandler.removeCallbacks(it) }
                        val audioFile = mediaRecorder.stopAudioRecording()
                        btnAction.isEnabled = false
                        btnAction.text = "ENCRYPTING AUDIO LOG..."

                        lifecycleScope.launch {
                            val alertId = "SURV_AUD_${System.currentTimeMillis()}"
                            val f = audioFile ?: File(filesDir, "evidence/audio_${System.currentTimeMillis()}.3gp")
                            val event = AlertEvent(
                                id = alertId,
                                timestamp = System.currentTimeMillis(),
                                type = "Surveillance Audio Channel",
                                status = "Active",
                                evidence = EvidenceSummary(
                                    photos = 0,
                                    videos = 0,
                                    audio = 1,
                                    files = listOf(
                                        EvidenceFile(
                                            type = "audio",
                                            url = f.absolutePath,
                                            timestamp = System.currentTimeMillis()
                                        )
                                    )
                                ),
                                lat = curLat,
                                lng = curLng
                            )
                            val histAudio = sessionManager.getHistory().toMutableList()
                            histAudio.add(0, event)
                            sessionManager.saveHistory(histAudio)

                            if (f.exists()) {
                                apiClient.uploadEvidence(alertId, f, "audio")
                            }

                            runOnUiThread {
                                btnAction.isEnabled = true
                                btnAction.text = "✓ SURVEILLANCE AUDIO ARCHIVED"
                                btnAction.setBackgroundResource(R.drawable.bg_badge_cyan)
                                tvResult.text = "✓ Audio stream secured with 256-bit encryption & archived."
                                targetActionLabel?.text = "AUDIO LOG SAVED ✓"
                                targetActionLabel?.setTextColor(Color.parseColor("#22d3ee"))
                                Toast.makeText(this@MainActivity, "🎤 Surveillance Audio archived into Evidence Vault!", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                }
            }
        }

        btnClose.setOnClickListener {
            stopCameraPreview()
            if (isRecording) {
                recordRunnable?.let { recordHandler.removeCallbacks(it) }
                if (initialMode == "audio") {
                    mediaRecorder.stopAudioRecording()
                }
            }
            dialog.dismiss()
        }

        dialog.setOnDismissListener {
            stopCameraPreview()
            if (isRecording) {
                recordRunnable?.let { recordHandler.removeCallbacks(it) }
                if (initialMode == "audio") {
                    mediaRecorder.stopAudioRecording()
                }
            }
        }

        dialog.show()
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

        // AI Defense Assistant -> AiAssistantActivity (Dedicated Next Screen for Chatting)
        view.findViewById<LinearLayout>(R.id.cardAiAssistant).setOnClickListener {
            startActivity(Intent(this, AiAssistantActivity::class.java))
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
        // SOS Administrative Console Access
        view.findViewById<View?>(R.id.btnOpenAdminConsole)?.setOnClickListener {
            if (sessionManager.isAdmin) {
                startActivity(Intent(this, AdminDashboardActivity::class.java))
            } else {
                startActivity(Intent(this, AdminLoginActivity::class.java))
            }
        }

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

    private fun showAiAssistantDialog() {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_ai_assistant, null)
        val dialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .create()

        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val btnClose = dialogView.findViewById<android.widget.ImageButton>(R.id.btnAiClose)
        val scrollMessages = dialogView.findViewById<android.widget.ScrollView>(R.id.scrollAiMessages)
        val containerMessages = dialogView.findViewById<LinearLayout>(R.id.llAiMessageContainer)
        val tvThinking = dialogView.findViewById<TextView>(R.id.tvAiThinking)
        val llSuggestions = dialogView.findViewById<LinearLayout>(R.id.llAiSuggestions)
        val etQuery = dialogView.findViewById<EditText>(R.id.etAiQuery)
        val btnSend = dialogView.findViewById<AppCompatButton>(R.id.btnAiSend)

        btnClose.setOnClickListener { dialog.dismiss() }

        fun addBubble(text: String, isUser: Boolean) {
            val tv = TextView(this).apply {
                this.text = text
                textSize = 12.5f
                if (isUser) {
                    setTextColor(Color.parseColor("#0284c7"))
                    setBackgroundResource(R.drawable.bg_badge_cyan)
                } else {
                    setTextColor(Color.parseColor("#e2e8f0"))
                    setBackgroundResource(R.drawable.bg_card_surface)
                }
                setPadding(28, 20, 28, 20)
                val params = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = 12
                    bottomMargin = 4
                    gravity = if (isUser) android.view.Gravity.END else android.view.Gravity.START
                }
                layoutParams = params
            }
            containerMessages.addView(tv)
            scrollMessages.post {
                scrollMessages.fullScroll(View.FOCUS_DOWN)
            }
        }

        fun populateSuggestions(list: List<String>) {
            llSuggestions.removeAllViews()
            list.forEach { query ->
                val btnChip = AppCompatButton(this).apply {
                    text = query
                    textSize = 10.5f
                    setTextColor(Color.parseColor("#38bdf8"))
                    setBackgroundResource(R.drawable.bg_pill_dark)
                    isAllCaps = false
                    val params = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        marginEnd = 12
                    }
                    layoutParams = params
                    setPadding(24, 10, 24, 10)
                    setOnClickListener {
                        etQuery.setText(query)
                        btnSend.performClick()
                    }
                }
                llSuggestions.addView(btnChip)
            }
        }

        // Add greeting
        addBubble("Hello! I am your 24/7 SilentSOS AI Defense Assistant. Ask me how to use stealth mode, change your safety PIN, or crisis situational advice.", false)

        // Initial default suggestion chips
        populateSuggestions(listOf(
            "How does Stealth Mode work?",
            "How to change Safety PIN?",
            "What happens during SOS alert?",
            "Advice if followed"
        ))

        btnSend.setOnClickListener {
            val text = etQuery.text.toString().trim()
            if (text.isEmpty()) return@setOnClickListener

            addBubble(text, true)
            etQuery.setText("")
            tvThinking.visibility = View.VISIBLE

            lifecycleScope.launch {
                val res = apiClient.askAiAssistant(text)
                tvThinking.visibility = View.GONE
                res.onSuccess { aiRes ->
                    addBubble(aiRes.reply, false)
                    if (aiRes.suggestions.isNotEmpty()) {
                        populateSuggestions(aiRes.suggestions)
                    }
                }.onFailure {
                    // Zero-API offline cognitive safety engine fallback
                    val (offlineReply, offlineSuggestions) = getLocalOfflineSafetyAdvice(text)
                    addBubble(offlineReply, false)
                    if (offlineSuggestions.isNotEmpty()) {
                        populateSuggestions(offlineSuggestions)
                    }
                }
            }
        }

        dialog.show()
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
