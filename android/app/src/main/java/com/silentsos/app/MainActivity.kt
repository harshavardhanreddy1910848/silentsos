package com.silentsos.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var sessionManager: SessionManager
    private lateinit var locationHelper: LocationHelper
    private lateinit var apiClient: ApiClient

    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var tvWelcomeUser: TextView
    private lateinit var tvGpsCoordinates: TextView
    private lateinit var tvGpsAccuracy: TextView
    private lateinit var tvContactCount: TextView
    private lateinit var btnTriggerSos: AppCompatButton
    private lateinit var btnSettings: ImageButton

    private lateinit var cardContacts: LinearLayout
    private lateinit var cardEvidence: LinearLayout
    private lateinit var cardHelpline: LinearLayout
    private lateinit var cardSettingsQuick: LinearLayout

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val locationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        if (locationGranted) {
            refreshLocation()
        }
    }

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

        initViews()
        requestAllPermissions()
        refreshLocation()
        syncStateWithServer()
    }

    override fun onResume() {
        super.onResume()
        updateDashboardInfo()
        refreshLocation()
    }

    private fun initViews() {
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout)
        tvWelcomeUser = findViewById(R.id.tvWelcomeUser)
        tvGpsCoordinates = findViewById(R.id.tvGpsCoordinates)
        tvGpsAccuracy = findViewById(R.id.tvGpsAccuracy)
        tvContactCount = findViewById(R.id.tvContactCount)
        btnTriggerSos = findViewById(R.id.btnTriggerSos)
        btnSettings = findViewById(R.id.btnSettings)

        cardContacts = findViewById(R.id.cardContacts)
        cardEvidence = findViewById(R.id.cardEvidence)
        cardHelpline = findViewById(R.id.cardHelpline)
        cardSettingsQuick = findViewById(R.id.cardSettingsQuick)

        updateDashboardInfo()

        // SOS Button Click -> Launch Active Emergency Activity
        btnTriggerSos.setOnClickListener {
            startActivity(Intent(this, AlertActiveActivity::class.java))
        }

        btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        cardContacts.setOnClickListener {
            startActivity(Intent(this, ContactsActivity::class.java))
        }

        cardEvidence.setOnClickListener {
            Toast.makeText(this, "Evidence sensors armed & active during SOS", Toast.LENGTH_SHORT).show()
        }

        cardHelpline.setOnClickListener {
            EmergencyDispatcher.dialEmergencyServices(this, "112")
        }

        cardSettingsQuick.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        swipeRefreshLayout.setOnRefreshListener {
            refreshLocation()
            syncStateWithServer()
        }
    }

    private fun updateDashboardInfo() {
        val user = sessionManager.currentUser
        tvWelcomeUser.text = "Hello, ${user?.name ?: "User"}"
        val contacts = sessionManager.getContacts()
        tvContactCount.text = "${contacts.size} Responders"
    }

    private fun refreshLocation() {
        locationHelper.getSingleAccurateLocation { loc ->
            runOnUiThread {
                if (loc != null) {
                    tvGpsCoordinates.text = String.format("Lat: %.5f, Lng: %.5f", loc.latitude, loc.longitude)
                    tvGpsAccuracy.text = "±${loc.accuracy.toInt()}m"
                } else {
                    tvGpsCoordinates.text = "GPS active (Locking satellites...)"
                }
                swipeRefreshLayout.isRefreshing = false
            }
        }
    }

    private fun syncStateWithServer() {
        lifecycleScope.launch {
            apiClient.fetchState()
            runOnUiThread {
                updateDashboardInfo()
                swipeRefreshLayout.isRefreshing = false
            }
        }
    }

    private fun requestAllPermissions() {
        val perms = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.SEND_SMS
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            perms.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val ungranted = perms.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (ungranted.isNotEmpty()) {
            permissionLauncher.launch(ungranted.toTypedArray())
        }
    }
}
