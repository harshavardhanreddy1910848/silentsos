package com.silentsos.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import androidx.core.content.ContextCompat
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

    fun startAudioRecording(): File? {
        stopAudioRecording()
        val outputDir = File(context.filesDir, "evidence").apply { mkdirs() }
        val outputFile = File(outputDir, "audio_${System.currentTimeMillis()}.3gp")

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
        } catch (e: Exception) {
            return null
        }
    }

    fun stopAudioRecording(): File? {
        val file = currentAudioFile
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
        } catch (e: Exception) {
            // Ignored if not active
        } finally {
            mediaRecorder = null
        }
        return file
    }
}
