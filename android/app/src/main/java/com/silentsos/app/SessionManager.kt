package com.silentsos.app

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

class SessionManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    companion object {
        private const val PREF_NAME = "silentsos_native_prefs"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_USER_ROLE = "user_role"
        private const val KEY_SAFETY_PIN = "safety_pin"
        private const val KEY_CONTACTS_JSON = "contacts_json"
        private const val KEY_ACTIVE_ALERT_ID = "active_alert_id"
        private const val KEY_MESSAGE_TEMPLATE = "message_template"

        const val DEFAULT_PIN = "1234"
        const val DEFAULT_MESSAGE = "🚨 EMERGENCY ALERT — SilentSOS! I need immediate help. My current location is: {gps_link}"
    }

    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()

    val isLoggedIn: Boolean
        get() = !authToken.isNullOrEmpty()

    var currentUser: User?
        get() {
            val id = prefs.getString(KEY_USER_ID, null) ?: return null
            val name = prefs.getString(KEY_USER_NAME, "User") ?: "User"
            val email = prefs.getString(KEY_USER_EMAIL, "") ?: ""
            val role = prefs.getString(KEY_USER_ROLE, "user") ?: "user"
            return User(id, name, email, role)
        }
        set(user) {
            val editor = prefs.edit()
            if (user != null) {
                editor.putString(KEY_USER_ID, user.id)
                editor.putString(KEY_USER_NAME, user.name)
                editor.putString(KEY_USER_EMAIL, user.email)
                editor.putString(KEY_USER_ROLE, user.role)
            } else {
                editor.remove(KEY_USER_ID)
                editor.remove(KEY_USER_NAME)
                editor.remove(KEY_USER_EMAIL)
                editor.remove(KEY_USER_ROLE)
            }
            editor.apply()
        }

    var safetyPin: String
        get() = prefs.getString(KEY_SAFETY_PIN, DEFAULT_PIN) ?: DEFAULT_PIN
        set(value) = prefs.edit().putString(KEY_SAFETY_PIN, value).apply()

    var activeAlertId: String?
        get() = prefs.getString(KEY_ACTIVE_ALERT_ID, null)
        set(value) = prefs.edit().putString(KEY_ACTIVE_ALERT_ID, value).apply()

    var messageTemplate: String
        get() = prefs.getString(KEY_MESSAGE_TEMPLATE, DEFAULT_MESSAGE) ?: DEFAULT_MESSAGE
        set(value) = prefs.edit().putString(KEY_MESSAGE_TEMPLATE, value).apply()

    fun getContacts(): List<Contact> {
        val raw = prefs.getString(KEY_CONTACTS_JSON, null) ?: return getDefaultContacts()
        val list = mutableListOf<Contact>()
        try {
            val array = JSONArray(raw)
            for (i in 0 until array.length()) {
                list.add(Contact.fromJson(array.getJSONObject(i)))
            }
        } catch (e: Exception) {
            return getDefaultContacts()
        }
        return if (list.isEmpty()) getDefaultContacts() else list
    }

    fun saveContacts(contacts: List<Contact>) {
        val array = JSONArray()
        for (c in contacts) {
            array.put(c.toJson())
        }
        prefs.edit().putString(KEY_CONTACTS_JSON, array.toString()).apply()
    }

    private fun getDefaultContacts(): List<Contact> {
        return listOf(
            Contact("1", "Emergency Services", "112", "police@gov.in", notifySms = true, notifyWhatsapp = false),
            Contact("2", "Primary Contact", "+91 98765 43210", "guardian@example.com", notifySms = true, notifyWhatsapp = true)
        )
    }

    fun logout() {
        prefs.edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_USER_ID)
            .remove(KEY_USER_NAME)
            .remove(KEY_USER_EMAIL)
            .remove(KEY_USER_ROLE)
            .remove(KEY_ACTIVE_ALERT_ID)
            .apply()
    }
}

