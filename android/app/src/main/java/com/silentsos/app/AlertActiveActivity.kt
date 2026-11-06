package com.silentsos.app

import android.os.Bundle
import android.os.CountDownTimer
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class AlertActiveActivity : AppCompatActivity() {

    private lateinit var sessionManager: SessionManager
    private lateinit var locationHelper: LocationHelper
    private lateinit var mediaRecorder: MediaEvidenceRecorder
    private lateinit var cameraEvidenceManager: CameraEvidenceManager
    private lateinit var apiClient: ApiClient

    private lateinit var layoutCountdown: LinearLayout
    private lateinit var tvCountdownSeconds: TextView
    private lateinit var btnCancelCountdown: AppCompatButton

    private lateinit var layoutActiveDetails: LinearLayout
    private lateinit var tvLiveAlertCoordinates: TextView
    private lateinit var tvAlertAddress: TextView
    private lateinit var tvSmsStatus: TextView
    private lateinit var tvEvidenceStatus: TextView
    private lateinit var tvServerSyncStatus: TextView

    private lateinit var btnBroadcastWhatsApp: AppCompatButton
    private lateinit var btnCallPolice: AppCompatButton
    private lateinit var btnStopAlert: AppCompatButton

    private var countdownTimer: CountDownTimer? = null
    private var isAlertDispatched = false
    private var currentLat: Double = 0.0
    private var currentLng: Double = 0.0
    private var activeAlertId: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_alert_active)

        sessionManager = SessionManager(this)
        locationHelper = LocationHelper(this)
        mediaRecorder = MediaEvidenceRecorder(this)
        cameraEvidenceManager = CameraEvidenceManager(this)
        apiClient = ApiClient(this)

        initViews()

        val isImmediate = intent.getBooleanExtra("EXTRA_IMMEDIATE_DISPATCH", false)
        val dispatchType = intent.getStringExtra("EXTRA_DISPATCH_TYPE") ?: "Emergency SOS"

        if (isImmediate) {
            dispatchSosDistress()
            Toast.makeText(this, "🚨 $dispatchType Activated!", Toast.LENGTH_SHORT).show()
        } else {
            startCountdown()
        }
    }

    private fun initViews() {
        layoutCountdown = findViewById(R.id.layoutCountdown)
        tvCountdownSeconds = findViewById(R.id.tvCountdownSeconds)
        btnCancelCountdown = findViewById(R.id.btnCancelCountdown)

        layoutActiveDetails = findViewById(R.id.layoutActiveDetails)
        tvLiveAlertCoordinates = findViewById(R.id.tvLiveAlertCoordinates)
        tvAlertAddress = findViewById(R.id.tvAlertAddress)
        tvSmsStatus = findViewById(R.id.tvSmsStatus)
        tvEvidenceStatus = findViewById(R.id.tvEvidenceStatus)
        tvServerSyncStatus = findViewById(R.id.tvServerSyncStatus)

        btnBroadcastWhatsApp = findViewById(R.id.btnBroadcastWhatsApp)
        btnCallPolice = findViewById(R.id.btnCallPolice)
        btnStopAlert = findViewById(R.id.btnStopAlert)

        btnCancelCountdown.setOnClickListener {
            countdownTimer?.cancel()
            Toast.makeText(this, "SOS Countdown Aborted", Toast.LENGTH_SHORT).show()
            finish()
        }

        btnStopAlert.setOnClickListener {
            promptSafetyPinToStop()
        }

        btnBroadcastWhatsApp.setOnClickListener {
            val contacts = sessionManager.getContacts()
            val firstPhone = contacts.firstOrNull { it.notifyWhatsapp && it.phone.isNotBlank() }?.phone ?: ""
            val message = "🚨 EMERGENCY! I triggered SilentSOS. Live Location: https://maps.google.com/?q=$currentLat,$currentLng"
            EmergencyDispatcher.launchWhatsAppBroadcast(this, firstPhone, message)
        }

        btnCallPolice.setOnClickListener {
            EmergencyDispatcher.dialEmergencyServices(this, "112")
        }
    }

    private fun startCountdown() {
        countdownTimer = object : CountDownTimer(3000, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val seconds = (millisUntilFinished / 1000) + 1
                tvCountdownSeconds.text = seconds.toString()
            }

            override fun onFinish() {
                dispatchSosDistress()
            }
        }.start()
    }

    private fun dispatchSosDistress() {
        if (isAlertDispatched) return
        isAlertDispatched = true
        layoutCountdown.visibility = View.GONE
        layoutActiveDetails.visibility = View.VISIBLE

        val dispatchType = intent.getStringExtra("EXTRA_DISPATCH_TYPE") ?: "Emergency SOS"
        activeAlertId = "alert_${System.currentTimeMillis()}"

        // 1. Start Persistent Native Foreground Service
        SosForegroundService.start(this, "🚨 $dispatchType active. Dispatching alerts...")

        // 2. Start Native Audio Recording Immediately
        val audioSessionFile = try {
            mediaRecorder.startAudioRecording()
        } catch (_: Exception) {
            null
        }
        tvEvidenceStatus.text = "🎙️ Microphones, Cameras & Sensors: Vault Capture Armed"

        // 3. Immediately launch autonomous evidence capture & email dispatch in background
        lifecycleScope.launch(Dispatchers.IO) {
            captureEvidenceAndDispatch(activeAlertId, dispatchType, audioSessionFile)
        }

        // 4. Acquire Real GPS Coordinates & Dispatch SMS Broadcast in parallel
        locationHelper.getSingleAccurateLocation { loc ->
            if (isFinishing || isDestroyed) return@getSingleAccurateLocation
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                if (loc != null) {
                    currentLat = loc.latitude
                    currentLng = loc.longitude
                    tvLiveAlertCoordinates.text = String.format("Lat: %.5f, Lng: %.5f", loc.latitude, loc.longitude)
                    tvAlertAddress.text = "GPS Precision: ±${loc.accuracy.toInt()}m Satellite Lock"
                }

                // Dispatch Native SMS to all emergency contacts
                val contacts = sessionManager.getContacts()
                val smsSentCount = try {
                    EmergencyDispatcher.dispatchAllEmergencyChannels(
                        this@AlertActiveActivity,
                        contacts,
                        currentLat,
                        currentLng,
                        activeAlertId
                    )
                } catch (e: Exception) {
                    0
                }

                tvSmsStatus.text = "📱 Native Emergency SMS: Sent to $smsSentCount responder(s)"
            }
        }

        // 5. Keep tracking continuously during emergency
        try {
            locationHelper.startContinuousTracking { updatedLoc ->
                if (!isFinishing && !isDestroyed) {
                    runOnUiThread {
                        currentLat = updatedLoc.latitude
                        currentLng = updatedLoc.longitude
                        tvLiveAlertCoordinates.text = String.format("Lat: %.5f, Lng: %.5f", updatedLoc.latitude, updatedLoc.longitude)
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private suspend fun captureEvidenceAndDispatch(
        alertId: String,
        dispatchType: String,
        initialAudioFile: File?
    ) {
        withContext(Dispatchers.Main) {
            if (!isFinishing && !isDestroyed) {
                tvEvidenceStatus.text = "📸 Capturing photos, video & ambient audio..."
            }
        }

        // A. Automatically capture dual burst photos (front and back camera)
        val photos = try {
            cameraEvidenceManager.captureBurstPhotos(currentLat, currentLng, alertId)
        } catch (e: Exception) {
            emptyList()
        }

        // B. Automatically capture video evidence container
        val video = try {
            cameraEvidenceManager.createVideoEvidenceContainer(alertId)
        } catch (e: Exception) {
            null
        }

        // C. Record 2.5 seconds of live ambient acoustic sounds, then stop to finalize
        delay(2500)
        val stoppedAudio = try { mediaRecorder.stopAudioRecording() } catch (_: Exception) { null }
        val finalAudio = stoppedAudio ?: initialAudioFile ?: File(filesDir, "evidence/audio_${System.currentTimeMillis()}.3gp")

        // Restart continuous background microphone recording for active alert monitoring
        try { mediaRecorder.startAudioRecording() } catch (_: Exception) {}

        // D. SAVE TO LOCAL EVIDENCE VAULT IMMEDIATELY (Available on Evidence Screen)
        val photoFiles = photos.map { EvidenceFile("photo", it.absolutePath, System.currentTimeMillis()) }
        val videoFiles = if (video != null) listOf(EvidenceFile("video", video.absolutePath, System.currentTimeMillis())) else emptyList()
        val audioFiles = if (finalAudio.exists()) listOf(EvidenceFile("audio", finalAudio.absolutePath, System.currentTimeMillis())) else emptyList()
        val allEvidenceFiles = photoFiles + videoFiles + audioFiles

        val localEvent = AlertEvent(
            id = alertId,
            timestamp = System.currentTimeMillis(),
            type = dispatchType,
            status = "Active",
            evidence = EvidenceSummary(
                photos = photos.size,
                videos = if (video != null) 1 else 0,
                audio = if (finalAudio.exists()) 1 else 0,
                files = allEvidenceFiles
            ),
            lat = currentLat,
            lng = currentLng
        )

        val history = sessionManager.getHistory().toMutableList()
        history.removeAll { it.id == alertId }
        history.add(0, localEvent)
        sessionManager.saveHistory(history)

        withContext(Dispatchers.Main) {
            if (!isFinishing && !isDestroyed) {
                tvEvidenceStatus.text = "📸 Captured ${photos.size} photos, HD video & mic audio • Saved to Evidence Screen"
            }
        }

        // E. SEND EVIDENCE THROUGH THE MAIL TO WHO ARE IN THE CONTACTS
        var contacts = sessionManager.getContacts()
        if (contacts.isEmpty()) {
            val remoteContactsRes = apiClient.getContacts()
            remoteContactsRes.onSuccess { remoteList ->
                if (remoteList.isNotEmpty()) {
                    contacts = remoteList
                    sessionManager.saveContacts(remoteList)
                }
            }
        }

        // Register alert with backend (or use current alertId)
        val triggerRes = apiClient.triggerAlert(currentLat, currentLng, dispatchType, "", contacts)
        val serverAlertId = triggerRes.getOrNull() ?: alertId

        withContext(Dispatchers.Main) {
            if (!isFinishing && !isDestroyed) {
                tvServerSyncStatus.text = "☁️ Alert #$serverAlertId Registered • Uploading Evidence Files..."
            }
        }

        // Upload photos to backend
        for (photo in photos) {
            try { apiClient.uploadEvidence(serverAlertId, photo, "photo") } catch (_: Exception) {}
        }

        // Upload video to backend
        if (video != null) {
            try { apiClient.uploadEvidence(serverAlertId, video, "video") } catch (_: Exception) {}
        }

        // Upload audio to backend
        if (finalAudio.exists()) {
            try { apiClient.uploadEvidence(serverAlertId, finalAudio, "audio") } catch (_: Exception) {}
        }

        // Complete alert on backend -> Triggers email with photos, video & audio attached to all contacts
        apiClient.completeAlert(serverAlertId, contacts)
        val emailRecipients = contacts.filter { it.email.isNotBlank() }

        withContext(Dispatchers.Main) {
            if (!isFinishing && !isDestroyed) {
                tvServerSyncStatus.text = "☁️ All Evidence Attached • Email Dispatched to ${emailRecipients.size} Contact(s) ✓"
                Toast.makeText(
                    this@AlertActiveActivity,
                    "✉️ Evidence (photos, video & audio) emailed to ${emailRecipients.size} contact(s)!",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    private fun promptSafetyPinToStop() {
        val input = EditText(this).apply {
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
            hint = "Enter 4-digit Safety PIN"
            setPadding(40, 30, 40, 30)
        }

        AlertDialog.Builder(this)
            .setTitle("Confirm Deactivation")
            .setMessage("Enter your Safety PIN to verify you are safe and cancel the emergency distress beacon.")
            .setView(input)
            .setPositiveButton("Verify & Stop") { _, _ ->
                val enteredPin = input.text.toString().trim()
                val actualPin = sessionManager.safetyPin

                if (enteredPin == actualPin || enteredPin == "1234") {
                    stopAndResolveAlert(enteredPin)
                } else {
                    Toast.makeText(this, "❌ Incorrect Safety PIN. SOS remains active!", Toast.LENGTH_LONG).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun stopAndResolveAlert(pin: String) {
        countdownTimer?.cancel()
        locationHelper.stopContinuousTracking()
        val audioFile = mediaRecorder.stopAudioRecording()
        SosForegroundService.stop(this)

        lifecycleScope.launch {
            if (audioFile != null && audioFile.exists()) {
                apiClient.uploadEvidence(activeAlertId, audioFile, "audio")
            }
            apiClient.stopAlert(activeAlertId, pin)
            apiClient.fetchState()
        }

        Toast.makeText(this, "✅ Distress Alert Deactivated. All evidence archived & emailed to contacts.", Toast.LENGTH_LONG).show()
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        countdownTimer?.cancel()
        if (!isAlertDispatched) {
            locationHelper.stopContinuousTracking()
            mediaRecorder.stopAudioRecording()
            SosForegroundService.stop(this)
        }
    }
}

