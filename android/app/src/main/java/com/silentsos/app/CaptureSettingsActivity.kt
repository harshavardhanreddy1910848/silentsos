package com.silentsos.app

import android.os.Bundle
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class CaptureSettingsActivity : AppCompatActivity() {

    private lateinit var sessionManager: SessionManager
    private lateinit var apiClient: ApiClient

    private var selectedBurstCount = 5
    private var selectedVideoDuration = "1min"

    private lateinit var btnBurst3: TextView
    private lateinit var btnBurst5: TextView
    private lateinit var btnBurst10: TextView

    private lateinit var btnVid30s: TextView
    private lateinit var btnVid1m: TextView
    private lateinit var btnVidCont: TextView

    private lateinit var etMessageTemplate: EditText
    private lateinit var btnSaveCaptureSettings: AppCompatButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_capture_settings)

        sessionManager = SessionManager(this)
        apiClient = ApiClient(this)

        initViews()
        loadData()
    }

    private fun initViews() {
        findViewById<LinearLayout>(R.id.btnCaptureBack).setOnClickListener {
            finish()
        }

        btnBurst3 = findViewById(R.id.btnBurst3)
        btnBurst5 = findViewById(R.id.btnBurst5)
        btnBurst10 = findViewById(R.id.btnBurst10)

        btnVid30s = findViewById(R.id.btnVid30s)
        btnVid1m = findViewById(R.id.btnVid1m)
        btnVidCont = findViewById(R.id.btnVidCont)

        etMessageTemplate = findViewById(R.id.etMessageTemplate)
        btnSaveCaptureSettings = findViewById(R.id.btnSaveCaptureSettings)

        btnBurst3.setOnClickListener { setBurst(3) }
        btnBurst5.setOnClickListener { setBurst(5) }
        btnBurst10.setOnClickListener { setBurst(10) }

        btnVid30s.setOnClickListener { setVideo("30s") }
        btnVid1m.setOnClickListener { setVideo("1min") }
        btnVidCont.setOnClickListener { setVideo("continuous") }

        btnSaveCaptureSettings.setOnClickListener {
            handleSave()
        }
    }

    private fun loadData() {
        val s = sessionManager.settings
        setBurst(s.photoBurstCount)
        setVideo(s.videoDuration)
        etMessageTemplate.setText(s.messageTemplate)
    }

    private fun setBurst(count: Int) {
        selectedBurstCount = count
        btnBurst3.setBackgroundResource(if (count == 3) R.drawable.bg_auth_tab_active else R.drawable.bg_card_surface)
        btnBurst3.setTextColor(getColor(if (count == 3) R.color.white else R.color.text_secondary))

        btnBurst5.setBackgroundResource(if (count == 5) R.drawable.bg_auth_tab_active else R.drawable.bg_card_surface)
        btnBurst5.setTextColor(getColor(if (count == 5) R.color.white else R.color.text_secondary))

        btnBurst10.setBackgroundResource(if (count == 10) R.drawable.bg_auth_tab_active else R.drawable.bg_card_surface)
        btnBurst10.setTextColor(getColor(if (count == 10) R.color.white else R.color.text_secondary))
    }

    private fun setVideo(duration: String) {
        selectedVideoDuration = duration
        btnVid30s.setBackgroundResource(if (duration == "30s") R.drawable.bg_auth_tab_active else R.drawable.bg_card_surface)
        btnVid30s.setTextColor(getColor(if (duration == "30s") R.color.white else R.color.text_secondary))

        btnVid1m.setBackgroundResource(if (duration == "1min") R.drawable.bg_auth_tab_active else R.drawable.bg_card_surface)
        btnVid1m.setTextColor(getColor(if (duration == "1min") R.color.white else R.color.text_secondary))

        btnVidCont.setBackgroundResource(if (duration == "continuous") R.drawable.bg_auth_tab_active else R.drawable.bg_card_surface)
        btnVidCont.setTextColor(getColor(if (duration == "continuous") R.color.white else R.color.text_secondary))
    }

    private fun handleSave() {
        val tmpl = etMessageTemplate.text.toString().trim()
        val updated = sessionManager.settings.copy(
            photoBurstCount = selectedBurstCount,
            videoDuration = selectedVideoDuration,
            messageTemplate = if (tmpl.isNotEmpty()) tmpl else sessionManager.settings.messageTemplate
        )

        sessionManager.settings = updated
        lifecycleScope.launch {
            apiClient.updateSettings(updated)
            Toast.makeText(this@CaptureSettingsActivity, "Surveillance parameters saved!", Toast.LENGTH_SHORT).show()
            finish()
        }
    }
}
