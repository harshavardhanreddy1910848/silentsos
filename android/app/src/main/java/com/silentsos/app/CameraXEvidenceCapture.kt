package com.silentsos.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.Executors

class CameraXEvidenceCapture(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner
) {
    private val cameraExecutor = Executors.newSingleThreadExecutor()
    private var cameraProvider: ProcessCameraProvider? = null

    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var activeRecording: Recording? = null

    private val isRecordingActive = Object()

    fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasAudioPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    suspend fun initializeCamera(
        previewView: PreviewView? = null,
        useFrontCamera: Boolean = false
    ): Boolean = withContext(Dispatchers.Main) {
        if (!hasCameraPermission()) return@withContext false

        val providerDeferred = CompletableDeferred<ProcessCameraProvider?>()
        val future = ProcessCameraProvider.getInstance(context)
        future.addListener({
            try {
                providerDeferred.complete(future.get())
            } catch (e: Exception) {
                providerDeferred.complete(null)
            }
        }, ContextCompat.getMainExecutor(context))

        val provider = providerDeferred.await() ?: return@withContext false
        cameraProvider = provider

        try {
            provider.unbindAll()

            val cameraSelector = if (useFrontCamera && provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)) {
                CameraSelector.DEFAULT_FRONT_CAMERA
            } else {
                CameraSelector.DEFAULT_BACK_CAMERA
            }

            val imgCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()
            imageCapture = imgCapture

            val recorder = Recorder.Builder()
                .setQualitySelector(QualitySelector.from(Quality.HD, androidx.camera.video.FallbackStrategy.lowerQualityOrHigherThan(Quality.SD)))
                .build()
            val vidCapture = VideoCapture.withOutput(recorder)
            videoCapture = vidCapture

            val useCases = mutableListOf<androidx.camera.core.UseCase>(imgCapture, vidCapture)

            if (previewView != null) {
                val preview = Preview.Builder().build().also {
                    it.setSurfaceProvider(previewView.surfaceProvider)
                }
                useCases.add(preview)
            }

            provider.bindToLifecycle(
                lifecycleOwner,
                cameraSelector,
                *useCases.toTypedArray()
            )
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun capturePhoto(outputFile: File): File? = withContext(Dispatchers.IO) {
        val capture = imageCapture ?: return@withContext null
        if (!hasCameraPermission()) return@withContext null

        val deferred = CompletableDeferred<File?>()
        val outputOptions = ImageCapture.OutputFileOptions.Builder(outputFile).build()

        capture.takePicture(
            outputOptions,
            cameraExecutor,
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    if (outputFile.exists() && outputFile.length() > 0) {
                        deferred.complete(outputFile)
                    } else {
                        deferred.complete(null)
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    deferred.complete(null)
                }
            }
        )

        deferred.await()
    }

    @SuppressLint("MissingPermission")
    suspend fun recordVideo(
        outputFile: File,
        durationSeconds: Int = 30,
        onProgress: ((Int) -> Unit)? = null
    ): File? = withContext(Dispatchers.IO) {
        val vidCapture = videoCapture ?: return@withContext null
        if (!hasCameraPermission()) return@withContext null

        val outputOptions = FileOutputOptions.Builder(outputFile).build()
        val recordingDeferred = CompletableDeferred<Boolean>()

        var pendingRecording = vidCapture.output.prepareRecording(context, outputOptions)
        if (hasAudioPermission()) {
            pendingRecording = pendingRecording.withAudioEnabled()
        }

        var isStarted = false

        val recording = pendingRecording.start(ContextCompat.getMainExecutor(context)) { event ->
            when (event) {
                is VideoRecordEvent.Start -> {
                    isStarted = true
                }
                is VideoRecordEvent.Finalize -> {
                    if (!event.hasError() && outputFile.exists() && outputFile.length() > 0) {
                        recordingDeferred.complete(true)
                    } else {
                        recordingDeferred.complete(false)
                    }
                }
            }
        }
        activeRecording = recording

        // Wait up to 2 seconds for start event
        var startWait = 0
        while (!isStarted && startWait < 20) {
            delay(100)
            startWait++
        }

        if (isStarted) {
            for (sec in 1..durationSeconds) {
                delay(1000)
                onProgress?.invoke(sec)
            }
        }

        try {
            recording.stop()
            recording.close()
        } catch (_: Exception) {}

        val success = try { recordingDeferred.await() } catch (_: Exception) { false }
        activeRecording = null

        if (success && outputFile.exists() && outputFile.length() > 1000) {
            outputFile
        } else {
            null
        }
    }

    fun stopRecording() {
        try {
            activeRecording?.stop()
            activeRecording?.close()
        } catch (_: Exception) {}
        activeRecording = null
    }

    fun unbind() {
        try {
            stopRecording()
            cameraProvider?.unbindAll()
        } catch (_: Exception) {}
    }
}
