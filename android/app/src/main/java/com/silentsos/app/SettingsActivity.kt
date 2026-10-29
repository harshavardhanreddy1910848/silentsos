package com.silentsos.app

import android.content.Intent
import android.os.Bundle
import android.widget.EditText
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import com.google.android.material.textfield.TextInputEditText

class SettingsActivity : AppCompatActivity() {

    private lateinit var sessionManager: SessionManager

    private lateinit var btnBackSettings: ImageButton
    private lateinit var etSafetyPin: TextInputEditText
    private lateinit var btnUpdatePin: AppCompatButton
    private lateinit var etMessageTemplate: EditText
    private lateinit var btnSaveTemplate: AppCompatButton
    private lateinit var tvProfileName: TextView
    private lateinit var tvProfileEmail: TextView
    private lateinit var btnLogout: AppCompatButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        sessionManager = SessionManager(this)

        btnBackSettings = findViewById(R.id.btnBackSettings)
        etSafetyPin = findViewById(R.id.etSafetyPin)
        btnUpdatePin = findViewById(R.id.btnUpdatePin)
        etMessageTemplate = findViewById(R.id.etMessageTemplate)
        btnSaveTemplate = findViewById(R.id.btnSaveTemplate)
        tvProfileName = findViewById(R.id.tvProfileName)
        tvProfileEmail = findViewById(R.id.tvProfileEmail)
        btnLogout = findViewById(R.id.btnLogout)

        btnBackSettings.setOnClickListener { finish() }

        val user = sessionManager.currentUser
        tvProfileName.text = user?.name ?: "User"
        tvProfileEmail.text = user?.email ?: "user@silentsos.org"

        etSafetyPin.setText(sessionManager.safetyPin)
        etMessageTemplate.setText(sessionManager.messageTemplate)

        btnUpdatePin.setOnClickListener {
            val newPin = etSafetyPin.text.toString().trim()
            if (newPin.length in 4..6) {
                sessionManager.safetyPin = newPin
                Toast.makeText(this, "Safety PIN updated to $newPin", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "PIN must be between 4 and 6 digits", Toast.LENGTH_SHORT).show()
            }
        }

        btnSaveTemplate.setOnClickListener {
            val template = etMessageTemplate.text.toString().trim()
            if (template.isNotBlank()) {
                sessionManager.messageTemplate = template
                Toast.makeText(this, "Emergency template saved", Toast.LENGTH_SHORT).show()
            }
        }

        btnLogout.setOnClickListener {
            sessionManager.logout()
            Toast.makeText(this, "Logged out of SilentSOS", Toast.LENGTH_SHORT).show()
            val intent = Intent(this, AuthActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            startActivity(intent)
            finish()
        }
    }
}
