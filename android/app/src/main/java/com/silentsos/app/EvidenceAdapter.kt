package com.silentsos.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class EvidenceAdapter(
    private var events: List<AlertEvent>,
    private val onItemClick: (AlertEvent) -> Unit,
    private val onItemDelete: (AlertEvent) -> Unit,
) : RecyclerView.Adapter<EvidenceAdapter.EvidenceViewHolder>() {

    private val dateFormat = SimpleDateFormat("MMM dd, yyyy h:mm a", Locale.getDefault())

    fun updateData(newEvents: List<AlertEvent>) {
        events = newEvents
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): EvidenceViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_evidence, parent, false)
        return EvidenceViewHolder(view)
    }

    override fun onBindViewHolder(holder: EvidenceViewHolder, position: Int) {
        val event = events[position]
        holder.bind(event)
    }

    override fun getItemCount(): Int = events.size

    inner class EvidenceViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvTitle: TextView = itemView.findViewById(R.id.tvEvItemTitle)
        private val tvDate: TextView = itemView.findViewById(R.id.tvEvItemDate)
        private val tvLocation: TextView = itemView.findViewById(R.id.tvEvItemLocation)
        private val tvBadgePhotos: TextView = itemView.findViewById(R.id.tvEvBadgePhotos)
        private val tvBadgeAudio: TextView = itemView.findViewById(R.id.tvEvBadgeAudio)
        private val tvBadgeVideo: TextView = itemView.findViewById(R.id.tvEvBadgeVideo)
        private val btnDelete: ImageView = itemView.findViewById(R.id.btnDeleteEvidence)

        fun bind(event: AlertEvent) {
            tvTitle.text = "${event.type} Evidence Session"
            tvDate.text = dateFormat.format(Date(event.timestamp))
            tvLocation.text = "📍 ${String.format(Locale.US, "%.4f", event.lat)}° N, ${String.format(Locale.US, "%.4f", event.lng)}° E ${if (event.address.isNotBlank()) "(${event.address})" else ""}"

            val vaultManager = EvidenceVaultManager(itemView.context)
            val localVideos = vaultManager.getVideosForIncident(event.id, event.timestamp)
            val localAudios = vaultManager.getAudioForIncident(event.id, event.timestamp)
            val localPhotos = vaultManager.getPhotosForIncident(event.id, event.timestamp)

            val pCount = event.evidence.photos.coerceAtLeast(event.evidence.files.count { it.type == "photo" })
                .coerceAtLeast(localPhotos.size)
            val aCount = event.evidence.audio.coerceAtLeast(event.evidence.files.count { it.type == "audio" })
                .coerceAtLeast(if (localAudios.isNotEmpty()) 1 else 0)
            val vCount = event.evidence.videos.coerceAtLeast(event.evidence.files.count { it.type == "video" })
                .coerceAtLeast(if (localVideos.isNotEmpty()) 1 else 0)

            tvBadgePhotos.text = "📷 $pCount Photos"
            if (aCount > 0) {
                val dur = if (localAudios.isNotEmpty()) vaultManager.getMediaDurationSeconds(localAudios[0]) else 30L
                tvBadgeAudio.text = String.format(Locale.US, "🎤 Audio %02d:%02d", dur / 60, dur % 60)
            } else {
                tvBadgeAudio.text = "🎤 0 Audio"
            }

            if (vCount > 0) {
                val dur = if (localVideos.isNotEmpty()) vaultManager.getMediaDurationSeconds(localVideos[0]) else 30L
                tvBadgeVideo.text = String.format(Locale.US, "🎥 Video %02d:%02d", dur / 60, dur % 60)
            } else {
                tvBadgeVideo.text = "🎥 0 Video"
            }

            itemView.setOnClickListener {
                onItemClick(event)
            }

            btnDelete.setOnClickListener {
                onItemDelete(event)
            }
        }
    }
}

