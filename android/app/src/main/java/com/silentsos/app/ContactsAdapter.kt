package com.silentsos.app

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.recyclerview.widget.RecyclerView

class ContactsAdapter(
    private var contacts: List<Contact>,
    private val onDeleteClick: (Contact) -> Unit
) : RecyclerView.Adapter<ContactsAdapter.ContactViewHolder>() {

    fun updateData(newContacts: List<Contact>) {
        contacts = newContacts
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ContactViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_contact, parent, false)
        return ContactViewHolder(view)
    }

    override fun onBindViewHolder(holder: ContactViewHolder, position: Int) {
        val contact = contacts[position]
        holder.bind(contact)
    }

    override fun getItemCount(): Int = contacts.size

    inner class ContactViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val tvName: TextView = itemView.findViewById(R.id.tvItemContactName)
        private val tvPhone: TextView = itemView.findViewById(R.id.tvItemContactPhone)
        private val tvEmail: TextView = itemView.findViewById(R.id.tvItemContactEmail)
        private val tvRelationship: TextView = itemView.findViewById(R.id.tvItemRelationship)
        private val tvPrimary: TextView = itemView.findViewById(R.id.tvItemPrimary)
        private val btnDelete: ImageView = itemView.findViewById(R.id.btnItemDelete)

        fun bind(contact: Contact) {
            tvName.text = contact.name
            tvPhone.text = contact.phone.ifEmpty { "No phone registered" }
            tvEmail.text = contact.email.ifEmpty { "No email registered" }
            tvRelationship.text = contact.relationship
            tvPrimary.visibility = if (contact.isPrimary) View.VISIBLE else View.GONE

            btnDelete.setOnClickListener {
                onDeleteClick(contact)
            }
        }
    }
}
