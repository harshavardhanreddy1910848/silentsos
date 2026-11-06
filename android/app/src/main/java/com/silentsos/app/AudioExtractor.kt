package com.silentsos.app

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File
import java.nio.ByteBuffer

object AudioExtractor {

    /**
     * Extracts the real audio track from an MP4 video file and writes it as a standalone M4A audio file.
     * This guarantees 100% synchronized, authentic microphone audio without competing for the MIC hardware.
     */
    fun extractAudioTrackFromMp4(sourceVideoFile: File, outputAudioFile: File): Boolean {
        if (!sourceVideoFile.exists() || sourceVideoFile.length() < 1000L) return false

        val extractor = MediaExtractor()
        var muxer: MediaMuxer? = null

        return try {
            extractor.setDataSource(sourceVideoFile.absolutePath)
            var audioTrackIndex = -1
            var audioFormat: MediaFormat? = null

            for (i in 0 until extractor.trackCount) {
                val format = extractor.getTrackFormat(i)
                val mime = format.getString(MediaFormat.KEY_MIME) ?: ""
                if (mime.startsWith("audio/")) {
                    audioTrackIndex = i
                    audioFormat = format
                    break
                }
            }

            if (audioTrackIndex < 0 || audioFormat == null) {
                extractor.release()
                return false
            }

            extractor.selectTrack(audioTrackIndex)
            outputAudioFile.parentFile?.mkdirs()

            muxer = MediaMuxer(outputAudioFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
            val muxerAudioTrack = muxer.addTrack(audioFormat)
            muxer.start()

            val maxBufferSize = maxOf(
                if (audioFormat.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) audioFormat.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE) else 0,
                1024 * 256
            )
            val buffer = ByteBuffer.allocateDirect(maxBufferSize)
            val bufferInfo = MediaCodec.BufferInfo()

            var lastPresentationTimeUs = 0L
            var samplesWritten = 0

            while (true) {
                val sampleSize = extractor.readSampleData(buffer, 0)
                if (sampleSize < 0) {
                    break
                }
                val sampleTime = extractor.sampleTime
                if (sampleTime >= lastPresentationTimeUs) {
                    bufferInfo.offset = 0
                    bufferInfo.size = sampleSize
                    bufferInfo.presentationTimeUs = sampleTime
                    bufferInfo.flags = extractor.sampleFlags
                    muxer.writeSampleData(muxerAudioTrack, buffer, bufferInfo)
                    lastPresentationTimeUs = sampleTime
                    samplesWritten++
                }
                extractor.advance()
            }

            try {
                muxer.stop()
            } catch (e: Exception) {
                e.printStackTrace()
            }
            muxer.release()
            muxer = null
            extractor.release()

            samplesWritten > 0 && outputAudioFile.exists() && outputAudioFile.length() > 1000L
        } catch (e: Exception) {
            e.printStackTrace()
            try { muxer?.release() } catch (_: Exception) {}
            try { extractor.release() } catch (_: Exception) {}
            false
        }
    }
}

