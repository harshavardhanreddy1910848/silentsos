package com.silentsos.app

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.view.View
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import android.widget.Toast
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class SilentSOSWebViewClient(
    private val context: Context,
    private val progressBar: ProgressBar,
    private val swipeRefreshLayout: SwipeRefreshLayout,
    private val errorLayout: View
) : WebViewClient() {

    private val baseHost: String = Uri.parse(BuildConfig.SILENTSOS_WEB_URL).host ?: ""

    override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val url = request?.url?.toString() ?: return false
        return handleUrl(view, url)
    }

    @Deprecated("Deprecated in Java")
    override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
        if (url == null) return false
        return handleUrl(view, url)
    }

    private fun handleUrl(view: WebView?, url: String): Boolean {
        val uri = Uri.parse(url)
        val scheme = uri.scheme?.lowercase() ?: ""

        // 1. Handle Phone Dialer Intent (tel:)
        if (scheme == "tel") {
            try {
                val intent = Intent(Intent.ACTION_DIAL, uri)
                context.startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(context, "No dialer application found", Toast.LENGTH_SHORT).show()
            }
            return true
        }

        // 2. Handle Native SMS Intent (sms:)
        if (scheme == "sms") {
            try {
                val intent = Intent(Intent.ACTION_SENDTO, uri)
                context.startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(context, "No messaging application found", Toast.LENGTH_SHORT).show()
            }
            return true
        }

        // 3. Handle Email Intent (mailto:)
        if (scheme == "mailto") {
            try {
                val intent = Intent(Intent.ACTION_SENDTO, uri)
                context.startActivity(intent)
            } catch (e: Exception) {
                Toast.makeText(context, "No email application found", Toast.LENGTH_SHORT).show()
            }
            return true
        }

        // 4. Handle WhatsApp Direct Message Links (api.whatsapp.com, wa.me, whatsapp:)
        if (scheme == "whatsapp" || url.contains("api.whatsapp.com") || url.contains("wa.me")) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, uri)
                intent.setPackage("com.whatsapp")
                context.startActivity(intent)
                return true
            } catch (e: ActivityNotFoundException) {
                // Fallback to browser intent if WhatsApp app is not installed
                try {
                    val browserIntent = Intent(Intent.ACTION_VIEW, uri)
                    context.startActivity(browserIntent)
                    return true
                } catch (ex: Exception) {
                    Toast.makeText(context, "Unable to open WhatsApp", Toast.LENGTH_SHORT).show()
                    return true
                }
            }
        }

        // 5. Check if link is an internal SilentSOS route
        val host = uri.host?.lowercase() ?: ""
        if (host.isEmpty() || host == baseHost || host.endsWith(".$baseHost")) {
            // Internal application navigation: keep inside WebView
            return false
        }

        // 6. External website links (e.g., Google Maps external link, support sites)
        try {
            val browserIntent = Intent(Intent.ACTION_VIEW, uri)
            context.startActivity(browserIntent)
        } catch (e: Exception) {
            Toast.makeText(context, "Unable to open link", Toast.LENGTH_SHORT).show()
        }
        return true
    }

    override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
        super.onPageStarted(view, url, favicon)
        progressBar.visibility = View.VISIBLE
        errorLayout.visibility = View.GONE
    }

    override fun onPageFinished(view: WebView?, url: String?) {
        super.onPageFinished(view, url)
        progressBar.visibility = View.GONE
        swipeRefreshLayout.isRefreshing = false
    }

    override fun onReceivedError(
        view: WebView?,
        request: WebResourceRequest?,
        error: WebResourceError?
    ) {
        super.onReceivedError(view, request, error)
        if (request?.isForMainFrame == true) {
            progressBar.visibility = View.GONE
            swipeRefreshLayout.isRefreshing = false
            errorLayout.visibility = View.VISIBLE
        }
    }

    override fun onReceivedHttpError(
        view: WebView?,
        request: WebResourceRequest?,
        errorResponse: WebResourceResponse?
    ) {
        super.onReceivedHttpError(view, request, errorResponse)
        val statusCode = errorResponse?.statusCode ?: 200
        if (request?.isForMainFrame == true && (statusCode >= 500)) {
            progressBar.visibility = View.GONE
            swipeRefreshLayout.isRefreshing = false
            errorLayout.visibility = View.VISIBLE
        }
    }
}
