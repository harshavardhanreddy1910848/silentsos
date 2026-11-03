package com.silentsos.app

import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.widget.EditText
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class AdminLoginActivity : AppCompatActivity() {

    private lateinit var apiClient: ApiClient
    private lateinit var sessionManager: SessionManager

    private lateinit var etAdminEmail: EditText
    private lateinit var etAdminPassword: EditText
    private lateinit var ivAdminTogglePassword: ImageView
    private lateinit var btnAdminSubmit: View
    private lateinit var pbAdminLoading: ProgressBar
    private lateinit var tvAdminError: TextView
    private lateinit var tvAdminBackToUser: TextView

    private var isPasswordVisible = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_admin_login)

        apiClient = ApiClient(this)
        sessionManager = SessionManager(this)

        // Check if already authenticated as admin
        if (sessionManager.isLoggedIn && sessionManager.isAdmin) {
            startActivity(Intent(this, AdminDashboardActivity::class.java))
            finish()
            return
        }

        bindViews()
        setupListeners()
    }

    private fun bindViews() {
        etAdminEmail = findViewById(R.id.etAdminEmail)
        etAdminPassword = findViewById(R.id.etAdminPassword)
        ivAdminTogglePassword = findViewById(R.id.ivAdminTogglePassword)
        btnAdminSubmit = findViewById(R.id.btnAdminSubmit)
        pbAdminLoading = findViewById(R.id.pbAdminLoading)
        tvAdminError = findViewById(R.id.tvAdminError)
        tvAdminBackToUser = findViewById(R.id.tvAdminBackToUser)
    }

    private fun setupListeners() {
        ivAdminTogglePassword.setOnClickListener {
            isPasswordVisible = !isPasswordVisible
            if (isPasswordVisible) {
                etAdminPassword.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                ivAdminTogglePassword.setImageResource(R.drawable.ic_eye_off_vector)
            } else {
                etAdminPassword.inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
                ivAdminTogglePassword.setImageResource(R.drawable.ic_eye_vector)
            }
            etAdminPassword.setSelection(etAdminPassword.text.length)
        }

        btnAdminSubmit.setOnClickListener {
            attemptAdminLogin()
        }

        tvAdminBackToUser.setOnClickListener {
            finish()
        }
    }

    private fun attemptAdminLogin() {
        val email = etAdminEmail.text.toString().trim()
        val password = etAdminPassword.text.toString().trim()

        if (email.isEmpty()) {
            showError("Please enter your administrator email address.")
            etAdminEmail.requestFocus()
            return
        }

        if (password.isEmpty()) {
            showError("Please enter your security password.")
            etAdminPassword.requestFocus()
            return
        }

        tvAdminError.visibility = View.GONE
        pbAdminLoading.visibility = View.VISIBLE
        btnAdminSubmit.isEnabled = false

        lifecycleScope.launch {
            val result = apiClient.login(email, password)
            pbAdminLoading.visibility = View.GONE
            btnAdminSubmit.isEnabled = true

            result.onSuccess { user ->
                // Check if user has administrative privileges
                if (user.role.equals("admin", ignoreCase = true) || sessionManager.isAdmin) {
                    Toast.makeText(this@AdminLoginActivity, "Welcome to SOS Administrative Portal", Toast.LENGTH_SHORT).show()
                    val intent = Intent(this@AdminLoginActivity, AdminDashboardActivity::class.java)
                    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    startActivity(intent)
                    finish()
                } else {
                    showError("Access Denied: Account '${user.email}' does not possess Administrative clearance.")
                    sessionManager.logout()
                }
            }.onFailure { err ->
                showError(err.message ?: "Invalid administrative credentials or server unreachable.")
            }
        }
    }

    private fun showError(msg: String) {
        tvAdminError.text = msg
        tvAdminError.visibility = View.VISIBLE
    }
}
