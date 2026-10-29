package com.silentsos.app

import org.json.JSONObject

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

data class Contact(
    val id: String,
    val name: String,
    val phone: String,
    val email: String,
    val notifySms: Boolean = true,
    val notifyWhatsapp: Boolean = true
) {
    fun toJson(): JSONObject {
        val obj = JSONObject()
        obj.put("id", id)
        obj.put("name", name)
        obj.put("phone", phone)
        obj.put("email", email)
        obj.put("notifySms", notifySms)
        obj.put("notifyWhatsapp", notifyWhatsapp)
        return obj
    }

    companion object {
        fun fromJson(json: JSONObject): Contact {
            val prefs = json.optJSONObject("preferences")
            return Contact(
                id = json.optString("id", System.currentTimeMillis().toString()),
                name = json.optString("name", ""),
                phone = json.optString("phone", ""),
                email = json.optString("email", ""),
                notifySms = prefs?.optBoolean("message", true) ?: json.optBoolean("notifySms", true),
                notifyWhatsapp = prefs?.optBoolean("whatsapp", true) ?: json.optBoolean("notifyWhatsapp", true)
            )
        }
    }
}

data class AlertEvent(
    val id: String,
    val timestamp: Long,
    val status: String,
    val lat: Double,
    val lng: Double,
    val address: String = ""
)

