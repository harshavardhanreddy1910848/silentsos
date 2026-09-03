package com.silentsos.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.ProgressBar
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var loadingProgressBar: ProgressBar
    private lateinit var layoutNetworkError: View
    private lateinit var btnRetry: AppCompatButton

    // Pending permission and file chooser callbacks
    private var pendingMediaRequest: PermissionRequest? = null
    private var pendingLocationCallback: GeolocationPermissions.Callback? = null
    private var pendingLocationOrigin: String? = null
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

    // Activity Result Launchers
    private lateinit var mediaPermissionLauncher: ActivityResultLauncher<Array<String>>
    private lateinit var locationPermissionLauncher: ActivityResultLauncher<Array<String>>
    private lateinit var notificationPermissionLauncher: ActivityResultLauncher<String>
    private lateinit var fileChooserLauncher: ActivityResultLauncher<Intent>

    override fun onCreate(savedInstanceState: Bundle?) {
        // 1. Install AndroidX Splash Screen before super.onCreate
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // 2. Initialize Notification Channel
        NotificationHelper.createNotificationChannel(this)

        // 3. Register Permission & Intent Launchers
        setupPermissionLaunchers()

        // 4. Bind Views
        webView = findViewById(R.id.webView)
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout)
        loadingProgressBar = findViewById(R.id.loadingProgressBar)
        layoutNetworkError = findViewById(R.id.layoutNetworkError)
        btnRetry = findViewById(R.id.btnRetry)

        // 5. Configure WebView Settings & Engine
        setupWebView()

        // 6. Modern Back Button Navigation
        setupBackNavigation()

        // 7. Swipe-to-refresh & Retry listeners
        swipeRefreshLayout.setColorSchemeResources(R.color.silentsos_red_primary)
        swipeRefreshLayout.setProgressBackgroundColorSchemeResource(R.color.silentsos_surface)
        swipeRefreshLayout.setOnRefreshListener {
            layoutNetworkError.visibility = View.GONE
            webView.reload()
        }

        btnRetry.setOnClickListener {
            layoutNetworkError.visibility = View.GONE
            loadingProgressBar.visibility = View.VISIBLE
            webView.reload()
        }

        // 8. Request notification permission on Android 13+ if not already granted
        checkNotificationPermission()

        // 9. Load Production Web Application
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            val targetUrl = intent?.dataString ?: BuildConfig.SILENTSOS_WEB_URL
            webView.loadUrl(targetUrl)
        }
    }

    private fun setupPermissionLaunchers() {
        mediaPermissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { permissions ->
            val granted = mutableListOf<String>()
            val request = pendingMediaRequest

            if (request != null) {
                for (res in request.resources) {
                    if (res == PermissionRequest.RESOURCE_VIDEO_CAPTURE &&
                        permissions[Manifest.permission.CAMERA] == true
                    ) {
                        granted.add(res)
                    }
                    if (res == PermissionRequest.RESOURCE_AUDIO_CAPTURE &&
                        permissions[Manifest.permission.RECORD_AUDIO] == true
                    ) {
                        granted.add(res)
                    }
                }
                if (granted.isNotEmpty()) {
                    request.grant(granted.toTypedArray())
                } else {
                    request.deny()
                }
                pendingMediaRequest = null
            }
        }

        locationPermissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { permissions ->
            val isGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                    permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
            val origin = pendingLocationOrigin
            val callback = pendingLocationCallback

            if (origin != null && callback != null) {
                callback.invoke(origin, isGranted, true)
                pendingLocationOrigin = null
                pendingLocationCallback = null
            }
        }

        notificationPermissionLauncher = registerForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { /* Notification permission handled gracefully */ }

        fileChooserLauncher = registerForActivityResult(
            ActivityResultContracts.StartActivityForResult()
        ) { result ->
            if (fileUploadCallback != null) {
                val results: Array<Uri>? = when {
                    result.resultCode == RESULT_OK && result.data != null -> {
                        val clipData = result.data?.clipData
                        if (clipData != null) {
                            val uriList = ArrayList<Uri>()
                            for (i in 0 until clipData.itemCount) {
                                uriList.add(clipData.getItemAt(i).uri)
                            }
                            uriList.toTypedArray()
                        } else {
                            val dataUri = result.data?.data
                            if (dataUri != null) arrayOf(dataUri) else null
                        }
                    }
                    else -> null
                }
                fileUploadCallback?.onReceiveValue(results)
                fileUploadCallback = null
            }
        }
    }

    private fun setupWebView() {
        val settings: WebSettings = webView.settings

        // JavaScript & DOM Storage
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true

        // Security Hardening
        settings.allowFileAccess = false
        settings.allowContentAccess = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW

        // Geolocation and Media
        settings.setGeolocationEnabled(true)
        settings.mediaPlaybackRequiresUserGesture = false

        // Viewport & Scaling
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.setSupportZoom(false)

        // Cookies
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        // Webview Debugging in Debug builds only
        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        // Clients
        webView.webViewClient = SilentSOSWebViewClient(
            this,
            loadingProgressBar,
            swipeRefreshLayout,
            layoutNetworkError
        )
        webView.webChromeClient = SilentSOSWebChromeClient(this, loadingProgressBar)
    }

    private fun setupBackNavigation() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    showExitConfirmation()
                }
            }
        })
    }

    private fun showExitConfirmation() {
        AlertDialog.Builder(this)
            .setTitle(R.string.exit_confirm_title)
            .setMessage(R.string.exit_confirm_message)
            .setPositiveButton(R.string.exit_app) { _, _ ->
                finish()
            }
            .setNegativeButton(R.string.stay_in_app, null)
            .show()
    }

    fun requestMediaPermissions(permissions: Array<String>, request: PermissionRequest) {
        pendingMediaRequest = request
        mediaPermissionLauncher.launch(permissions)
    }

    fun requestLocationPermissions(
        origin: String,
        callback: GeolocationPermissions.Callback
    ) {
        pendingLocationOrigin = origin
        pendingLocationCallback = callback
        locationPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }

    fun launchFileChooser(
        callback: ValueCallback<Array<Uri>>,
        params: WebChromeClient.FileChooserParams?
    ): Boolean {
        fileUploadCallback?.onReceiveValue(null)
        fileUploadCallback = callback

        try {
            val intent = params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                type = "*/*"
                addCategory(Intent.CATEGORY_OPENABLE)
            }
            fileChooserLauncher.launch(intent)
            return true
        } catch (e: Exception) {
            fileUploadCallback = null
            Toast.makeText(this, "Cannot launch file chooser", Toast.LENGTH_SHORT).show()
            return false
        }
    }

    private fun checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
