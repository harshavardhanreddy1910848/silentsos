package com.silentsos.app

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class ApiClient(private val context: Context) {
    val sessionManager = SessionManager(context)

    companion object {
        @Volatile
        private var cachedBaseUrl: String? = null
    }

    private val authInterceptor = Interceptor { chain ->
        val original = chain.request()
        val token = sessionManager.authToken
        val requestBuilder = original.newBuilder()

        if (!token.isNullOrEmpty() && original.header("Authorization") == null) {
            requestBuilder.addHeader("Authorization", "Bearer $token")
        }

        val response = chain.proceed(requestBuilder.build())

        // Handle expired session or unauthorized tokens
        if (response.code == 401 || response.code == 403) {
            val path = original.url.encodedPath
            if (!path.contains("/api/auth/login") && !path.contains("/api/auth/register")) {
                // Invalidate session on authorization failure
                sessionManager.logout()
            }
        }

        response
    }

    private val client = OkHttpClient.Builder()
        .addInterceptor(authInterceptor)
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    private val probeClient = OkHttpClient.Builder()
        .connectTimeout(2, TimeUnit.SECONDS)
        .readTimeout(2, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    /**
     * Resolves the authoritative backend URL:
     * 1. Checks custom setting if set by user.
     * 2. Probes candidate local/LAN/cloud endpoints to find active running server.
     * 3. Falls back to BuildConfig.BACKEND_API_BASE.
     */
    suspend fun getBaseUrl(): String = withContext(Dispatchers.IO) {
        cachedBaseUrl?.let { return@withContext it }

        sessionManager.customApiBase?.let { custom ->
            val clean = custom.trimEnd('/')
            if (clean.isNotEmpty()) {
                cachedBaseUrl = clean
                return@withContext clean
            }
        }

        val defaultBase = BuildConfig.BACKEND_API_BASE.trimEnd('/')

        // Candidate servers for USB debugging, Emulator, Local LAN, and Cloud
        val candidates = listOf(
            "http://127.0.0.1:3001",
            "http://10.0.2.2:3001",
            "http://10.235.254.242:3001",
            defaultBase
        ).distinct()

        for (url in candidates) {
            try {
                val req = Request.Builder()
                    .url("$url/api/debug/db")
                    .get()
                    .build()
                val resp = probeClient.newCall(req).execute()
                if (resp.isSuccessful) {
                    cachedBaseUrl = url
                    return@withContext url
                }
            } catch (_: Exception) {
                // candidate unavailable, try next
            }
        }

        cachedBaseUrl = defaultBase
        defaultBase
    }

    suspend fun login(email: String, pass: String): Result<User> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val json = JSONObject().apply {
                put("email", email.trim().lowercase())
                put("password", pass)
            }
            val request = Request.Builder()
                .url("$base/api/auth/login")
                .post(json.toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                val err = try {
                    JSONObject(body).optString("error", "Login failed (${response.code})")
                } catch (e: Exception) {
                    "Invalid email or password (${response.code})"
                }
                return@withContext Result.failure(Exception(err))
            }

            val resJson = JSONObject(body)
            val token = resJson.optString("token")
            val userJson = resJson.optJSONObject("user") ?: JSONObject().apply {
                put("id", resJson.optString("userId", ""))
                put("name", email.substringBefore("@"))
                put("email", email)
            }
            val user = User.fromJson(userJson)

            sessionManager.authToken = token
            sessionManager.currentUser = user
            sessionManager.userProfile = UserProfile.fromJson(userJson)

            // Connect real-time WebSocket sync immediately on login
            SyncManager.getInstance(context).connect()

            Result.success(user)
        } catch (e: Exception) {
            Result.failure(Exception(e.message ?: "Could not connect to backend server"))
        }
    }

    suspend fun register(name: String, email: String, pass: String): Result<User> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val json = JSONObject().apply {
                put("name", name.trim())
                put("email", email.trim().lowercase())
                put("password", pass)
            }
            val request = Request.Builder()
                .url("$base/api/auth/register")
                .post(json.toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                val err = try {
                    JSONObject(body).optString("error", "Registration failed (${response.code})")
                } catch (e: Exception) {
                    "Registration failed"
                }
                return@withContext Result.failure(Exception(err))
            }

            val resJson = JSONObject(body)
            val token = resJson.optString("token")
            val userJson = resJson.optJSONObject("user") ?: JSONObject().apply {
                put("id", resJson.optString("userId", ""))
                put("name", name)
                put("email", email)
            }
            val user = User.fromJson(userJson)

            sessionManager.authToken = token
            sessionManager.currentUser = user
            sessionManager.userProfile = UserProfile.fromJson(userJson)

            SyncManager.getInstance(context).connect()

            Result.success(user)
        } catch (e: Exception) {
            Result.failure(Exception(e.message ?: "Could not connect to backend server"))
        }
    }

    suspend fun sendAuthToken(email: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val json = JSONObject().apply { put("email", email.trim().lowercase()) }
            val request = Request.Builder()
                .url("$base/api/auth/send-token")
                .post(json.toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            if (!response.isSuccessful) {
                val err = try { JSONObject(body).optString("error", "Failed to dispatch token") } catch (e: Exception) { "Dispatch error" }
                return@withContext Result.failure(Exception(err))
            }
            Result.success(JSONObject(body).optString("message", "Token dispatched successfully"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun verifyTokenOtp(email: String, otp: String): Result<User> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val json = JSONObject().apply {
                put("email", email.trim().lowercase())
                put("token", otp.trim())
                put("otp", otp.trim())
            }
            val request = Request.Builder()
                .url("$base/api/auth/verify-token")
                .post(json.toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                val err = try { JSONObject(body).optString("error", "Invalid security token") } catch (e: Exception) { "Invalid token" }
                return@withContext Result.failure(Exception(err))
            }

            val resJson = JSONObject(body)
            val token = resJson.optString("token")
            val userJson = resJson.optJSONObject("user") ?: JSONObject().apply {
                put("id", resJson.optString("userId", ""))
                put("name", email.substringBefore("@"))
                put("email", email)
            }
            val user = User.fromJson(userJson)

            sessionManager.authToken = token
            sessionManager.currentUser = user
            sessionManager.userProfile = UserProfile.fromJson(userJson)

            SyncManager.getInstance(context).connect()

            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Primary synchronization method: Pulls the authoritative PostgreSQL state
     * (User Profile, Contacts, Settings, History, and Active Alert)
     * and updates the local storage.
     */
    suspend fun fetchState(): Result<Unit> = withContext(Dispatchers.IO) {
        if (sessionManager.authToken == null) return@withContext Result.failure(Exception("Not authenticated"))
        try {
            val base = getBaseUrl()
            val request = Request.Builder()
                .url("$base/api/state")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""

            if (response.isSuccessful) {
                val json = JSONObject(body)

                // 1. User Profile
                val uJson = json.optJSONObject("user")
                if (uJson != null) {
                    val up = UserProfile.fromJson(uJson)
                    sessionManager.userProfile = up
                    sessionManager.currentUser = User(up.id, up.name, up.email, up.role)
                    sessionManager.isSetupComplete = up.isSetupComplete
                }

                // 2. Contacts
                val contactsArray = json.optJSONArray("contacts")
                if (contactsArray != null) {
                    val list = mutableListOf<Contact>()
                    for (i in 0 until contactsArray.length()) {
                        list.add(Contact.fromJson(contactsArray.getJSONObject(i)))
                    }
                    sessionManager.saveContacts(list)
                }

                // 3. Settings
                val settingsJson = json.optJSONObject("settings")
                if (settingsJson != null) {
                    sessionManager.settings = Settings.fromJson(settingsJson)
                }

                // 4. Alerts History
                val historyArray = json.optJSONArray("history")
                if (historyArray != null) {
                    val hList = mutableListOf<AlertEvent>()
                    for (i in 0 until historyArray.length()) {
                        hList.add(AlertEvent.fromJson(historyArray.getJSONObject(i)))
                    }
                    sessionManager.saveHistory(hList)
                }

                // 5. Active Alert
                val activeAlertJson = json.optJSONObject("activeAlert")
                if (activeAlertJson != null && activeAlertJson.optBoolean("isActive", false)) {
                    sessionManager.activeAlertId = if (activeAlertJson.has("id")) activeAlertJson.optString("id") else null
                } else {
                    sessionManager.activeAlertId = null
                }

                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to fetch state (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getUserProfile(): Result<UserProfile> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val request = Request.Builder()
                .url("$base/api/user")
                .get()
                .build()
            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            if (response.isSuccessful) {
                val up = UserProfile.fromJson(JSONObject(body))
                sessionManager.userProfile = up
                Result.success(up)
            } else {
                Result.failure(Exception("Failed to retrieve profile (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateUserProfile(profile: UserProfile): Result<UserProfile> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val json = JSONObject().apply {
                put("name", profile.name)
                put("email", profile.email)
                put("phone", profile.phone)
                put("bloodGroup", profile.bloodGroup)
                put("address", profile.address)
                put("motherName", profile.motherName)
                put("fatherName", profile.fatherName)
            }
            val request = Request.Builder()
                .url("$base/api/user")
                .put(json.toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            if (response.isSuccessful) {
                val updated = UserProfile.fromJson(JSONObject(body))
                sessionManager.userProfile = updated
                Result.success(updated)
            } else {
                Result.failure(Exception("Failed to update profile (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getContacts(): Result<List<Contact>> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val request = Request.Builder()
                .url("$base/api/contacts")
                .get()
                .build()
            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            if (response.isSuccessful) {
                val arr = JSONArray(body)
                val list = mutableListOf<Contact>()
                for (i in 0 until arr.length()) {
                    list.add(Contact.fromJson(arr.getJSONObject(i)))
                }
                sessionManager.saveContacts(list)
                Result.success(list)
            } else {
                Result.failure(Exception("Failed to retrieve contacts (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun addContact(contact: Contact): Result<Contact> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val request = Request.Builder()
                .url("$base/api/contacts")
                .post(contact.toJson().toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            if (response.isSuccessful) {
                // Server returns full updated contacts list
                val arr = JSONArray(body)
                val list = mutableListOf<Contact>()
                for (i in 0 until arr.length()) {
                    list.add(Contact.fromJson(arr.getJSONObject(i)))
                }
                sessionManager.saveContacts(list)
                Result.success(contact)
            } else {
                Result.failure(Exception("Failed to add contact (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateContact(id: String, contact: Contact): Result<Contact> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val request = Request.Builder()
                .url("$base/api/contacts/$id")
                .put(contact.toJson().toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            if (response.isSuccessful) {
                val arr = JSONArray(body)
                val list = mutableListOf<Contact>()
                for (i in 0 until arr.length()) {
                    list.add(Contact.fromJson(arr.getJSONObject(i)))
                }
                sessionManager.saveContacts(list)
                Result.success(contact)
            } else {
                Result.failure(Exception("Failed to update contact (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun removeContact(id: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val request = Request.Builder()
                .url("$base/api/contacts/$id")
                .delete()
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            if (response.isSuccessful) {
                val arr = JSONArray(body)
                val list = mutableListOf<Contact>()
                for (i in 0 until arr.length()) {
                    list.add(Contact.fromJson(arr.getJSONObject(i)))
                }
                sessionManager.saveContacts(list)
                Result.success(true)
            } else {
                Result.failure(Exception("Failed to remove contact (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateSettings(settings: Settings): Result<Settings> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val request = Request.Builder()
                .url("$base/api/settings")
                .put(settings.toJson().toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            if (response.isSuccessful) {
                val updated = Settings.fromJson(JSONObject(body))
                sessionManager.settings = updated
                Result.success(updated)
            } else {
                Result.failure(Exception("Failed to update settings (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchAlertsHistory(): Result<List<AlertEvent>> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val request = Request.Builder()
                .url("$base/api/alerts")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            if (response.isSuccessful) {
                val array = JSONArray(body)
                val list = mutableListOf<AlertEvent>()
                for (i in 0 until array.length()) {
                    list.add(AlertEvent.fromJson(array.getJSONObject(i)))
                }
                sessionManager.saveHistory(list)
                Result.success(list)
            } else {
                Result.failure(Exception("Failed to fetch alerts (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun triggerAlert(lat: Double, lng: Double, type: String = "Emergency", address: String = ""): Result<String> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val json = JSONObject().apply {
                put("type", type)
                put("location", JSONObject().apply {
                    put("lat", lat)
                    put("lng", lng)
                    put("address", address)
                })
            }
            val request = Request.Builder()
                .url("$base/api/alerts")
                .post(json.toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            if (response.isSuccessful) {
                val resObj = JSONObject(body)
                val alertId = resObj.optString("id", System.currentTimeMillis().toString())
                sessionManager.activeAlertId = alertId
                // refresh full state
                fetchState()
                Result.success(alertId)
            } else {
                Result.failure(Exception("Failed to trigger SOS alert (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun stopAlert(alertId: String, pin: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val json = JSONObject().apply { put("pin", pin) }
            val request = Request.Builder()
                .url("$base/api/alerts/$alertId/stop")
                .post(json.toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                sessionManager.activeAlertId = null
                fetchState()
                Result.success(true)
            } else {
                Result.failure(Exception("Failed to stop alert (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun cancelAlert(alertId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val request = Request.Builder()
                .url("$base/api/alerts/$alertId/cancel")
                .post("{}".toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                sessionManager.activeAlertId = null
                fetchState()
                Result.success(true)
            } else {
                Result.failure(Exception("Failed to cancel alert (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteAlert(alertId: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val request = Request.Builder()
                .url("$base/api/alerts/$alertId")
                .delete()
                .build()

            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                fetchState()
                Result.success(true)
            } else {
                Result.failure(Exception("Failed to delete alert (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadEvidence(alertId: String, file: File, type: String): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val mime = when (type.lowercase()) {
                "photo" -> "image/jpeg"
                "video" -> "video/mp4"
                "audio" -> "audio/mp4"
                else -> "application/octet-stream"
            }
            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(type, file.name, file.asRequestBody(mime.toMediaType()))
                .build()

            val request = Request.Builder()
                .url("$base/api/alerts/$alertId/evidence")
                .post(requestBody)
                .build()

            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                Result.success(true)
            } else {
                Result.failure(Exception("Failed to upload evidence (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getNotifications(): Result<JSONArray> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val request = Request.Builder()
                .url("$base/api/notifications")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: "[]"
            if (response.isSuccessful) {
                Result.success(JSONArray(body))
            } else {
                Result.failure(Exception("Failed to retrieve notifications (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun testResendAlert(email: String?): Result<String> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val json = JSONObject()
            if (!email.isNullOrEmpty()) {
                json.put("email", email.trim().lowercase())
            }
            val request = Request.Builder()
                .url("$base/api/alerts/test-resend")
                .post(json.toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            if (response.isSuccessful) {
                Result.success(JSONObject(body).optString("message", "Test alert dispatched!"))
            } else {
                Result.failure(Exception("Server returned ${response.code}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun submitFeedback(rating: Int, category: String, message: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val json = JSONObject().apply {
                put("rating", rating)
                put("category", category)
                put("message", message)
                put("deviceInfo", JSONObject().apply {
                    put("platform", "Android Native")
                    put("model", android.os.Build.MODEL)
                    put("os", android.os.Build.VERSION.RELEASE)
                })
            }
            val request = Request.Builder()
                .url("$base/api/feedback")
                .post(json.toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""
            if (response.isSuccessful) {
                Result.success(JSONObject(body).optString("message", "Feedback recorded"))
            } else {
                Result.failure(Exception("Submission failed (${response.code})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun completeSetup(): Result<Boolean> = withContext(Dispatchers.IO) {
        try {
            val base = getBaseUrl()
            val request = Request.Builder()
                .url("$base/api/user/setup-complete")
                .post("{}".toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            if (response.isSuccessful) {
                sessionManager.isSetupComplete = true
                Result.success(true)
            } else {
                Result.failure(Exception("Setup completion failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun clearData(): Result<Boolean> = withContext(Dispatchers.IO) {
        sessionManager.logout()
        SyncManager.getInstance(context).disconnect()
        Result.success(true)
    }
}
