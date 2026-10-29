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
        private const val KEY_IS_SETUP_COMPLETE = "is_setup_complete"
        private const val KEY_USER_PROFILE_JSON = "user_profile_json"
        private const val KEY_SETTINGS_JSON = "settings_json"
        private const val KEY_CONTACTS_JSON = "contacts_json"
        private const val KEY_HISTORY_JSON = "history_json"
        private const val KEY_ACTIVE_ALERT_ID = "active_alert_id"

        const val DEFAULT_PIN = "1234"
    }

    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()

    val isLoggedIn: Boolean
        get() = !authToken.isNullOrEmpty()

    var isSetupComplete: Boolean
        get() = prefs.getBoolean(KEY_IS_SETUP_COMPLETE, false)
        set(value) = prefs.edit().putBoolean(KEY_IS_SETUP_COMPLETE, value).apply()

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

    var userProfile: UserProfile
        get() {
            val raw = prefs.getString(KEY_USER_PROFILE_JSON, null)
            if (raw != null) {
                try {
                    return UserProfile.fromJson(JSONObject(raw))
                } catch (e: Exception) {
                    // fallback
                }
            }
            return UserProfile(
                id = prefs.getString(KEY_USER_ID, "") ?: "",
                name = prefs.getString(KEY_USER_NAME, "User") ?: "User",
                email = prefs.getString(KEY_USER_EMAIL, "") ?: "",
                isSetupComplete = isSetupComplete
            )
        }
        set(profile) {
            currentUser = User(profile.id, profile.name, profile.email, profile.role)
            isSetupComplete = profile.isSetupComplete
            prefs.edit().putString(KEY_USER_PROFILE_JSON, profile.toJson().toString()).apply()
        }

    var settings: Settings
        get() {
            val raw = prefs.getString(KEY_SETTINGS_JSON, null)
            if (raw != null) {
                try {
                    return Settings.fromJson(JSONObject(raw))
                } catch (e: Exception) {
                    // fallback
                }
            }
            return Settings()
        }
        set(s) {
            prefs.edit().putString(KEY_SETTINGS_JSON, s.toJson().toString()).apply()
        }

    var safetyPin: String
        get() = settings.safetyPin
        set(pin) {
            settings = settings.copy(safetyPin = pin)
        }

    var messageTemplate: String
        get() = settings.messageTemplate
        set(tmpl) {
            settings = settings.copy(messageTemplate = tmpl)
        }

    var activeAlertId: String?
        get() = prefs.getString(KEY_ACTIVE_ALERT_ID, null)
        set(value) = prefs.edit().putString(KEY_ACTIVE_ALERT_ID, value).apply()

    fun getContacts(): List<Contact> {
        val raw = prefs.getString(KEY_CONTACTS_JSON, null) ?: return emptyList()
        val list = mutableListOf<Contact>()
        try {
            val array = JSONArray(raw)
            for (i in 0 until array.length()) {
                list.add(Contact.fromJson(array.getJSONObject(i)))
            }
        } catch (e: Exception) {
            return emptyList()
        }
        return list
    }

    fun saveContacts(contacts: List<Contact>) {
        val array = JSONArray()
        for (c in contacts) {
            array.put(c.toJson())
        }
        prefs.edit().putString(KEY_CONTACTS_JSON, array.toString()).apply()
    }

    fun getHistory(): List<AlertEvent> {
        val raw = prefs.getString(KEY_HISTORY_JSON, null) ?: return emptyList()
        val list = mutableListOf<AlertEvent>()
        try {
            val array = JSONArray(raw)
            for (i in 0 until array.length()) {
                list.add(AlertEvent.fromJson(array.getJSONObject(i)))
            }
        } catch (e: Exception) {
            return emptyList()
        }
        return list
    }

    fun saveHistory(history: List<AlertEvent>) {
        val array = JSONArray()
        for (event in history) {
            val obj = JSONObject().apply {
                put("id", event.id)
                put("timestamp", event.timestamp)
                put("type", event.type)
                put("durationSeconds", event.durationSeconds)
                put("status", event.status)
                put("evidence", JSONObject().apply {
                    put("photos", event.evidence.photos)
                    put("videos", event.evidence.videos)
                    put("audio", event.evidence.audio)
                    val filesArr = JSONArray()
                    for (f in event.evidence.files) {
                        filesArr.put(JSONObject().apply {
                            put("type", f.type)
                            put("url", f.url)
                            put("timestamp", f.timestamp)
                        })
                    }
                    put("files", filesArr)
                })
                val cArr = JSONArray()
                for (c in event.contactsNotified) {
                    cArr.put(JSONObject().apply {
                        put("contactId", c.contactId)
                        put("name", c.name)
                        put("status", c.status)
                    })
                }
                put("contactsNotified", cArr)
                val gArr = JSONArray()
                for (g in event.gpsPath) {
                    gArr.put(JSONObject().apply {
                        put("lat", g.lat)
                        put("lng", g.lng)
                        put("timestamp", g.timestamp)
                    })
                }
                put("gpsPath", gArr)
                put("location", JSONObject().apply {
                    put("lat", event.lat)
                    put("lng", event.lng)
                    put("address", event.address)
                })
            }
            array.put(obj)
        }
        prefs.edit().putString(KEY_HISTORY_JSON, array.toString()).apply()
    }

    fun logout() {
        prefs.edit().clear().apply()
    }
}
