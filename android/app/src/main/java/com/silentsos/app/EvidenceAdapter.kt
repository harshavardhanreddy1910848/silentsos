package com.silentsos.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class EvidenceAdapter(
    private var events: List<AlertEvent>,
    private val onItemClick: (AlertEvent) -> Unit
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

        fun bind(event: AlertEvent) {
            tvTitle.text = "${event.type} Evidence Session"
            tvDate.text = dateFormat.format(Date(event.timestamp))
            tvLocation.text = "📍 ${String.format(Locale.US, "%.4f", event.lat)}° N, ${String.format(Locale.US, "%.4f", event.lng)}° E ${if (event.address.isNotBlank()) "(${event.address})" else ""}"

            val pCount = event.evidence.photos.coerceAtLeast(event.evidence.files.count { it.type == "photo" })
            val aCount = event.evidence.audio.coerceAtLeast(event.evidence.files.count { it.type == "audio" })
            val vCount = event.evidence.videos.coerceAtLeast(event.evidence.files.count { it.type == "video" })

            tvBadgePhotos.text = "📷 $pCount Photos"
            tvBadgeAudio.text = "🎤 $aCount Audio"
            tvBadgeVideo.text = "🎥 $vCount Video"

            itemView.setOnClickListener {
                onItemClick(event)
            }
        }
    }
}

