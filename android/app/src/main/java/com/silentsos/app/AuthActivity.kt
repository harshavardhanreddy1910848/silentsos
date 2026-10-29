package com.silentsos.app

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import kotlinx.coroutines.launch

class AuthActivity : AppCompatActivity() {

    private lateinit var sessionManager: SessionManager
    private lateinit var apiClient: ApiClient

    private lateinit var btnTabLogin: AppCompatButton
    private lateinit var btnTabRegister: AppCompatButton
    private lateinit var layoutName: TextInputLayout
    private lateinit var etName: TextInputEditText
    private lateinit var etEmail: TextInputEditText
    private lateinit var etPassword: TextInputEditText
    private lateinit var btnSubmitAuth: AppCompatButton
    private lateinit var tvAuthError: TextView
    private lateinit var pbAuthLoading: ProgressBar
    private lateinit var tvDemoBypass: TextView

    private var isRegisterMode = false

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        sessionManager = SessionManager(this)
        apiClient = ApiClient(this)

        // Check if already authenticated
        if (sessionManager.isLoggedIn) {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_auth)
        initViews()
    }

    private fun initViews() {
        btnTabLogin = findViewById(R.id.btnTabLogin)
        btnTabRegister = findViewById(R.id.btnTabRegister)
        layoutName = findViewById(R.id.layoutName)
        etName = findViewById(R.id.etName)
        etEmail = findViewById(R.id.etEmail)
        etPassword = findViewById(R.id.etPassword)
        btnSubmitAuth = findViewById(R.id.btnSubmitAuth)
        tvAuthError = findViewById(R.id.tvAuthError)
        pbAuthLoading = findViewById(R.id.pbAuthLoading)
        tvDemoBypass = findViewById(R.id.tvDemoBypass)

        btnTabLogin.setOnClickListener { setMode(false) }
        btnTabRegister.setOnClickListener { setMode(true) }

        btnSubmitAuth.setOnClickListener { handleAuthSubmit() }

        tvDemoBypass.setOnClickListener {
            // Quick local demo bypass
            sessionManager.authToken = "demo_jwt_token_${System.currentTimeMillis()}"
            sessionManager.currentUser = User("demo_1", "Demo User", "demo@silentsos.org")
            Toast.makeText(this, "Quick-started in local demo mode", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }

    private fun setMode(register: Boolean) {
        isRegisterMode = register
        tvAuthError.visibility = View.GONE

        if (register) {
            btnTabRegister.setBackgroundResource(R.drawable.bg_retry_button)
            btnTabRegister.setTextColor(getColor(R.color.white))
            btnTabLogin.setBackgroundColor(getColor(android.R.color.transparent))
            btnTabLogin.setTextColor(getColor(R.color.text_secondary))
            layoutName.visibility = View.VISIBLE
            btnSubmitAuth.text = "Create Account"
        } else {
            btnTabLogin.setBackgroundResource(R.drawable.bg_retry_button)
            btnTabLogin.setTextColor(getColor(R.color.white))
            btnTabRegister.setBackgroundColor(getColor(android.R.color.transparent))
            btnTabRegister.setTextColor(getColor(R.color.text_secondary))
            layoutName.visibility = View.GONE
            btnSubmitAuth.text = "Sign In"
        }
    }

    private fun handleAuthSubmit() {
        val email = etEmail.text.toString().trim()
        val pass = etPassword.text.toString()
        val name = etName.text.toString().trim()

        tvAuthError.visibility = View.GONE

        if (isRegisterMode && name.isEmpty()) {
            showError("Please enter your full name.")
            return
        }
        if (email.isEmpty() || !email.contains("@")) {
            showError("Please enter a valid email address.")
            return
        }
        if (pass.length < 6) {
            showError("Password must be at least 6 characters.")
            return
        }

        setLoading(true)

        lifecycleScope.launch {
            val result = if (isRegisterMode) {
                apiClient.register(name, email, pass)
            } else {
                apiClient.login(email, pass)
            }

            setLoading(false)

            result.onSuccess {
                Toast.makeText(this@AuthActivity, "Welcome to SilentSOS, ${it.name}!", Toast.LENGTH_SHORT).show()
                startActivity(Intent(this@AuthActivity, MainActivity::class.java))
                finish()
            }.onFailure { err ->
                showError(err.message ?: "Authentication failed. Check your network or credentials.")
            }
        }
    }

    private fun showError(msg: String) {
        tvAuthError.text = msg
        tvAuthError.visibility = View.VISIBLE
    }

    private fun setLoading(loading: Boolean) {
        pbAuthLoading.visibility = if (loading) View.VISIBLE else View.GONE
        btnSubmitAuth.isEnabled = !loading
        btnSubmitAuth.alpha = if (loading) 0.6f else 1.0f
    }
}
