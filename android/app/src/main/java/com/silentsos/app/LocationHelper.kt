package com.silentsos.app

import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Looper
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

class LocationHelper(private val context: Context) {
    private val fusedClient: FusedLocationProviderClient = LocationServices.getFusedLocationProviderClient(context)
    private var locationCallback: LocationCallback? = null

    fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    @SuppressLint("MissingPermission")
    fun getSingleAccurateLocation(onLocationResult: (Location?) -> Unit) {
        if (!hasLocationPermission()) {
            onLocationResult(null)
            return
        }

        try {
            fusedClient.lastLocation.addOnSuccessListener { loc ->
                if (loc != null) {
                    onLocationResult(loc)
                } else {
                    requestFreshLocation(onLocationResult)
                }
            }.addOnFailureListener {
                fallbackToLocationManager(onLocationResult)
            }
        } catch (e: Exception) {
            fallbackToLocationManager(onLocationResult)
        }
    }

    @SuppressLint("MissingPermission")
    private fun requestFreshLocation(onResult: (Location?) -> Unit) {
        if (!hasLocationPermission()) {
            onResult(null)
            return
        }

        var handled = false
        val handler = android.os.Handler(Looper.getMainLooper())
        val timeoutRunnable = Runnable {
            if (!handled) {
                handled = true
                fallbackToLocationManager(onResult)
            }
        }
        handler.postDelayed(timeoutRunnable, 3000)

        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 3000)
            .setMaxUpdates(1)
            .build()

        val cb = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                if (!handled) {
                    handled = true
                    handler.removeCallbacks(timeoutRunnable)
                    try { fusedClient.removeLocationUpdates(this) } catch (_: Exception) {}
                    onResult(result.lastLocation)
                }
            }
        }
        try {
            fusedClient.requestLocationUpdates(request, cb, Looper.getMainLooper())
        } catch (e: Exception) {
            if (!handled) {
                handled = true
                handler.removeCallbacks(timeoutRunnable)
                fallbackToLocationManager(onResult)
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun startContinuousTracking(intervalMs: Long = 5000, onUpdate: (Location) -> Unit) {
        if (!hasLocationPermission()) return

        stopContinuousTracking()
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(2000)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { onUpdate(it) }
            }
        }

        try {
            fusedClient.requestLocationUpdates(request, locationCallback!!, Looper.getMainLooper())
        } catch (e: Exception) {
            // Non-fatal tracking exception
        }
    }

    fun stopContinuousTracking() {
        locationCallback?.let {
            try {
                fusedClient.removeLocationUpdates(it)
            } catch (_: Exception) {}
            locationCallback = null
        }
    }

    @SuppressLint("MissingPermission")
    private fun fallbackToLocationManager(onResult: (Location?) -> Unit) {
        if (!hasLocationPermission()) {
            onResult(null)
            return
        }

        try {
            val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: run {
                onResult(null)
                return
            }

            val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
            for (provider in providers) {
                if (lm.isProviderEnabled(provider)) {
                    val loc = lm.getLastKnownLocation(provider)
                    if (loc != null) {
                        onResult(loc)
                        return
                    }
                }
            }
            onResult(null)
        } catch (e: Exception) {
            onResult(null)
        }
    }
}
