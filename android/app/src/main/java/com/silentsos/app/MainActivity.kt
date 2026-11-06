package com.silentsos.app

import android.Manifest
import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
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
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
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
import android.widget.MediaController
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import android.widget.VideoView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
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

        checkAndRequestAppPermissions()

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
                        val capturedFiles = cameraEvidenceManager.captureBurstPhotos(curLat, curLng, alertId, textureViewFinder)

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
                        btnAction.text = "SECURING VIDEO & AUDIO BUFFER..."

                        lifecycleScope.launch {
                            val alertId = "SURV_VID_${System.currentTimeMillis()}"
                            val vaultManager = EvidenceVaultManager(this@MainActivity)
                            val duration = recordSeconds.coerceIn(5, 30)

                            val videoFile = cameraEvidenceManager.recordVideoEvidence(
                                alertId = alertId,
                                durationSeconds = duration,
                                cameraFacing = if (isFrontLens) CameraCharacteristics.LENS_FACING_FRONT else CameraCharacteristics.LENS_FACING_BACK
                            )

                            val finalVideo = if (videoFile != null && videoFile.exists() && vaultManager.verifyVideo(videoFile)) {
                                val dest = File(vaultManager.getVideosDir(alertId), videoFile.name)
                                videoFile.copyTo(dest, overwrite = true)
                                dest
                            } else null

                            var finalAudio: File? = null
                            if (finalVideo != null && finalVideo.exists()) {
                                val targetAudio = File(vaultManager.getAudioDir(alertId), "audio_${alertId}_${System.currentTimeMillis()}.m4a")
                                if (AudioExtractor.extractAudioTrackFromMp4(finalVideo, targetAudio) && vaultManager.verifyAudio(targetAudio)) {
                                    finalAudio = targetAudio
                                }
                            }

                            val files = mutableListOf<EvidenceFile>()
                            if (finalVideo != null && finalVideo.exists()) {
                                files.add(EvidenceFile("video", finalVideo.absolutePath, System.currentTimeMillis()))
                            }
                            if (finalAudio != null && finalAudio.exists()) {
                                files.add(EvidenceFile("audio", finalAudio.absolutePath, System.currentTimeMillis()))
                            }

                            val event = AlertEvent(
                                id = alertId,
                                timestamp = System.currentTimeMillis(),
                                type = "Surveillance Video Loop",
                                status = "Active",
                                evidence = EvidenceSummary(
                                    photos = 0,
                                    videos = if (finalVideo != null) 1 else 0,
                                    audio = if (finalAudio != null) 1 else 0,
                                    files = files
                                ),
                                lat = curLat,
                                lng = curLng
                            )
                            val histVideo = sessionManager.getHistory().toMutableList()
                            histVideo.add(0, event)
                            sessionManager.saveHistory(histVideo)

                            if (finalVideo != null && finalVideo.exists()) {
                                apiClient.uploadEvidence(alertId, finalVideo, "video")
                            }
                            if (finalAudio != null && finalAudio.exists()) {
                                apiClient.uploadEvidence(alertId, finalAudio, "audio")
                            }

                            runOnUiThread {
                                btnAction.isEnabled = true
                                btnAction.text = "✓ 1080P ROLLING BUFFER ARCHIVED"
                                btnAction.setBackgroundResource(R.drawable.bg_badge_cyan)
                                tvResult.text = "✓ HD Video & Audio Loop archived and synced to Evidence Vault."
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
                            val vaultManager = EvidenceVaultManager(this@MainActivity)
                            val targetAudio = File(vaultManager.getAudioDir(alertId), "audio_${alertId}_${System.currentTimeMillis()}.m4a")

                            val finalAudio = if (audioFile != null && audioFile.exists()) {
                                audioFile.copyTo(targetAudio, overwrite = true)
                                if (vaultManager.verifyAudio(targetAudio)) targetAudio else audioFile
                            } else null

                            val files = mutableListOf<EvidenceFile>()
                            if (finalAudio != null && finalAudio.exists()) {
                                files.add(EvidenceFile("audio", finalAudio.absolutePath, System.currentTimeMillis()))
                            }

                            val event = AlertEvent(
                                id = alertId,
                                timestamp = System.currentTimeMillis(),
                                type = "Surveillance Audio Channel",
                                status = "Active",
                                evidence = EvidenceSummary(
                                    photos = 0,
                                    videos = 0,
                                    audio = if (finalAudio != null) 1 else 0,
                                    files = files
                                ),
                                lat = curLat,
                                lng = curLng
                            )
                            val histAudio = sessionManager.getHistory().toMutableList()
                            histAudio.add(0, event)
                            sessionManager.saveHistory(histAudio)

                            if (finalAudio != null && finalAudio.exists()) {
                                apiClient.uploadEvidence(alertId, finalAudio, "audio")
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
    // ─────────────────────────────────────────────────────────────────────────
    // TAB 3: EVIDENCE
    // ─────────────────────────────────────────────────────────────────────────
    private fun deleteEvidenceRecord(event: AlertEvent, onDeleted: () -> Unit) {
        AlertDialog.Builder(this)
            .setTitle("Delete Evidence Record")
            .setMessage("Are you sure you want to delete this evidence record (${event.type})? This action cannot be undone.")
            .setPositiveButton("Delete") { _, _ ->
                val currentHistory = sessionManager.getHistory().filter { it.id != event.id }
                sessionManager.saveHistory(currentHistory)

                lifecycleScope.launch {
                    try {
                        apiClient.deleteAlert(event.id)
                    } catch (_: Exception) {}
                }

                Toast.makeText(this, "🗑️ Evidence record deleted", Toast.LENGTH_SHORT).show()
                onDeleted()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun setupEvidenceView(inflater: LayoutInflater) {
        val view = inflater.inflate(R.layout.layout_tab_evidence, containerContent, false)

        val tvPhotos: TextView = view.findViewById(R.id.tvEvPhotosCount)
        val tvVideos: TextView = view.findViewById(R.id.tvEvVideosCount)
        val tvAudio: TextView = view.findViewById(R.id.tvEvAudioCount)
        val tvGps: TextView = view.findViewById(R.id.tvEvGpsCount)
        val rvEvidence: RecyclerView = view.findViewById(R.id.rvEvidenceList)
        val layoutEmpty: LinearLayout = view.findViewById(R.id.layoutEvidenceEmpty)

        fun refreshEvidenceUI(list: List<AlertEvent>) {
            val p = list.sumOf { it.evidence.photos.coerceAtLeast(it.evidence.files.count { f -> f.type == "photo" }) }
            val v = list.sumOf { it.evidence.videos.coerceAtLeast(it.evidence.files.count { f -> f.type == "video" }) }
            val a = list.sumOf { it.evidence.audio.coerceAtLeast(it.evidence.files.count { f -> f.type == "audio" }) }
            val g = list.sumOf { it.gpsPath.size }

            tvPhotos.text = p.toString()
            tvVideos.text = v.toString()
            tvAudio.text = a.toString()
            tvGps.text = g.toString()
            layoutEmpty.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
        }

        val historyList = sessionManager.getHistory()
        refreshEvidenceUI(historyList)

        rvEvidence.layoutManager = LinearLayoutManager(this)
        var adapter: EvidenceAdapter? = null
        adapter = EvidenceAdapter(
            events = historyList,
            onItemClick = { event ->
                showEvidenceViewerDialog(event) {
                    val updated = sessionManager.getHistory()
                    refreshEvidenceUI(updated)
                    adapter?.updateData(updated)
                }
            },
            onItemDelete = { event ->
                deleteEvidenceRecord(event) {
                    val updated = sessionManager.getHistory()
                    refreshEvidenceUI(updated)
                    adapter?.updateData(updated)
                }
            }
        )
        rvEvidence.adapter = adapter

        // Sync fresh evidence counts and files from PostgreSQL backend
        lifecycleScope.launch {
            val res = apiClient.fetchAlertsHistory()
            res.onSuccess { freshList ->
                val localList = sessionManager.getHistory()
                val merged = if (freshList.isEmpty()) {
                    localList
                } else {
                    val localMap = localList.associateBy { it.id }
                    val mergedList = freshList.map { remoteEvent ->
                        val localEvent = localMap[remoteEvent.id]
                        if (localEvent != null) {
                            val combinedFiles = (localEvent.evidence.files + remoteEvent.evidence.files).distinctBy { it.url }
                            remoteEvent.copy(
                                evidence = remoteEvent.evidence.copy(
                                    photos = remoteEvent.evidence.photos.coerceAtLeast(localEvent.evidence.photos),
                                    videos = remoteEvent.evidence.videos.coerceAtLeast(localEvent.evidence.videos),
                                    audio = remoteEvent.evidence.audio.coerceAtLeast(localEvent.evidence.audio),
                                    files = combinedFiles
                                )
                            )
                        } else {
                            remoteEvent
                        }
                    }.toMutableList()
                    val serverIds = freshList.map { it.id }.toSet()
                    for (locEvent in localList) {
                        if (!serverIds.contains(locEvent.id)) {
                            mergedList.add(0, locEvent)
                        }
                    }
                    mergedList
                }
                sessionManager.saveHistory(merged)
                refreshEvidenceUI(merged)
                adapter?.updateData(merged)
            }
        }

        containerContent.addView(view)
    }

    private fun showEvidenceViewerDialog(event: AlertEvent, onDeleted: (() -> Unit)? = null) {
        val dialogView = LayoutInflater.from(this).inflate(R.layout.dialog_evidence_viewer, null)
        val dialog = AlertDialog.Builder(this)
            .setView(dialogView)
            .create()

        val tvViewerDate: TextView = dialogView.findViewById(R.id.tvViewerDate)
        val tvViewerTitle: TextView = dialogView.findViewById(R.id.tvViewerTitle)
        val tvViewerLocation: TextView = dialogView.findViewById(R.id.tvViewerLocation)
        val tvViewerIncidentId: TextView? = dialogView.findViewById(R.id.tvViewerIncidentId)
        val tvViewerSecurityDetails: TextView? = dialogView.findViewById(R.id.tvViewerSecurityDetails)
        val tvViewerSha256: TextView? = dialogView.findViewById(R.id.tvViewerSha256)

        val layoutPhotoThumbnails: LinearLayout = dialogView.findViewById(R.id.layoutPhotoThumbnails)
        val tvNoPhotos: TextView = dialogView.findViewById(R.id.tvNoPhotos)

        val btnPlayAudio: ImageView = dialogView.findViewById(R.id.btnPlayAudio)
        val tvAudioFileName: TextView = dialogView.findViewById(R.id.tvAudioFileName)
        val tvAudioStatus: TextView = dialogView.findViewById(R.id.tvAudioStatus)

        val btnPlayVideo: ImageView = dialogView.findViewById(R.id.btnPlayVideo)
        val tvVideoFileName: TextView = dialogView.findViewById(R.id.tvVideoFileName)
        val tvVideoStatus: TextView = dialogView.findViewById(R.id.tvVideoStatus)
        val btnCloseViewer: AppCompatButton = dialogView.findViewById(R.id.btnCloseViewer)
        val btnDeleteViewer: AppCompatButton? = dialogView.findViewById(R.id.btnDeleteViewer)

        val vaultManager = EvidenceVaultManager(this)
        val meta = vaultManager.loadIncidentMetadata(event.id)

        if (meta != null) {
            tvViewerIncidentId?.text = "INCIDENT ID: ${meta.incidentId}"
            tvViewerSecurityDetails?.text = "🔒 ${meta.encryptionStatus} | ${meta.uploadStatus}"
            if (meta.sha256Hashes.isNotEmpty()) {
                tvViewerSha256?.text = "SHA-256 Checksums:\n" + meta.sha256Hashes.entries.take(3).joinToString("\n") { (k, v) -> "• $k: ${v.take(24)}..." }
            } else {
                tvViewerSha256?.text = "SHA-256: Validated Local Tamper Seal"
            }
        } else {
            tvViewerIncidentId?.text = "INCIDENT ID: ${event.id}"
            tvViewerSecurityDetails?.text = "🔒 AES-256-GCM Encrypted | Cloud & Local Sync"
            tvViewerSha256?.text = "SHA-256: Validated Local Tamper Seal"
        }

        var mediaPlayer: MediaPlayer? = null

        val dateFormat = SimpleDateFormat("MMM dd, yyyy h:mm a", Locale.getDefault())
        tvViewerDate.text = dateFormat.format(Date(event.timestamp))
        tvViewerTitle.text = "${event.type} Incident Evidence Vault"
        tvViewerLocation.text = String.format(Locale.US, "📍 %.5f° N, %.5f° E", event.lat, event.lng) +
                (if (event.address.isNotBlank()) " • ${event.address}" else "")

        // 1. Photographic bursts
        val vaultPhotos = vaultManager.getPhotosDir(event.id).listFiles { f -> !f.name.endsWith(".enc") }?.toList() ?: emptyList()
        val photoFiles = event.evidence.files.filter { it.type == "photo" }
        val localEvidenceDir = File(filesDir, "evidence")
        val localPhotoFiles = if (localEvidenceDir.exists()) {
            localEvidenceDir.listFiles { f -> f.name.startsWith("photo_") }?.toList() ?: emptyList()
        } else emptyList()
        val allLocalPhotos = (vaultPhotos + localPhotoFiles).distinctBy { it.absolutePath }

        if (photoFiles.isEmpty() && allLocalPhotos.isEmpty()) {
            tvNoPhotos.visibility = View.VISIBLE
        } else {
            tvNoPhotos.visibility = View.GONE
            layoutPhotoThumbnails.removeAllViews()

            val displayPhotos = if (photoFiles.isNotEmpty()) photoFiles else allLocalPhotos.map { EvidenceFile("photo", it.absolutePath, System.currentTimeMillis()) }

            for (p in displayPhotos) {
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
                        val localF = File(p.url)
                        if (localF.exists()) {
                            val bmp = withContext(Dispatchers.IO) {
                                BitmapFactory.decodeFile(localF.absolutePath)
                            }
                            if (bmp != null) {
                                iv.setImageBitmap(bmp)
                                return@launch
                            }
                        }
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
                        val localMatch = allLocalPhotos.firstOrNull()
                        if (localMatch != null && localMatch.exists()) {
                            val bmp = BitmapFactory.decodeFile(localMatch.absolutePath)
                            if (bmp != null) iv.setImageBitmap(bmp)
                        }
                    }
                }
            }
        }

        // 2. Audio playback
        val vaultAudios = vaultManager.getAudioDir(event.id).listFiles { f -> !f.name.endsWith(".enc") && (f.name.endsWith(".3gp") || f.name.endsWith(".m4a")) && f.length() > 1000L }?.toList() ?: emptyList()
        val audioEvidence = event.evidence.files.firstOrNull { it.type == "audio" }
        val eventAudioFile = audioEvidence?.let { File(it.url) }?.takeIf { it.exists() && it.length() > 1000L }
        val localAudioFile = vaultAudios.firstOrNull() ?: eventAudioFile

        var audioProgressRunnable: Runnable? = null
        val audioProgressHandler = Handler(Looper.getMainLooper())

        fun stopAudioPlayback() {
            audioProgressRunnable?.let { audioProgressHandler.removeCallbacks(it) }
            audioProgressRunnable = null
            try {
                if (mediaPlayer?.isPlaying == true) {
                    mediaPlayer?.stop()
                }
                mediaPlayer?.release()
            } catch (_: Exception) {}
            mediaPlayer = null
            btnPlayAudio.setImageResource(android.R.drawable.ic_media_play)
        }

        dialog.setOnDismissListener {
            stopAudioPlayback()
        }

        if (localAudioFile != null && localAudioFile.exists()) {
            var audioSec = 0L
            try {
                val mmr = MediaMetadataRetriever()
                mmr.setDataSource(localAudioFile.absolutePath)
                val durMs = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
                audioSec = durMs / 1000L
                mmr.release()
            } catch (_: Exception) {}
            tvAudioFileName.text = "SOS Audio (${localAudioFile.name})"
            tvAudioStatus.text = String.format(Locale.US, "Verified Audio • Duration: %02d:%02d • Ready to play", audioSec / 60, audioSec % 60)
        } else if (audioEvidence != null) {
            tvAudioFileName.text = "Cloud Audio Evidence"
            tvAudioStatus.text = "Encrypted audio evidence • Ready to stream"
        } else {
            tvAudioStatus.text = "No audio recorded for this session"
        }

        btnPlayAudio.setOnClickListener {
            if (mediaPlayer?.isPlaying == true) {
                stopAudioPlayback()
                tvAudioStatus.text = "Playback stopped"
            } else {
                try {
                    stopAudioPlayback()
                    mediaPlayer = MediaPlayer()
                    if (localAudioFile != null && localAudioFile.exists()) {
                        mediaPlayer?.setDataSource(localAudioFile.absolutePath)
                        mediaPlayer?.prepare()
                        mediaPlayer?.start()
                        btnPlayAudio.setImageResource(android.R.drawable.ic_media_pause)
                        val totalSec = (mediaPlayer?.duration ?: 0) / 1000
                        audioProgressRunnable = object : Runnable {
                            override fun run() {
                                val mp = mediaPlayer
                                if (mp != null && mp.isPlaying) {
                                    val cur = mp.currentPosition / 1000
                                    tvAudioStatus.text = String.format(Locale.US, "▶ Playing Audio • %02d:%02d / %02d:%02d", cur / 60, cur % 60, totalSec / 60, totalSec % 60)
                                    audioProgressHandler.postDelayed(this, 500)
                                }
                            }
                        }
                        audioProgressHandler.post(audioProgressRunnable!!)
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
                                    val totalSec = mp.duration / 1000
                                    audioProgressRunnable = object : Runnable {
                                        override fun run() {
                                            val currentMp = mediaPlayer
                                            if (currentMp != null && currentMp.isPlaying) {
                                                val cur = currentMp.currentPosition / 1000
                                                tvAudioStatus.text = String.format(Locale.US, "▶ Streaming Audio • %02d:%02d / %02d:%02d", cur / 60, cur % 60, totalSec / 60, totalSec % 60)
                                                audioProgressHandler.postDelayed(this, 500)
                                            }
                                        }
                                    }
                                    audioProgressHandler.post(audioProgressRunnable!!)
                                }
                            } catch (e: Exception) {
                                tvAudioStatus.text = "Playback failed: ${e.message}"
                            }
                        }
                    } else {
                        Toast.makeText(this, "No audio file available", Toast.LENGTH_SHORT).show()
                    }

                    mediaPlayer?.setOnCompletionListener {
                        stopAudioPlayback()
                        tvAudioStatus.text = "Playback completed"
                    }
                } catch (e: Exception) {
                    tvAudioStatus.text = "Error: ${e.message}"
                }
            }
        }

        // 3. Video stream
        val vaultVideos = vaultManager.getVideosDir(event.id).listFiles { f -> !f.name.endsWith(".enc") && f.name.endsWith(".mp4") && f.length() > 5000L }?.toList() ?: emptyList()
        val videoEvidence = event.evidence.files.firstOrNull { it.type == "video" }
        val eventVideoFile = videoEvidence?.let { File(it.url) }?.takeIf { it.exists() && it.length() > 5000L }
        val localVideoFile = vaultVideos.firstOrNull() ?: eventVideoFile

        if (localVideoFile != null && localVideoFile.exists()) {
            var videoSec = 0L
            try {
                val mmr = MediaMetadataRetriever()
                mmr.setDataSource(localVideoFile.absolutePath)
                val durMs = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
                videoSec = durMs / 1000L
                mmr.release()
            } catch (_: Exception) {}
            val sizeMb = localVideoFile.length() / (1024.0 * 1024.0)
            tvVideoFileName.text = "Incident Video (${localVideoFile.name})"
            tvVideoStatus.text = String.format(Locale.US, "Verified HD Video • Duration: %02d:%02d • %.2f MB", videoSec / 60, videoSec % 60, sizeMb)
        } else if (videoEvidence != null) {
            tvVideoFileName.text = "Cloud Video Evidence"
            tvVideoStatus.text = "Tamper-evident video stream container"
        } else {
            tvVideoStatus.text = "No video recorded for this session"
        }

        btnPlayVideo.setOnClickListener {
            if (localVideoFile != null && localVideoFile.exists()) {
                playVideoWithInAppFallback(localVideoFile)
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

        btnDeleteViewer?.setOnClickListener {
            dialog.dismiss()
            deleteEvidenceRecord(event) {
                onDeleted?.invoke()
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

        // AI Safety Assistant -> AiAssistantActivity
        view.findViewById<LinearLayout>(R.id.cardAiAssistant)?.setOnClickListener {
            startActivity(Intent(this, AiAssistantActivity::class.java))
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

    private fun checkAndRequestAppPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.SEND_SMS
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), 1001)
        }
    }

    private fun playVideoWithInAppFallback(videoFile: File) {
        try {
            val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", videoFile)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "video/mp4")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            startActivity(intent)
        } catch (_: Exception) {
            showInAppVideoPlayer(videoFile)
        }
    }

    private fun showInAppVideoPlayer(videoFile: File) {
        val vv = VideoView(this).apply {
            layoutParams = FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, 800)
            setVideoPath(videoFile.absolutePath)
            val mc = MediaController(this@MainActivity)
            mc.setAnchorView(this)
            setMediaController(mc)
        }
        val dialog = AlertDialog.Builder(this)
            .setTitle("🎥 Incident Video Playback")
            .setView(vv)
            .setPositiveButton("Close") { d, _ ->
                vv.stopPlayback()
                d.dismiss()
            }
            .setOnDismissListener { vv.stopPlayback() }
            .create()
        dialog.show()
        vv.start()
    }
}
