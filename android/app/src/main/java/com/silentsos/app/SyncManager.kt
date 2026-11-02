package com.silentsos.app

import android.content.Context
import android.os.Handler
import android.os.Looper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit

/**
 * SyncManager provides real-time, two-way bidirectional WebSocket synchronization
 * between the SilentSOS backend, Web application, and Android client (Instagram-like sync).
 */
class SyncManager private constructor(private val context: Context) {

    interface SyncEventListener {
        fun onSyncEvent(event: String, payload: JSONObject?)
    }

    private val sessionManager = SessionManager(context)
    private val apiClient = ApiClient(context)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val listeners = CopyOnWriteArrayList<SyncEventListener>()

    private var webSocket: WebSocket? = null
    private var isConnecting = false
    private var reconnectAttempts = 0
    private var isDisposed = false

    private val wsClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS) // Keep alive
        .pingInterval(25, TimeUnit.SECONDS)
        .build()

    companion object {
        @Volatile
        private var instance: SyncManager? = null

        fun getInstance(context: Context): SyncManager {
            return instance ?: synchronized(this) {
                instance ?: SyncManager(context.applicationContext).also { instance = it }
            }
        }
    }

    fun addListener(listener: SyncEventListener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener)
        }
    }

    fun removeListener(listener: SyncEventListener) {
        listeners.remove(listener)
    }

    fun connect() {
        if (!sessionManager.isLoggedIn) return
        if (webSocket != null || isConnecting) return

        isConnecting = true
        isDisposed = false

        scope.launch {
            try {
                val httpUrl = apiClient.getBaseUrl()
                val wsUrl = if (httpUrl.startsWith("https://")) {
                    httpUrl.replace("https://", "wss://")
                } else {
                    httpUrl.replace("http://", "ws://")
                }

                val request = Request.Builder()
                    .url(wsUrl)
                    .build()

                webSocket = wsClient.newWebSocket(request, object : WebSocketListener() {
                    override fun onOpen(webSocket: WebSocket, response: Response) {
                        isConnecting = false
                        reconnectAttempts = 0

                        // Authenticate real-time session with user's token
                        val token = sessionManager.authToken
                        if (!token.isNullOrEmpty()) {
                            val authPayload = JSONObject().apply {
                                put("type", "auth")
                                put("token", token)
                                put("userId", sessionManager.currentUser?.id ?: "")
                            }
                            webSocket.send(authPayload.toString())
                        }
                    }

                    override fun onMessage(webSocket: WebSocket, text: String) {
                        try {
                            val data = JSONObject(text)
                            val type = data.optString("type", "")

                            when (type) {
                                "alert_triggered", "alert_stopped", "alert_cancelled",
                                "alert_deleted", "contacts_updated", "user_updated",
                                "settings_updated", "evidence_updated" -> {
                                    // Refresh full state from authoritative PostgreSQL database
                                    scope.launch {
                                        apiClient.fetchState()
                                        mainHandler.post {
                                            for (listener in listeners) {
                                                listener.onSyncEvent(type, data)
                                            }
                                        }
                                    }
                                }
                                "authenticated" -> {
                                    // Connected & authenticated with server
                                }
                            }
                        } catch (e: Exception) {
                            // Non-fatal payload parse error
                        }
                    }

                    override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                        webSocket.close(1000, null)
                    }

                    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                        this@SyncManager.webSocket = null
                        isConnecting = false
                        scheduleReconnect()
                    }

                    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                        this@SyncManager.webSocket = null
                        isConnecting = false
                        scheduleReconnect()
                    }
                })
            } catch (e: Exception) {
                isConnecting = false
                scheduleReconnect()
            }
        }
    }

    private fun scheduleReconnect() {
        if (isDisposed || !sessionManager.isLoggedIn) return
        val delay = (1000L * (1 shl reconnectAttempts.coerceAtMost(5))).coerceAtLeast(2000L)
        reconnectAttempts++
        mainHandler.postDelayed({
            connect()
        }, delay)
    }

    fun disconnect() {
        isDisposed = true
        webSocket?.close(1000, "User logged out")
        webSocket = null
        isConnecting = false
    }
}

