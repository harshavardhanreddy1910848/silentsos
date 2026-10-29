package com.silentsos.app

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class SetupPinActivity : AppCompatActivity() {

    private lateinit var sessionManager: SessionManager
    private lateinit var apiClient: ApiClient

    private lateinit var tvPinTitle: TextView
    private lateinit var tvPinSubtitle: TextView
    private lateinit var tvPinError: TextView
    private lateinit var dot1: View
    private lateinit var dot2: View
    private lateinit var dot3: View
    private lateinit var dot4: View

    private var firstPin = ""
    private var enteredPin = ""
    private var isConfirmPhase = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_setup_pin)

        sessionManager = SessionManager(this)
        apiClient = ApiClient(this)

        initViews()
    }

    private fun initViews() {
        tvPinTitle = findViewById(R.id.tvPinTitle)
        tvPinSubtitle = findViewById(R.id.tvPinSubtitle)
        tvPinError = findViewById(R.id.tvPinError)
        dot1 = findViewById(R.id.dot1)
        dot2 = findViewById(R.id.dot2)
        dot3 = findViewById(R.id.dot3)
        dot4 = findViewById(R.id.dot4)

        val keys = listOf(
            R.id.btnKey0 to "0",
            R.id.btnKey1 to "1",
            R.id.btnKey2 to "2",
            R.id.btnKey3 to "3",
            R.id.btnKey4 to "4",
            R.id.btnKey5 to "5",
            R.id.btnKey6 to "6",
            R.id.btnKey7 to "7",
            R.id.btnKey8 to "8",
            R.id.btnKey9 to "9"
        )

        for ((id, num) in keys) {
            findViewById<TextView>(id).setOnClickListener {
                onKeyPressed(num)
            }
        }

        findViewById<TextView>(R.id.btnKeyClear).setOnClickListener {
            enteredPin = ""
            updateDots()
            tvPinError.visibility = View.INVISIBLE
        }

        findViewById<TextView>(R.id.btnKeyBack).setOnClickListener {
            if (enteredPin.isNotEmpty()) {
                enteredPin = enteredPin.dropLast(1)
                updateDots()
                tvPinError.visibility = View.INVISIBLE
            }
        }
    }

    private fun onKeyPressed(num: String) {
        if (enteredPin.length < 4) {
            enteredPin += num
            updateDots()
            tvPinError.visibility = View.INVISIBLE

            if (enteredPin.length == 4) {
                if (!isConfirmPhase) {
                    firstPin = enteredPin
                    enteredPin = ""
                    isConfirmPhase = true
                    tvPinTitle.text = "Confirm Safety PIN"
                    tvPinSubtitle.text = "Re-enter your 4-digit PIN to confirm."
                    updateDots()
                } else {
                    if (enteredPin == firstPin) {
                        savePinAndProceed(enteredPin)
                    } else {
                        tvPinError.text = "PINs do not match. Please try again."
                        tvPinError.visibility = View.VISIBLE
                        enteredPin = ""
                        firstPin = ""
                        isConfirmPhase = false
                        tvPinTitle.text = "Set Your Safety PIN"
                        tvPinSubtitle.text = "Enter a secret 4-digit code to disarm alarms and protect evidence."
                        updateDots()
                    }
                }
            }
        }
    }

    private fun updateDots() {
        val dots = listOf(dot1, dot2, dot3, dot4)
        for (i in dots.indices) {
            if (i < enteredPin.length) {
                dots[i].setBackgroundResource(R.drawable.bg_auth_tab_active)
            } else {
                dots[i].setBackgroundResource(R.drawable.bg_pin_box)
            }
        }
    }

    private fun savePinAndProceed(pin: String) {
        sessionManager.safetyPin = pin
        lifecycleScope.launch {
            apiClient.updateSettings(sessionManager.settings.copy(safetyPin = pin))
            Toast.makeText(this@SetupPinActivity, "Safety PIN configured successfully!", Toast.LENGTH_SHORT).show()

            if (!sessionManager.isSetupComplete) {
                startActivity(Intent(this@SetupPinActivity, OnboardingActivity::class.java))
            } else {
                startActivity(Intent(this@SetupPinActivity, MainActivity::class.java))
            }
            finish()
        }
    }
}
