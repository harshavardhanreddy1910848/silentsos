package com.silentsos.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

class SosForegroundService : Service() {

    private var wakeLock: PowerManager.WakeLock? = null
    private lateinit var locationHelper: LocationHelper

    override fun onCreate() {
        super.onCreate()
        locationHelper = LocationHelper(this)
        acquireWakeLock()
    }

    @Suppress("NewApi")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        NotificationHelper.createNotificationChannel(this)
        val initialStatus = intent?.getStringExtra(EXTRA_STATUS) ?: "Broadcasting live distress signal..."
        val notification = NotificationHelper.buildEmergencyNotification(this, initialStatus)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            var serviceType = android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION or
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                serviceType = serviceType or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
            }
            try {
                startForeground(NotificationHelper.NOTIFICATION_ID, notification, serviceType)
            } catch (_: Exception) {
                try {
                    startForeground(NotificationHelper.NOTIFICATION_ID, notification)
                } catch (ex: Exception) {
                    ex.printStackTrace()
                }
            }
        } else {
            startForeground(NotificationHelper.NOTIFICATION_ID, notification)
        }

        locationHelper.startContinuousTracking { loc ->
            val updatedNotification = NotificationHelper.buildEmergencyNotification(
                this,
                "Live GPS: ${String.format(java.util.Locale.US, "%.5f, %.5f", loc.latitude, loc.longitude)} (±${loc.accuracy.toInt()}m)",
            )
            val nm = getSystemService(NOTIFICATION_SERVICE) as? android.app.NotificationManager
            nm?.notify(NotificationHelper.NOTIFICATION_ID, updatedNotification)
        }

        return START_STICKY
    }

    private fun acquireWakeLock() {
        try {
            val pm = getSystemService(POWER_SERVICE) as? PowerManager
            wakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SilentSOS:EmergencyWakeLock")
            wakeLock?.acquire(30 * 60 * 1000L) // 30 minutes safety timeout
        } catch (_: Exception) {
            // Ignored
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        locationHelper.stopContinuousTracking()
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (_: Exception) {
            // Ignored
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val EXTRA_STATUS = "extra_status"

        fun start(context: Context, status: String = "Broadcasting live distress signal...") {
            try {
                val intent = Intent(context, SosForegroundService::class.java).apply {
                    putExtra(EXTRA_STATUS, status)
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        fun stop(context: Context) {
            try {
                val intent = Intent(context, SosForegroundService::class.java)
                context.stopService(intent)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}

