package com.silentsos.app

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.MediaMetadataRetriever
import android.media.MediaRecorder
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.File

class MediaEvidenceRecorder(private val context: Context) {
    companion object {
        private const val TAG = "MediaEvidenceRecorder"
    }

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
            File(outputDir, "audio_${System.currentTimeMillis()}.m4a")
        }
        outputFile.parentFile?.mkdirs()
        if (outputFile.exists()) {
            outputFile.delete()
        }

        if (!hasRecordPermission()) {
            Log.w(TAG, "Audio RECORD_AUDIO permission not granted")
            return null
        }

        try {
            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            recorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioEncodingBitRate(128_000)
                setAudioSamplingRate(44100)
                setOutputFile(outputFile.absolutePath)
                prepare()
                start()
            }

            mediaRecorder = recorder
            currentAudioFile = outputFile
            Log.i(TAG, "MediaRecorder started recording to: ${outputFile.name}")
            return outputFile
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start MediaRecorder: ${e.message}", e)
            try { mediaRecorder?.release() } catch (_: Exception) {}
            mediaRecorder = null
            return null
        }
    }

    suspend fun recordAudioForDuration(
        targetFile: File? = null,
        durationSeconds: Int = 30,
        onProgress: ((Int) -> Unit)? = null
    ): File? = withContext(Dispatchers.IO) {
        val startedFile = startAudioRecording(targetFile)
        if (startedFile == null) {
            Log.e(TAG, "Cannot record audio: recorder could not start")
            return@withContext null
        }

        for (i in 1..durationSeconds) {
            delay(1000)
            onProgress?.invoke(i)
        }

        val finalFile = stopAudioRecording() ?: startedFile
        if (finalFile.exists() && finalFile.length() > 5000L) {
            // Verify file has real audio stream and duration
            try {
                val retriever = MediaMetadataRetriever()
                retriever.setDataSource(finalFile.absolutePath)
                val hasAudio = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO)
                val duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
                retriever.release()
                if (hasAudio != null && duration > 0L) {
                    Log.i(TAG, "Verified audio file: ${finalFile.name} (duration=${duration}ms, size=${finalFile.length()} bytes)")
                    finalFile
                } else {
                    Log.w(TAG, "Audio file has no decodable duration")
                    finalFile
                }
            } catch (e: Exception) {
                Log.w(TAG, "Metadata check warning: ${e.message}")
                finalFile
            }
        } else {
            Log.e(TAG, "Audio recording resulted in empty or corrupt file")
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
            Log.i(TAG, "MediaRecorder stopped successfully")
        } catch (e: Exception) {
            Log.w(TAG, "MediaRecorder stop failed (possibly too short): ${e.message}")
        } finally {
            mediaRecorder = null
        }
        return file
    }
}
