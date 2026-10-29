package com.silentsos.app

import org.json.JSONArray
import org.json.JSONObject

data class UserProfile(
    val id: String = "",
    val name: String = "",
    val email: String = "",
    val phone: String = "",
    val profileImage: String = "",
    val bloodGroup: String = "",
    val address: String = "",
    val motherName: String = "",
    val fatherName: String = "",
    val role: String = "user",
    val isSetupComplete: Boolean = false
) {
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("id", id)
            put("name", name)
            put("email", email)
            put("phone", phone)
            put("profileImage", profileImage)
            put("bloodGroup", bloodGroup)
            put("address", address)
            put("motherName", motherName)
            put("fatherName", fatherName)
            put("role", role)
            put("isSetupComplete", isSetupComplete)
        }
    }

    companion object {
        fun fromJson(json: JSONObject): UserProfile {
            return UserProfile(
                id = json.optString("id", ""),
                name = json.optString("name", "User"),
                email = json.optString("email", ""),
                phone = json.optString("phone", ""),
                profileImage = json.optString("profileImage", ""),
                bloodGroup = json.optString("bloodGroup", ""),
                address = json.optString("address", ""),
                motherName = json.optString("motherName", ""),
                fatherName = json.optString("fatherName", ""),
                role = json.optString("role", "user"),
                isSetupComplete = json.optBoolean("isSetupComplete", false)
            )
        }
    }
}

// User class kept for backwards compatibility with existing methods
data class User(
    val id: String,
    val name: String,
    val email: String,
    val role: String = "user"
) {
    companion object {
        fun fromJson(json: JSONObject): User {
            return User(
                id = json.optString("id", ""),
                name = json.optString("name", "User"),
                email = json.optString("email", ""),
                role = json.optString("role", "user")
            )
        }
    }
}

data class ContactPreferences(
    val gps: Boolean = true,
    val photos: Boolean = true,
    val video: Boolean = true,
    val audio: Boolean = true,
    val message: Boolean = true
) {
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("gps", gps)
            put("photos", photos)
            put("video", video)
            put("audio", audio)
            put("message", message)
        }
    }

    companion object {
        fun fromJson(json: JSONObject?): ContactPreferences {
            if (json == null) return ContactPreferences()
            return ContactPreferences(
                gps = json.optBoolean("gps", true),
                photos = json.optBoolean("photos", true),
                video = json.optBoolean("video", true),
                audio = json.optBoolean("audio", true),
                message = json.optBoolean("message", true)
            )
        }
    }
}

data class Contact(
    val id: String,
    val name: String,
    val phone: String,
    val email: String,
    val relationship: String = "Family",
    val isPrimary: Boolean = false,
    val preferences: ContactPreferences = ContactPreferences()
) {
    val notifySms: Boolean get() = preferences.message
    val notifyWhatsapp: Boolean get() = preferences.message

    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("id", id)
            put("name", name)
            put("phone", phone)
            put("email", email)
            put("relationship", relationship)
            put("isPrimary", isPrimary)
            put("preferences", preferences.toJson())
        }
    }

    companion object {
        fun fromJson(json: JSONObject): Contact {
            return Contact(
                id = json.optString("id", System.currentTimeMillis().toString()),
                name = json.optString("name", ""),
                phone = json.optString("phone", ""),
                email = json.optString("email", ""),
                relationship = json.optString("relationship", "Family"),
                isPrimary = json.optBoolean("isPrimary", false),
                preferences = ContactPreferences.fromJson(json.optJSONObject("preferences"))
            )
        }
    }
}

data class Settings(
    val gestureSensitivity: String = "Medium",
    val autoRepeatInterval: Int = 5,
    val photoBurstCount: Int = 5,
    val videoDuration: String = "1min",
    val audioQuality: String = "high",
    val cameraPreference: String = "both",
    val fakeCallDisguise: Boolean = false,
    val stealthMode: Boolean = false,
    val messageTemplate: String = "🚨 EMERGENCY ALERT — SilentSOS\nFrom: {name}\nTime: {time}\nType: {type}\n\n📍 GPS Location: {gps_link}\n\n⚠️ Please respond immediately or call emergency services. Updates every 5 minutes until you acknowledge.",
    val safetyPin: String = "1234",
    val autoDeleteDays: Int = 30
) {
    fun toJson(): JSONObject {
        return JSONObject().apply {
            put("gestureSensitivity", gestureSensitivity)
            put("autoRepeatInterval", autoRepeatInterval)
            put("photoBurstCount", photoBurstCount)
            put("videoDuration", videoDuration)
            put("audioQuality", audioQuality)
            put("cameraPreference", cameraPreference)
            put("fakeCallDisguise", fakeCallDisguise)
            put("stealthMode", stealthMode)
            put("messageTemplate", messageTemplate)
            put("safetyPin", safetyPin)
            put("autoDeleteDays", autoDeleteDays)
        }
    }

    companion object {
        fun fromJson(json: JSONObject?): Settings {
            if (json == null) return Settings()
            return Settings(
                gestureSensitivity = json.optString("gestureSensitivity", "Medium"),
                autoRepeatInterval = json.optInt("autoRepeatInterval", 5),
                photoBurstCount = json.optInt("photoBurstCount", 5),
                videoDuration = json.optString("videoDuration", "1min"),
                audioQuality = json.optString("audioQuality", "high"),
                cameraPreference = json.optString("cameraPreference", "both"),
                fakeCallDisguise = json.optBoolean("fakeCallDisguise", false),
                stealthMode = json.optBoolean("stealthMode", false),
                messageTemplate = json.optString(
                    "messageTemplate",
                    "🚨 EMERGENCY ALERT — SilentSOS\nFrom: {name}\nTime: {time}\nType: {type}\n\n📍 GPS Location: {gps_link}\n\n⚠️ Please respond immediately or call emergency services."
                ),
                safetyPin = json.optString("safetyPin", "1234"),
                autoDeleteDays = json.optInt("autoDeleteDays", 30)
            )
        }
    }
}

data class EvidenceFile(
    val type: String, // 'photo' | 'video' | 'audio'
    val url: String,
    val timestamp: Long = System.currentTimeMillis()
)

data class EvidenceSummary(
    val photos: Int = 0,
    val videos: Int = 0,
    val audio: Int = 0,
    val files: List<EvidenceFile> = emptyList()
)

data class ContactNotifiedStatus(
    val contactId: String,
    val name: String = "",
    val status: String = "Sent"
)

data class GpsBreadcrumb(
    val lat: Double,
    val lng: Double,
    val timestamp: Long = System.currentTimeMillis()
)

data class AlertEvent(
    val id: String,
    val timestamp: Long,
    val type: String = "General",
    val durationSeconds: Int = 0,
    val status: String = "Sent",
    val evidence: EvidenceSummary = EvidenceSummary(),
    val contactsNotified: List<ContactNotifiedStatus> = emptyList(),
    val gpsPath: List<GpsBreadcrumb> = emptyList(),
    val lat: Double = 0.0,
    val lng: Double = 0.0,
    val address: String = ""
) {
    companion object {
        fun fromJson(json: JSONObject): AlertEvent {
            val id = json.optString("id", System.currentTimeMillis().toString())
            val ts = json.optLong("timestamp", System.currentTimeMillis())
            val type = json.optString("type", "Emergency")
            val duration = json.optInt("durationSeconds", 0)
            val status = json.optString("status", "Sent")

            // Evidence parsing
            val evObj = json.optJSONObject("evidence")
            val photosCount = evObj?.optInt("photos", 0) ?: 0
            val videosCount = evObj?.optInt("videos", 0) ?: 0
            val audioCount = evObj?.optInt("audio", 0) ?: 0
            val filesList = mutableListOf<EvidenceFile>()
            val filesArr = evObj?.optJSONArray("files")
            if (filesArr != null) {
                for (i in 0 until filesArr.length()) {
                    val f = filesArr.optJSONObject(i) ?: continue
                    filesList.add(
                        EvidenceFile(
                            type = f.optString("type", "photo"),
                            url = f.optString("url", ""),
                            timestamp = f.optLong("timestamp", ts)
                        )
                    )
                }
            }
            val evidenceSummary = EvidenceSummary(photosCount, videosCount, audioCount, filesList)

            // Contacts notified
            val contactsList = mutableListOf<ContactNotifiedStatus>()
            val cArr = json.optJSONArray("contactsNotified")
            if (cArr != null) {
                for (i in 0 until cArr.length()) {
                    val c = cArr.optJSONObject(i) ?: continue
                    contactsList.add(
                        ContactNotifiedStatus(
                            contactId = c.optString("contactId", ""),
                            name = c.optString("name", "Contact"),
                            status = c.optString("status", "Sent")
                        )
                    )
                }
            }

            // GPS path
            val gpsList = mutableListOf<GpsBreadcrumb>()
            val gArr = json.optJSONArray("gpsPath")
            if (gArr != null) {
                for (i in 0 until gArr.length()) {
                    val g = gArr.optJSONObject(i) ?: continue
                    gpsList.add(
                        GpsBreadcrumb(
                            lat = g.optDouble("lat", 0.0),
                            lng = g.optDouble("lng", 0.0),
                            timestamp = g.optLong("timestamp", ts)
                        )
                    )
                }
            }

            // Fallback lat/lng from location object or first GPS crumb
            val locObj = json.optJSONObject("location")
            val lat = locObj?.optDouble("lat", gpsList.firstOrNull()?.lat ?: 0.0) ?: (gpsList.firstOrNull()?.lat ?: 0.0)
            val lng = locObj?.optDouble("lng", gpsList.firstOrNull()?.lng ?: 0.0) ?: (gpsList.firstOrNull()?.lng ?: 0.0)
            val address = locObj?.optString("address", "") ?: ""

            return AlertEvent(
                id = id,
                timestamp = ts,
                type = type,
                durationSeconds = duration,
                status = status,
                evidence = evidenceSummary,
                contactsNotified = contactsList,
                gpsPath = gpsList,
                lat = lat,
                lng = lng,
                address = address
            )
        }
    }
}
