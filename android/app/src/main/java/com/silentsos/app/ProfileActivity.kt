package com.silentsos.app

import android.os.Bundle
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class ProfileActivity : AppCompatActivity() {

    private lateinit var sessionManager: SessionManager
    private lateinit var apiClient: ApiClient

    private lateinit var etProfName: EditText
    private lateinit var etProfEmail: EditText
    private lateinit var etProfPhone: EditText
    private lateinit var etProfBlood: EditText
    private lateinit var etProfAddress: EditText
    private lateinit var etProfMother: EditText
    private lateinit var etProfFather: EditText
    private lateinit var btnSaveProfile: AppCompatButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_profile)

        sessionManager = SessionManager(this)
        apiClient = ApiClient(this)

        initViews()
        loadData()
    }

    private fun initViews() {
        findViewById<LinearLayout>(R.id.btnProfileBack).setOnClickListener {
            finish()
        }

        etProfName = findViewById(R.id.etProfName)
        etProfEmail = findViewById(R.id.etProfEmail)
        etProfPhone = findViewById(R.id.etProfPhone)
        etProfBlood = findViewById(R.id.etProfBlood)
        etProfAddress = findViewById(R.id.etProfAddress)
        etProfMother = findViewById(R.id.etProfMother)
        etProfFather = findViewById(R.id.etProfFather)
        btnSaveProfile = findViewById(R.id.btnSaveProfile)

        btnSaveProfile.setOnClickListener {
            handleSave()
        }
    }

    private fun loadData() {
        val p = sessionManager.userProfile
        etProfName.setText(p.name)
        etProfEmail.setText(p.email)
        etProfPhone.setText(p.phone)
        etProfBlood.setText(p.bloodGroup)
        etProfAddress.setText(p.address)
        etProfMother.setText(p.motherName)
        etProfFather.setText(p.fatherName)
    }

    private fun handleSave() {
        val name = etProfName.text.toString().trim()
        if (name.isEmpty()) {
            Toast.makeText(this, "Please enter your full name", Toast.LENGTH_SHORT).show()
            return
        }

        val updated = sessionManager.userProfile.copy(
            name = name,
            email = etProfEmail.text.toString().trim(),
            phone = etProfPhone.text.toString().trim(),
            bloodGroup = etProfBlood.text.toString().trim(),
            address = etProfAddress.text.toString().trim(),
            motherName = etProfMother.text.toString().trim(),
            fatherName = etProfFather.text.toString().trim()
        )

        sessionManager.userProfile = updated
        lifecycleScope.launch {
            apiClient.updateUserProfile(updated)
            Toast.makeText(this@ProfileActivity, "Profile updated successfully!", Toast.LENGTH_SHORT).show()
            finish()
        }
    }
}
