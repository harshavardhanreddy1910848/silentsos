package com.silentsos.app

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class ApiClient(private val context: Context) {
    private val sessionManager = SessionManager(context)
    private val baseUrl: String = BuildConfig.BACKEND_API_BASE.trimEnd('/')

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun login(email: String, pass: String): Result<User> = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("email", email.trim())
                put("password", pass)
            }
            val request = Request.Builder()
                .url("$baseUrl/api/auth/login")
                .post(json.toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                val err = try { JSONObject(body).optString("error", "Login failed (${response.code})") } catch (e: Exception) { "Login failed" }
                return@withContext Result.failure(Exception(err))
            }

            val resJson = JSONObject(body)
            val token = resJson.optString("token")
            val userJson = resJson.optJSONObject("user") ?: JSONObject().apply {
                put("id", resJson.optString("userId", "1"))
                put("name", resJson.optString("name", email.substringBefore("@")))
                put("email", email)
            }
            val user = User.fromJson(userJson)

            sessionManager.authToken = token
            sessionManager.currentUser = user
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun register(name: String, email: String, pass: String): Result<User> = withContext(Dispatchers.IO) {
        try {
            val json = JSONObject().apply {
                put("name", name.trim())
                put("email", email.trim())
                put("password", pass)
            }
            val request = Request.Builder()
                .url("$baseUrl/api/auth/register")
                .post(json.toString().toRequestBody(jsonMediaType))
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""

            if (!response.isSuccessful) {
                val err = try { JSONObject(body).optString("error", "Registration failed (${response.code})") } catch (e: Exception) { "Registration failed" }
                return@withContext Result.failure(Exception(err))
            }

            val resJson = JSONObject(body)
            val token = resJson.optString("token")
            val userJson = resJson.optJSONObject("user") ?: JSONObject().apply {
                put("id", resJson.optString("userId", "1"))
                put("name", name)
                put("email", email)
            }
            val user = User.fromJson(userJson)

            sessionManager.authToken = token
            sessionManager.currentUser = user
            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchState(): Result<Unit> = withContext(Dispatchers.IO) {
        val token = sessionManager.authToken ?: return@withContext Result.failure(Exception("No token"))
        try {
            val request = Request.Builder()
                .url("$baseUrl/api/state")
                .addHeader("Authorization", "Bearer $token")
                .get()
                .build()

            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: ""

            if (response.isSuccessful) {
                val json = JSONObject(body)
                val contactsArray = json.optJSONArray("contacts")
                if (contactsArray != null) {
                    val list = mutableListOf<Contact>()
                    for (i in 0 until contactsArray.length()) {
                        list.add(Contact.fromJson(contactsArray.getJSONObject(i)))
                    }
                    if (list.isNotEmpty()) {
                        sessionManager.saveContacts(list)
                    }
                }
                Result.success(Unit)
            } else {
                Result.failure(Exception("Failed to fetch state"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun triggerAlert(lat: Double, lng: Double, address: String = ""): Result<String> = withContext(Dispatchers.IO) {
        val token = sessionManager.authToken
        try {
            val json = JSONObject().apply {
                put("type", "distress")
                put("location", JSONObject().apply {
                    put("lat", lat)
                    put("lng", lng)
                    put("address", address)
                })
                put("timestamp", System.currentTimeMillis())
            }

            val reqBuilder = Request.Builder()
                .url("$baseUrl/api/alerts")
                .post(json.toString().toRequestBody(jsonMediaType))

            if (!token.isNullOrEmpty()) {
                reqBuilder.addHeader("Authorization", "Bearer $token")
            }

            val response = client.newCall(reqBuilder.build()).execute()
            val body = response.body?.string() ?: ""

            if (response.isSuccessful) {
                val resJson = JSONObject(body)
                val alertId = resJson.optString("alertId", resJson.optString("id", System.currentTimeMillis().toString()))
                sessionManager.activeAlertId = alertId
                Result.success(alertId)
            } else {
                // If backend is waking up or offline, return local alert ID so app operates autonomously
                val localAlertId = "local_${System.currentTimeMillis()}"
                sessionManager.activeAlertId = localAlertId
                Result.success(localAlertId)
            }
        } catch (e: Exception) {
            val localAlertId = "local_${System.currentTimeMillis()}"
            sessionManager.activeAlertId = localAlertId
            Result.success(localAlertId)
        }
    }

    suspend fun stopAlert(alertId: String, pin: String): Result<Boolean> = withContext(Dispatchers.IO) {
        val token = sessionManager.authToken
        try {
            val json = JSONObject().apply {
                put("safetyPin", pin)
                put("resolutionSource", "user_verified_pin")
            }
            val reqBuilder = Request.Builder()
                .url("$baseUrl/api/alerts/$alertId/stop")
                .post(json.toString().toRequestBody(jsonMediaType))

            if (!token.isNullOrEmpty()) {
                reqBuilder.addHeader("Authorization", "Bearer $token")
            }

            val response = client.newCall(reqBuilder.build()).execute()
            sessionManager.activeAlertId = null
            Result.success(response.isSuccessful)
        } catch (e: Exception) {
            sessionManager.activeAlertId = null
            Result.success(true)
        }
    }

    suspend fun uploadEvidence(alertId: String, file: File, type: String): Result<Boolean> = withContext(Dispatchers.IO) {
        val token = sessionManager.authToken
        try {
            val mediaType = when (type.lowercase()) {
                "photo" -> "image/jpeg".toMediaType()
                "audio" -> "audio/3gpp".toMediaType()
                "video" -> "video/mp4".toMediaType()
                else -> "application/octet-stream".toMediaType()
            }

            val requestBody = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    type,
                    file.name,
                    file.asRequestBody(mediaType)
                )
                .build()

            val reqBuilder = Request.Builder()
                .url("$baseUrl/api/alerts/$alertId/evidence")
                .post(requestBody)

            if (!token.isNullOrEmpty()) {
                reqBuilder.addHeader("Authorization", "Bearer $token")
            }

            val response = client.newCall(reqBuilder.build()).execute()
            Result.success(response.isSuccessful)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
