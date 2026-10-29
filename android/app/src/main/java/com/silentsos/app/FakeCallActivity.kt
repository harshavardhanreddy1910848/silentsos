package com.silentsos.app

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class FakeCallActivity : AppCompatActivity() {

    private lateinit var layoutCallActions: LinearLayout
    private lateinit var layoutInCall: LinearLayout
    private lateinit var tvCallStatus: TextView
    private lateinit var tvCallTimer: TextView

    private val handler = Handler(Looper.getMainLooper())
    private var secondsElapsed = 0
    private var isCallActive = false

    private val timerRunnable = object : Runnable {
        override fun run() {
            if (isCallActive) {
                secondsElapsed++
                val mins = secondsElapsed / 60
                val secs = secondsElapsed % 60
                tvCallTimer.text = String.format("%02d:%02d", mins, secs)
                handler.postDelayed(this, 1000)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_fake_call)

        layoutCallActions = findViewById(R.id.layoutCallActions)
        layoutInCall = findViewById(R.id.layoutInCall)
        tvCallStatus = findViewById(R.id.tvCallStatus)
        tvCallTimer = findViewById(R.id.tvCallTimer)

        findViewById<LinearLayout>(R.id.btnDeclineCall).setOnClickListener {
            finish()
        }

        findViewById<LinearLayout>(R.id.btnAcceptCall).setOnClickListener {
            isCallActive = true
            layoutCallActions.visibility = View.GONE
            layoutInCall.visibility = View.VISIBLE
            tvCallStatus.text = "Call Connected"
            handler.post(timerRunnable)
        }

        findViewById<LinearLayout>(R.id.btnEndCall).setOnClickListener {
            isCallActive = false
            handler.removeCallbacks(timerRunnable)
            finish()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isCallActive = false
        handler.removeCallbacks(timerRunnable)
    }
}
