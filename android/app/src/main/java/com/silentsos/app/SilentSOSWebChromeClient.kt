package com.silentsos.app

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.view.View
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.ProgressBar
import androidx.core.content.ContextCompat

class SilentSOSWebChromeClient(
    private val activity: MainActivity,
    private val progressBar: ProgressBar
) : WebChromeClient() {

    override fun onProgressChanged(view: WebView?, newProgress: Int) {
        super.onProgressChanged(view, newProgress)
        progressBar.progress = newProgress
        if (newProgress < 100) {
            progressBar.visibility = View.VISIBLE
        } else {
            progressBar.visibility = View.GONE
        }
    }

    override fun onPermissionRequest(request: PermissionRequest?) {
        if (request == null) return

        val requestedResources = request.resources
        val permissionsToRequest = mutableListOf<String>()

        for (resource in requestedResources) {
            when (resource) {
                PermissionRequest.RESOURCE_VIDEO_CAPTURE -> {
                    if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA)
                        != PackageManager.PERMISSION_GRANTED
                    ) {
                        permissionsToRequest.add(Manifest.permission.CAMERA)
                    }
                }
                PermissionRequest.RESOURCE_AUDIO_CAPTURE -> {
                    if (ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED
                    ) {
                        permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
                    }
                }
            }
        }

        if (permissionsToRequest.isEmpty()) {
            // All necessary permissions already granted at the Android OS level
            activity.runOnUiThread {
                request.grant(requestedResources)
            }
        } else {
            // Request permissions dynamically from user
            activity.requestMediaPermissions(permissionsToRequest.toTypedArray(), request)
        }
    }

    override fun onGeolocationPermissionsShowPrompt(
        origin: String?,
        callback: GeolocationPermissions.Callback?
    ) {
        if (callback == null || origin == null) return

        val hasFine = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val hasCoarse = ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (hasFine || hasCoarse) {
            callback.invoke(origin, true, true)
        } else {
            activity.requestLocationPermissions(origin, callback)
        }
    }

    override fun onShowFileChooser(
        webView: WebView?,
        filePathCallback: ValueCallback<Array<Uri>>?,
        fileChooserParams: FileChooserParams?
    ): Boolean {
        if (filePathCallback == null) return false
        return activity.launchFileChooser(filePathCallback, fileChooserParams)
    }
}
