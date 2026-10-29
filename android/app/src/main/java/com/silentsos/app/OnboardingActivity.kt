package com.silentsos.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class OnboardingActivity : AppCompatActivity() {

    private lateinit var sessionManager: SessionManager
    private lateinit var apiClient: ApiClient

    private var currentStep = 1

    private lateinit var prog1: View
    private lateinit var prog2: View
    private lateinit var prog3: View
    private lateinit var prog4: View

    private lateinit var tvOnboardingStep: TextView
    private lateinit var tvOnboardingTitle: TextView
    private lateinit var tvOnboardingSubtitle: TextView

    private lateinit var containerStep1: LinearLayout
    private lateinit var containerStep2: LinearLayout
    private lateinit var containerStep3: LinearLayout
    private lateinit var containerStep4: LinearLayout

    private lateinit var etProfileName: EditText
    private lateinit var etProfileEmail: EditText
    private lateinit var etProfilePhone: EditText
    private lateinit var etProfileBlood: EditText
    private lateinit var etProfileAddress: EditText

    private lateinit var etContactName: EditText
    private lateinit var etContactPhone: EditText
    private lateinit var etContactEmail: EditText

    private lateinit var btnOnboardingAction: AppCompatButton

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        goToStep(4)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_onboarding)

        sessionManager = SessionManager(this)
        apiClient = ApiClient(this)

        initViews()
        populateExistingData()
    }

    private fun initViews() {
        prog1 = findViewById(R.id.prog1)
        prog2 = findViewById(R.id.prog2)
        prog3 = findViewById(R.id.prog3)
        prog4 = findViewById(R.id.prog4)

        tvOnboardingStep = findViewById(R.id.tvOnboardingStep)
        tvOnboardingTitle = findViewById(R.id.tvOnboardingTitle)
        tvOnboardingSubtitle = findViewById(R.id.tvOnboardingSubtitle)

        containerStep1 = findViewById(R.id.containerStep1)
        containerStep2 = findViewById(R.id.containerStep2)
        containerStep3 = findViewById(R.id.containerStep3)
        containerStep4 = findViewById(R.id.containerStep4)

        etProfileName = findViewById(R.id.etProfileName)
        etProfileEmail = findViewById(R.id.etProfileEmail)
        etProfilePhone = findViewById(R.id.etProfilePhone)
        etProfileBlood = findViewById(R.id.etProfileBlood)
        etProfileAddress = findViewById(R.id.etProfileAddress)

        etContactName = findViewById(R.id.etContactName)
        etContactPhone = findViewById(R.id.etContactPhone)
        etContactEmail = findViewById(R.id.etContactEmail)

        btnOnboardingAction = findViewById(R.id.btnOnboardingAction)

        btnOnboardingAction.setOnClickListener {
            handleNextAction()
        }
    }

    private fun populateExistingData() {
        val p = sessionManager.userProfile
        etProfileName.setText(p.name)
        etProfileEmail.setText(p.email)
        etProfilePhone.setText(p.phone)
        etProfileBlood.setText(p.bloodGroup)
        etProfileAddress.setText(p.address)
    }

    private fun handleNextAction() {
        when (currentStep) {
            1 -> {
                val name = etProfileName.text.toString().trim()
                if (name.isEmpty()) {
                    Toast.makeText(this, "Please enter your full name", Toast.LENGTH_SHORT).show()
                    return
                }
                val updatedProfile = sessionManager.userProfile.copy(
                    name = name,
                    email = etProfileEmail.text.toString().trim(),
                    phone = etProfilePhone.text.toString().trim(),
                    bloodGroup = etProfileBlood.text.toString().trim(),
                    address = etProfileAddress.text.toString().trim()
                )
                sessionManager.userProfile = updatedProfile
                lifecycleScope.launch {
                    apiClient.updateUserProfile(updatedProfile)
                }
                goToStep(2)
            }
            2 -> {
                val cName = etContactName.text.toString().trim()
                val cPhone = etContactPhone.text.toString().trim()
                val cEmail = etContactEmail.text.toString().trim()

                if (cName.isNotEmpty() && (cPhone.isNotEmpty() || cEmail.isNotEmpty())) {
                    val contact = Contact(
                        id = System.currentTimeMillis().toString(),
                        name = cName,
                        phone = cPhone,
                        email = cEmail,
                        relationship = "Family",
                        isPrimary = true
                    )
                    lifecycleScope.launch {
                        apiClient.addContact(contact)
                    }
                }
                goToStep(3)
            }
            3 -> {
                requestPermissionsStep()
            }
            4 -> {
                lifecycleScope.launch {
                    apiClient.completeSetup()
                    sessionManager.isSetupComplete = true
                    Toast.makeText(this@OnboardingActivity, "Welcome to SilentSOS!", Toast.LENGTH_SHORT).show()
                    startActivity(Intent(this@OnboardingActivity, MainActivity::class.java))
                    finish()
                }
            }
        }
    }

    private fun requestPermissionsStep() {
        val permissions = arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        )
        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            permissionLauncher.launch(permissions)
        } else {
            goToStep(4)
        }
    }

    private fun goToStep(step: Int) {
        currentStep = step
        val activeColor = android.graphics.Color.parseColor("#e11d48")
        val inactiveColor = android.graphics.Color.parseColor("#1e2230")

        prog1.setBackgroundColor(if (step >= 1) activeColor else inactiveColor)
        prog2.setBackgroundColor(if (step >= 2) activeColor else inactiveColor)
        prog3.setBackgroundColor(if (step >= 3) activeColor else inactiveColor)
        prog4.setBackgroundColor(if (step >= 4) activeColor else inactiveColor)

        containerStep1.visibility = View.GONE
        containerStep2.visibility = View.GONE
        containerStep3.visibility = View.GONE
        containerStep4.visibility = View.GONE

        when (step) {
            1 -> {
                tvOnboardingStep.text = "STEP 1 OF 4"
                tvOnboardingTitle.text = "Emergency Identity Profile"
                tvOnboardingSubtitle.text = "This medical and personal data is dispatched to responders during a distress crisis."
                containerStep1.visibility = View.VISIBLE
                btnOnboardingAction.text = "Next: Trusted Contacts"
            }
            2 -> {
                tvOnboardingStep.text = "STEP 2 OF 4"
                tvOnboardingTitle.text = "Primary Emergency Guardian"
                tvOnboardingSubtitle.text = "Add your primary guardian who will receive instant SMS & live GPS coordinates."
                containerStep2.visibility = View.VISIBLE
                btnOnboardingAction.text = "Next: Device Permissions"
            }
            3 -> {
                tvOnboardingStep.text = "STEP 3 OF 4"
                tvOnboardingTitle.text = "Hardware Permissions"
                tvOnboardingSubtitle.text = "Allow camera, mic, and GPS access so the app can gather evidence autonomously."
                containerStep3.visibility = View.VISIBLE
                btnOnboardingAction.text = "Grant Permissions & Arm System"
            }
            4 -> {
                tvOnboardingStep.text = "SYSTEM READY"
                tvOnboardingTitle.text = "Personal Defense Console Armed"
                tvOnboardingSubtitle.text = "All systems operational with live GPS tracking, background evidence recording, and rapid dispatch."
                containerStep4.visibility = View.VISIBLE
                btnOnboardingAction.text = "Launch SilentSOS Console"
            }
        }
    }
}

