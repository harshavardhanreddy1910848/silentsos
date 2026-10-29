package com.silentsos.app

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

class MediaEvidenceRecorder(private val context: Context) {
    private var mediaRecorder: MediaRecorder? = null
    var currentAudioFile: File? = null
        private set

    fun startAudioRecording(): File? {
        stopAudioRecording()
        return try {
            val outputDir = File(context.filesDir, "evidence").apply { mkdirs() }
            val outputFile = File(outputDir, "audio_${System.currentTimeMillis()}.3gp")

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
            outputFile
        } catch (e: Exception) {
            mediaRecorder?.release()
            mediaRecorder = null
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
        } catch (e: Exception) {
            // Ignored if not recording
        } finally {
            mediaRecorder = null
        }
        return file
    }
}
