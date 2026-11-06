package com.silentsos.app

import android.content.Context
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

    fun getIncidentDir(incidentId: String): File {
        return File(vaultRootDir, incidentId).apply { mkdirs() }
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
}
