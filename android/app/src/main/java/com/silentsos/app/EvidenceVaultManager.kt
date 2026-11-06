package com.silentsos.app

import android.content.Context
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

data class IncidentMetadata(
    val incidentId: String,
    val userId: String,
    val timestamp: Long,
    val latitude: Double,
    val longitude: Double,
    val photos: List<String>,
    val videos: List<String>,
    val audios: List<String>,
    val sha256Hashes: Map<String, String>,
    var encryptionStatus: String = "AES-256-GCM Encrypted",
    var uploadStatus: String = "Pending"
)

class EvidenceVaultManager(private val context: Context) {

    private val vaultRootDir: File = File(context.filesDir, "SilentSOS/Evidence").apply { mkdirs() }
    private val keyFile: File = File(context.filesDir, "SilentSOS/vault.key")

    private val vaultKey: SecretKey by lazy {
        getOrCreateVaultKey()
    }

    private fun getOrCreateVaultKey(): SecretKey {
        return try {
            if (keyFile.exists() && keyFile.length() == 32L) {
                val raw = keyFile.readBytes()
                SecretKeySpec(raw, "AES")
            } else {
                keyFile.parentFile?.mkdirs()
                val kgen = KeyGenerator.getInstance("AES")
                kgen.init(256, SecureRandom())
                val key = kgen.generateKey()
                keyFile.writeBytes(key.encoded)
                key
            }
        } catch (_: Exception) {
            val fallbackBytes = ByteArray(32) { (it * 7).toByte() }
            SecretKeySpec(fallbackBytes, "AES")
        }
    }

    fun findIncidentDir(incidentId: String, timestamp: Long = 0L): File {
        val cleanId = incidentId.removePrefix("INCIDENT_").trim()

        val exactDir = File(vaultRootDir, incidentId)
        if (exactDir.exists() && exactDir.isDirectory && exactDir.list()?.isNotEmpty() == true) {
            return exactDir
        }

        val prefixedDir = File(vaultRootDir, "INCIDENT_$cleanId")
        if (prefixedDir.exists() && prefixedDir.isDirectory && prefixedDir.list()?.isNotEmpty() == true) {
            return prefixedDir
        }

        val unprefixedDir = File(vaultRootDir, cleanId)
        if (unprefixedDir.exists() && unprefixedDir.isDirectory && unprefixedDir.list()?.isNotEmpty() == true) {
            return unprefixedDir
        }

        val allDirs = vaultRootDir.listFiles { f -> f.isDirectory } ?: emptyArray()

        for (dir in allDirs) {
            if (dir.name.contains(cleanId) && dir.list()?.isNotEmpty() == true) {
                return dir
            }
        }

        val targetTs = if (timestamp > 0L) timestamp else cleanId.toLongOrNull() ?: 0L
        if (targetTs > 0L) {
            var closestDir: File? = null
            var minDiff = Long.MAX_VALUE
            for (dir in allDirs) {
                val dirTs = dir.name.removePrefix("INCIDENT_").toLongOrNull()
                if (dirTs != null) {
                    val diff = kotlin.math.abs(dirTs - targetTs)
                    if (diff < 300_000L && diff < minDiff && dir.list()?.isNotEmpty() == true) {
                        minDiff = diff
                        closestDir = dir
                    }
                }
            }
            if (closestDir != null) return closestDir
        }

        return exactDir
    }

    fun getIncidentDir(incidentId: String): File {
        return findIncidentDir(incidentId).apply { mkdirs() }
    }

    fun getPhotosDir(incidentId: String): File {
        return File(getIncidentDir(incidentId), "Photos").apply { mkdirs() }
    }

    fun getVideosDir(incidentId: String): File {
        return File(getIncidentDir(incidentId), "Videos").apply { mkdirs() }
    }

    fun getAudioDir(incidentId: String): File {
        return File(getIncidentDir(incidentId), "Audio").apply { mkdirs() }
    }

    fun getMetadataDir(incidentId: String): File {
        return File(getIncidentDir(incidentId), "Metadata").apply { mkdirs() }
    }

    fun getMediaDurationSeconds(file: File): Long {
        if (!file.exists() || file.length() < 500L) return 0L
        var sec = 0L
        try {
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(file.absolutePath)
            val durMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            sec = durMs / 1000L
            retriever.release()
        } catch (_: Exception) {}

        if (sec <= 0L) {
            try {
                val mp = android.media.MediaPlayer()
                mp.setDataSource(file.absolutePath)
                mp.prepare()
                sec = (mp.duration / 1000).toLong()
                mp.release()
            } catch (_: Exception) {}
        }

        if (sec <= 0L) {
            val name = file.name.lowercase()
            if (name.endsWith(".mp4") || name.endsWith(".mkv") || name.endsWith(".webm")) {
                sec = (file.length() / (1024L * 1024L)).coerceIn(5L, 30L)
                if (file.length() > 500_000L) sec = 30L
            } else if (name.endsWith(".m4a") || name.endsWith(".aac") || name.endsWith(".3gp") || name.endsWith(".mp3")) {
                sec = (file.length() / 16_000L).coerceIn(1L, 30L)
                if (file.length() > 20_000L) sec = 30L
            }
        }
        return if (sec > 0L) sec else 30L
    }

    fun getVideosForIncident(incidentId: String, timestamp: Long = 0L): List<File> {
        val dir = findIncidentDir(incidentId, timestamp)
        val videosDir = File(dir, "Videos")
        val localVideos = if (videosDir.exists()) {
            videosDir.listFiles { f -> !f.name.endsWith(".enc") && f.name.endsWith(".mp4") && f.length() > 500L }?.toList() ?: emptyList()
        } else emptyList()

        if (localVideos.isNotEmpty()) return localVideos

        // Check if video is stored directly in incident directory
        val directVideos = dir.listFiles { f -> !f.name.endsWith(".enc") && f.name.endsWith(".mp4") && f.length() > 500L }?.toList() ?: emptyList()
        if (directVideos.isNotEmpty()) return directVideos

        // Check nearby incident directories within 5-minute proximity window
        val targetTs = if (timestamp > 0L) timestamp else incidentId.removePrefix("INCIDENT_").toLongOrNull() ?: 0L
        if (targetTs > 0L) {
            val allDirs = vaultRootDir.listFiles { f -> f.isDirectory } ?: emptyArray()
            for (d in allDirs.sortedByDescending { it.lastModified() }) {
                val dirTs = d.name.removePrefix("INCIDENT_").toLongOrNull() ?: d.lastModified()
                if (kotlin.math.abs(dirTs - targetTs) < 300_000L) {
                    val vDir = File(d, "Videos")
                    val found = if (vDir.exists()) {
                        vDir.listFiles { f -> !f.name.endsWith(".enc") && f.name.endsWith(".mp4") && f.length() > 500L }?.toList() ?: emptyList()
                    } else emptyList()
                    if (found.isNotEmpty()) return found
                }
            }
        }

        val legacyDir = File(context.filesDir, "evidence")
        if (legacyDir.exists()) {
            val legacyVideos = legacyDir.listFiles { f -> f.name.endsWith(".mp4") && f.length() > 500L }?.toList() ?: emptyList()
            if (legacyVideos.isNotEmpty()) return legacyVideos
        }

        return emptyList()
    }

    fun getAudioForIncident(incidentId: String, timestamp: Long = 0L): List<File> {
        val dir = findIncidentDir(incidentId, timestamp)
        val audioDir = File(dir, "Audio")
        val localAudios = if (audioDir.exists()) {
            audioDir.listFiles { f -> !f.name.endsWith(".enc") && (f.name.endsWith(".m4a") || f.name.endsWith(".3gp") || f.name.endsWith(".mp3") || f.name.endsWith(".aac")) && f.length() > 500L }?.toList() ?: emptyList()
        } else emptyList()

        if (localAudios.isNotEmpty()) return localAudios

        // Check if audio is directly in the incident folder
        val directAudios = dir.listFiles { f -> !f.name.endsWith(".enc") && (f.name.endsWith(".m4a") || f.name.endsWith(".3gp") || f.name.endsWith(".mp3") || f.name.endsWith(".aac")) && f.length() > 500L }?.toList() ?: emptyList()
        if (directAudios.isNotEmpty()) return directAudios

        // Automatic Single-Source Extraction: If a valid video exists for this incident, extract audio track now
        val videos = getVideosForIncident(incidentId, timestamp)
        if (videos.isNotEmpty()) {
            val video = videos.first()
            audioDir.mkdirs()
            val extractedAudio = File(audioDir, "audio_${dir.name}_${System.currentTimeMillis()}.m4a")
            if (AudioExtractor.extractAudioTrackFromMp4(video, extractedAudio) && extractedAudio.exists() && extractedAudio.length() > 500L) {
                return listOf(extractedAudio)
            }
        }

        // Check nearby incident directories within 5-minute proximity window
        val targetTs = if (timestamp > 0L) timestamp else incidentId.removePrefix("INCIDENT_").toLongOrNull() ?: 0L
        if (targetTs > 0L) {
            val allDirs = vaultRootDir.listFiles { f -> f.isDirectory } ?: emptyArray()
            for (d in allDirs.sortedByDescending { it.lastModified() }) {
                val dirTs = d.name.removePrefix("INCIDENT_").toLongOrNull() ?: d.lastModified()
                if (kotlin.math.abs(dirTs - targetTs) < 300_000L) {
                    val aDir = File(d, "Audio")
                    val found = if (aDir.exists()) {
                        aDir.listFiles { f -> !f.name.endsWith(".enc") && (f.name.endsWith(".m4a") || f.name.endsWith(".3gp") || f.name.endsWith(".mp3") || f.name.endsWith(".aac")) && f.length() > 500L }?.toList() ?: emptyList()
                    } else emptyList()
                    if (found.isNotEmpty()) return found
                }
            }
        }

        val legacyDir = File(context.filesDir, "evidence")
        if (legacyDir.exists()) {
            val legacyAudios = legacyDir.listFiles { f -> (f.name.endsWith(".m4a") || f.name.endsWith(".3gp")) && f.length() > 500L }?.toList() ?: emptyList()
            if (legacyAudios.isNotEmpty()) return legacyAudios
        }

        return emptyList()
    }

    fun getPhotosForIncident(incidentId: String, timestamp: Long = 0L): List<File> {
        val dir = findIncidentDir(incidentId, timestamp)
        val photosDir = File(dir, "Photos")
        val localPhotos = if (photosDir.exists()) {
            photosDir.listFiles { f -> !f.name.endsWith(".enc") && (f.name.endsWith(".jpg") || f.name.endsWith(".jpeg") || f.name.endsWith(".png")) && f.length() > 500L }?.toList() ?: emptyList()
        } else emptyList()

        if (localPhotos.isNotEmpty()) return localPhotos

        val directPhotos = dir.listFiles { f -> !f.name.endsWith(".enc") && (f.name.endsWith(".jpg") || f.name.endsWith(".jpeg") || f.name.endsWith(".png")) && f.length() > 500L }?.toList() ?: emptyList()
        if (directPhotos.isNotEmpty()) return directPhotos

        val targetTs = if (timestamp > 0L) timestamp else incidentId.removePrefix("INCIDENT_").toLongOrNull() ?: 0L
        if (targetTs > 0L) {
            val allDirs = vaultRootDir.listFiles { f -> f.isDirectory } ?: emptyArray()
            for (d in allDirs.sortedByDescending { it.lastModified() }) {
                val dirTs = d.name.removePrefix("INCIDENT_").toLongOrNull() ?: d.lastModified()
                if (kotlin.math.abs(dirTs - targetTs) < 300_000L) {
                    val pDir = File(d, "Photos")
                    val found = if (pDir.exists()) {
                        pDir.listFiles { f -> !f.name.endsWith(".enc") && (f.name.endsWith(".jpg") || f.name.endsWith(".png")) && f.length() > 500L }?.toList() ?: emptyList()
                    } else emptyList()
                    if (found.isNotEmpty()) return found
                }
            }
        }

        val legacyDir = File(context.filesDir, "evidence")
        if (legacyDir.exists()) {
            val legacyPhotos = legacyDir.listFiles { f -> (f.name.endsWith(".jpg") || f.name.endsWith(".png")) && f.length() > 500L }?.toList() ?: emptyList()
            if (legacyPhotos.isNotEmpty()) return legacyPhotos
        }

        return emptyList()
    }

    fun getAllVaultEvents(): List<AlertEvent> {
        val events = mutableListOf<AlertEvent>()
        val allDirs = vaultRootDir.listFiles { f -> f.isDirectory } ?: emptyArray()

        for (dir in allDirs.sortedByDescending { it.lastModified() }) {
            try {
                val meta = loadIncidentMetadata(dir.name)
                val photos = getPhotosForIncident(dir.name, meta?.timestamp ?: 0L)
                val videos = getVideosForIncident(dir.name, meta?.timestamp ?: 0L)
                val audios = getAudioForIncident(dir.name, meta?.timestamp ?: 0L)

                if (photos.isEmpty() && videos.isEmpty() && audios.isEmpty() && meta == null) {
                    continue
                }

                val files = mutableListOf<EvidenceFile>()
                photos.forEach { files.add(EvidenceFile("photo", it.absolutePath, it.lastModified())) }
                videos.forEach { files.add(EvidenceFile("video", it.absolutePath, it.lastModified())) }
                audios.forEach { files.add(EvidenceFile("audio", it.absolutePath, it.lastModified())) }

                val ts = when {
                    meta != null && meta.timestamp > 0 -> meta.timestamp
                    dir.name.removePrefix("INCIDENT_").toLongOrNull() != null -> dir.name.removePrefix("INCIDENT_").toLong()
                    else -> dir.lastModified()
                }

                val type = when {
                    dir.name.startsWith("SURV_BURST_") -> "Surveillance Photo Burst"
                    dir.name.startsWith("SURV_VID_") -> "Surveillance Video Loop"
                    dir.name.startsWith("SURV_AUD_") -> "Surveillance Audio Channel"
                    else -> "Emergency SOS"
                }

                val event = AlertEvent(
                    id = dir.name,
                    timestamp = ts,
                    type = type,
                    durationSeconds = 30,
                    status = "Resolved",
                    evidence = EvidenceSummary(
                        photos = photos.size,
                        videos = videos.size,
                        audio = audios.size,
                        files = files
                    ),
                    lat = meta?.latitude ?: 17.4485,
                    lng = meta?.longitude ?: 78.3908
                )
                events.add(event)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        return events
    }

    fun calculateSha256(file: File): String {
        if (!file.exists() || file.length() == 0L) return ""
        return try {
            val md = MessageDigest.getInstance("SHA-256")
            FileInputStream(file).use { fis ->
                val buffer = ByteArray(8192)
                var bytesRead: Int
                while (fis.read(buffer).also { bytesRead = it } != -1) {
                    md.update(buffer, 0, bytesRead)
                }
            }
            md.digest().joinToString("") { "%02x".format(it) }
        } catch (_: Exception) {
            ""
        }
    }

    fun encryptFileAesGcm(inputFile: File, encryptedFile: File): Boolean {
        if (!inputFile.exists() || inputFile.length() == 0L) return false
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val iv = ByteArray(12)
            SecureRandom().nextBytes(iv)
            val spec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.ENCRYPT_MODE, vaultKey, spec)

            FileOutputStream(encryptedFile).use { fos ->
                fos.write(iv)
                FileInputStream(inputFile).use { fis ->
                    val inBuffer = ByteArray(8192)
                    var read: Int
                    while (fis.read(inBuffer).also { read = it } != -1) {
                        val out = cipher.update(inBuffer, 0, read)
                        if (out != null) fos.write(out)
                    }
                }
                val finalBytes = cipher.doFinal()
                if (finalBytes != null) fos.write(finalBytes)
            }
            encryptedFile.exists() && encryptedFile.length() > 12L
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    fun saveIncidentMetadata(meta: IncidentMetadata): File {
        val metaDir = getMetadataDir(meta.incidentId)
        val jsonFile = File(metaDir, "incident.json")

        val json = JSONObject().apply {
            put("incidentId", meta.incidentId)
            put("userId", meta.userId)
            put("timestamp", meta.timestamp)
            put("latitude", meta.latitude)
            put("longitude", meta.longitude)
            put("photos", JSONArray(meta.photos))
            put("videos", JSONArray(meta.videos))
            put("audios", JSONArray(meta.audios))

            val hashesJson = JSONObject()
            meta.sha256Hashes.forEach { (k, v) -> hashesJson.put(k, v) }
            put("sha256Hashes", hashesJson)

            put("encryptionStatus", meta.encryptionStatus)
            put("uploadStatus", meta.uploadStatus)
        }

        FileOutputStream(jsonFile).use {
            it.write(json.toString(2).toByteArray())
        }
        return jsonFile
    }

    fun loadIncidentMetadata(incidentId: String): IncidentMetadata? {
        val jsonFile = File(getMetadataDir(incidentId), "incident.json")
        if (!jsonFile.exists()) return null

        return try {
            val text = jsonFile.readText()
            val obj = JSONObject(text)

            val photos = mutableListOf<String>()
            val photosArr = obj.optJSONArray("photos")
            if (photosArr != null) {
                for (i in 0 until photosArr.length()) photos.add(photosArr.getString(i))
            }

            val videos = mutableListOf<String>()
            val videosArr = obj.optJSONArray("videos")
            if (videosArr != null) {
                for (i in 0 until videosArr.length()) videos.add(videosArr.getString(i))
            }

            val audios = mutableListOf<String>()
            val audiosArr = obj.optJSONArray("audios")
            if (audiosArr != null) {
                for (i in 0 until audiosArr.length()) audios.add(audiosArr.getString(i))
            }

            val hashes = mutableMapOf<String, String>()
            val hashesObj = obj.optJSONObject("sha256Hashes")
            if (hashesObj != null) {
                val keys = hashesObj.keys()
                while (keys.hasNext()) {
                    val k = keys.next()
                    hashes[k] = hashesObj.getString(k)
                }
            }

            IncidentMetadata(
                incidentId = obj.getString("incidentId"),
                userId = obj.optString("userId", "default_user"),
                timestamp = obj.getLong("timestamp"),
                latitude = obj.getDouble("latitude"),
                longitude = obj.getDouble("longitude"),
                photos = photos,
                videos = videos,
                audios = audios,
                sha256Hashes = hashes,
                encryptionStatus = obj.optString("encryptionStatus", "AES-256-GCM Encrypted"),
                uploadStatus = obj.optString("uploadStatus", "Pending")
            )
        } catch (_: Exception) {
            null
        }
    }

    fun verifyPhoto(file: File): Boolean {
        if (!file.exists() || file.length() < 1000L) return false
        return try {
            val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.absolutePath, options)
            options.outWidth > 0 && options.outHeight > 0
        } catch (_: Exception) {
            false
        }
    }

    fun verifyVideo(file: File): Boolean {
        if (!file.exists() || file.length() < 10000L) return false
        return try {
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(file.absolutePath)
            val hasVideo = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_VIDEO)
            val duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            retriever.release()
            hasVideo != null && duration > 0L
        } catch (_: Exception) {
            false
        }
    }

    fun verifyAudio(file: File): Boolean {
        if (!file.exists() || file.length() < 1000L) return false
        return try {
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(file.absolutePath)
            val hasAudio = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO)
            val duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            retriever.release()
            hasAudio != null && duration > 0L
        } catch (_: Exception) {
            false
        }
    }
}

