package com.silentsos.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.telephony.SmsManager
import android.widget.Toast

object EmergencyDispatcher {

    fun dispatchAllEmergencyChannels(
        context: Context,
        contacts: List<Contact>,
        lat: Double,
        lng: Double,
        alertId: String
    ): Int {
        val session = SessionManager(context)
        val userName = session.currentUser?.name ?: "Someone"
        val mapsLink = "https://maps.google.com/?q=$lat,$lng"
        val liveReceiverLink = "${BuildConfig.SILENTSOS_WEB_URL}/receiver/$alertId"

        val rawTemplate = session.messageTemplate
        val message = rawTemplate
            .replace("{name}", userName)
            .replace("{gps_link}", "$mapsLink\nLive Tracking: $liveReceiverLink")

        var smsCount = 0

        // 1. Dispatch Native SMS to all emergency contacts with SMS preference
        for (contact in contacts) {
            if (contact.notifySms && contact.phone.isNotBlank()) {
                val cleanPhone = contact.phone.replace("[^0-9+]".toRegex(), "")
                if (cleanPhone.length >= 3) {
                    val sent = sendDirectSms(context, cleanPhone, message)
                    if (sent) smsCount++
                }
            }
        }

        // 2. Trigger Distress Vibration Pulse (SOS in Morse Code: ... --- ...)
        triggerSosVibration(context)

        return smsCount
    }

    fun sendDirectSms(context: Context, phoneNumber: String, message: String): Boolean {
        return try {
            val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                context.getSystemService(SmsManager::class.java)
            } else {
                @Suppress("DEPRECATION")
                SmsManager.getDefault()
            }

            val parts = smsManager.divideMessage(message)
            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
            true
        } catch (e: Exception) {
            false
        }
    }

    fun launchWhatsAppBroadcast(context: Context, phoneNumber: String, message: String) {
        try {
            val cleanPhone = phoneNumber.replace("[^0-9]".toRegex(), "")
            val uri = Uri.parse("https://api.whatsapp.com/send?phone=$cleanPhone&text=${Uri.encode(message)}")
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
                setPackage("com.whatsapp")
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            // Fallback to standard browser if WhatsApp app is not installed
            try {
                val uri = Uri.parse("https://wa.me/?text=${Uri.encode(message)}")
                val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
            } catch (ex: Exception) {
                Toast.makeText(context, "WhatsApp is not available", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun dialEmergencyServices(context: Context, number: String = "112") {
        try {
            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "Could not launch phone dialer", Toast.LENGTH_SHORT).show()
        }
    }

    fun triggerSosVibration(context: Context) {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vm?.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
            } ?: return

            // SOS pattern: 3 short, 3 long, 3 short pulses
            val pattern = longArrayOf(0, 150, 100, 150, 100, 150, 250, 400, 100, 400, 100, 400, 250, 150, 100, 150, 100, 150)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(pattern, -1)
            }
        } catch (e: Exception) {
            // Vibration permission or hardware missing
        }
    }
}
