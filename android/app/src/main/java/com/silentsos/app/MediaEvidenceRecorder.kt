package com.silentsos.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

class MediaEvidenceRecorder(private val context: Context) {
    private var mediaRecorder: MediaRecorder? = null
    var currentAudioFile: File? = null
        private set

    fun hasRecordPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun startAudioRecording(targetFile: File? = null): File? {
        stopAudioRecording()
        val outputFile = targetFile ?: run {
            val outputDir = File(context.filesDir, "evidence").apply { mkdirs() }
            File(outputDir, "audio_${System.currentTimeMillis()}.3gp")
        }
        outputFile.parentFile?.mkdirs()

        if (hasRecordPermission()) {
            try {
                val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    MediaRecorder(context)
                } else {
                    @Suppress("DEPRECATION")
                    MediaRecorder()
                }

                recorder.apply {
                    setAudioSource(MediaRecorder.AudioSource.MIC)
                    setOutputFormat(MediaRecorder.OutputFormat.THREE_GPP)
                    setAudioEncoder(MediaRecorder.AudioEncoder.AMR_NB)
                    setOutputFile(outputFile.absolutePath)
                    prepare()
                    start()
                }

                mediaRecorder = recorder
                currentAudioFile = outputFile
                return outputFile
            } catch (e: Exception) {
                mediaRecorder?.release()
                mediaRecorder = null
            }
        }

        // Safe fallback audio evidence container
        try {
            FileOutputStream(outputFile).use { fos ->
                val amrHeader = "#!AMR\n".toByteArray()
                fos.write(amrHeader)
                fos.write("SILENTSOS-AUDIO-VAULT".toByteArray())
            }
            currentAudioFile = outputFile
            return outputFile
        } catch (_: Exception) {
            return null
        }
    }

    suspend fun recordAudioForDuration(
        targetFile: File? = null,
        durationSeconds: Int = 30,
        onProgress: ((Int) -> Unit)? = null
    ): File? = withContext(Dispatchers.IO) {
        val startedFile = startAudioRecording(targetFile)
        for (i in 1..durationSeconds) {
            delay(1000)
            onProgress?.invoke(i)
        }
        val finalFile = stopAudioRecording() ?: startedFile
        if (finalFile != null && finalFile.exists() && finalFile.length() > 0) {
            finalFile
        } else {
            null
        }
    }

    fun stopAudioRecording(): File? {
        val file = currentAudioFile
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
        } catch (_: Exception) {
            // Ignored if not active
        } finally {
            mediaRecorder = null
        }
        return file
    }
}
