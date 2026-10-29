package com.silentsos.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.recyclerview.widget.RecyclerView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class HistoryAdapter(
    private var events: List<AlertEvent>,
    private val onItemClick: (AlertEvent) -> Unit
) : RecyclerView.Adapter<HistoryAdapter.HistoryViewHolder>() {

    private val dateFormat = SimpleDateFormat("MMM d, yyyy h:mm a", Locale.getDefault())

    fun updateData(newEvents: List<AlertEvent>) {
        events = newEvents
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): HistoryViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_history, parent, false)
        return HistoryViewHolder(view)
    }

    override fun onBindViewHolder(holder: HistoryViewHolder, position: Int) {
        val event = events[position]
        holder.bind(event)
    }

    override fun getItemCount(): Int = events.size

    inner class HistoryViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvType: TextView = itemView.findViewById(R.id.tvHistType)
        private val tvStatus: TextView = itemView.findViewById(R.id.tvHistStatus)
        private val tvTime: TextView = itemView.findViewById(R.id.tvHistTime)
        private val tvCoords: TextView = itemView.findViewById(R.id.tvHistCoords)
        private val tvSummary: TextView = itemView.findViewById(R.id.tvHistEvidenceSummary)
        private val btnCopyLink: TextView = itemView.findViewById(R.id.btnHistCopyLink)

        fun bind(event: AlertEvent) {
            tvType.text = "🚨 ${event.type} Dispatch"
            tvStatus.text = event.status
            tvTime.text = dateFormat.format(Date(event.timestamp))
            tvCoords.text = "📍 ${String.format(Locale.US, "%.4f", event.lat)}° N, ${String.format(Locale.US, "%.4f", event.lng)}° E"

            val p = event.evidence.photos.coerceAtLeast(event.evidence.files.count { it.type == "photo" })
            val a = event.evidence.audio.coerceAtLeast(event.evidence.files.count { it.type == "audio" })
            tvSummary.text = "Evidence: $p photos, $a audio memo(s)"

            btnCopyLink.setOnClickListener {
                val url = "https://silentsos-rose.vercel.app/receiver/${event.id}"
                val clipboard = itemView.context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                val clip = ClipData.newPlainText("Receiver URL", url)
                clipboard.setPrimaryClip(clip)
                Toast.makeText(itemView.context, "Receiver link copied to clipboard!", Toast.LENGTH_SHORT).show()
            }

            itemView.setOnClickListener {
                onItemClick(event)
            }
        }
    }
}

