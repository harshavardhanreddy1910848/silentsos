package com.silentsos.app

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Looper
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

class LocationHelper(private val context: Context) {
    private val fusedClient: FusedLocationProviderClient = LocationServices.getFusedLocationProviderClient(context)
    private var locationCallback: LocationCallback? = null

    @SuppressLint("MissingPermission")
    fun getSingleAccurateLocation(onLocationResult: (Location?) -> Unit) {
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
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 3000)
            .setMaxUpdates(1)
            .build()

        val cb = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                fusedClient.removeLocationUpdates(this)
                onResult(result.lastLocation)
            }
        }
        try {
            fusedClient.requestLocationUpdates(request, cb, Looper.getMainLooper())
        } catch (e: Exception) {
            fallbackToLocationManager(onResult)
        }
    }

    @SuppressLint("MissingPermission")
    fun startContinuousTracking(onLocationUpdate: (Location) -> Unit) {
        stopContinuousTracking()
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000)
            .setMinUpdateIntervalMillis(2000)
            .setMinUpdateDistanceMeters(2f)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { onLocationUpdate(it) }
            }
        }
        try {
            locationCallback?.let {
                fusedClient.requestLocationUpdates(request, it, Looper.getMainLooper())
            }
        } catch (e: Exception) {
            // Ignored if permissions revoked
        }
    }

    fun stopContinuousTracking() {
        locationCallback?.let {
            fusedClient.removeLocationUpdates(it)
            locationCallback = null
        }
    }

    @SuppressLint("MissingPermission")
    private fun fallbackToLocationManager(onResult: (Location?) -> Unit) {
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
    }
}
