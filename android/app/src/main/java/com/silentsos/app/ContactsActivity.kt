package com.silentsos.app

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.AppCompatButton
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView

class ContactsActivity : AppCompatActivity() {

    private lateinit var sessionManager: SessionManager
    private lateinit var rvContacts: RecyclerView
    private lateinit var btnAddContactHeader: ImageButton
    private lateinit var btnAddContactBottom: AppCompatButton
    private lateinit var btnBackContacts: ImageButton
    private lateinit var adapter: ContactsAdapter

    private val contactsList = mutableListOf<Contact>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_contacts)

        sessionManager = SessionManager(this)

        rvContacts = findViewById(R.id.rvContacts)
        btnAddContactHeader = findViewById(R.id.btnAddContactHeader)
        btnAddContactBottom = findViewById(R.id.btnAddContactBottom)
        btnBackContacts = findViewById(R.id.btnBackContacts)

        btnBackContacts.setOnClickListener { finish() }

        adapter = ContactsAdapter(contactsList) { position ->
            deleteContact(position)
        }

        rvContacts.layoutManager = LinearLayoutManager(this)
        rvContacts.adapter = adapter

        loadContacts()

        btnAddContactHeader.setOnClickListener { showAddContactDialog() }
        btnAddContactBottom.setOnClickListener { showAddContactDialog() }
    }

    private fun loadContacts() {
        contactsList.clear()
        contactsList.addAll(sessionManager.getContacts())
        adapter.notifyDataSetChanged()
    }

    private fun deleteContact(position: Int) {
        if (position in contactsList.indices) {
            val removed = contactsList.removeAt(position)
            sessionManager.saveContacts(contactsList)
            adapter.notifyItemRemoved(position)
            Toast.makeText(this, "Removed ${removed.name}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun showAddContactDialog() {
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(50, 40, 50, 20)
        }

        val etName = EditText(this).apply {
            hint = "Full Name"
            setSingleLine()
        }
        val etPhone = EditText(this).apply {
            hint = "Phone Number (e.g. +91 9876543210)"
            inputType = android.text.InputType.TYPE_CLASS_PHONE
            setSingleLine()
        }
        val etEmail = EditText(this).apply {
            hint = "Email Address"
            inputType = android.text.InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            setSingleLine()
        }

        layout.addView(etName)
        layout.addView(etPhone)
        layout.addView(etEmail)

        AlertDialog.Builder(this)
            .setTitle("Add Trusted Responder")
            .setView(layout)
            .setPositiveButton("Add") { _, _ ->
                val name = etName.text.toString().trim()
                val phone = etPhone.text.toString().trim()
                val email = etEmail.text.toString().trim()

                if (name.isEmpty() || phone.isEmpty()) {
                    Toast.makeText(this, "Name and Phone number are required", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }

                val newContact = Contact(
                    id = System.currentTimeMillis().toString(),
                    name = name,
                    phone = phone,
                    email = email
                )
                contactsList.add(newContact)
                sessionManager.saveContacts(contactsList)
                adapter.notifyItemInserted(contactsList.size - 1)
                Toast.makeText(this, "Added $name to emergency contacts", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}

class ContactsAdapter(
    private val items: List<Contact>,
    private val onDeleteClick: (Int) -> Unit
) : RecyclerView.Adapter<ContactsAdapter.ContactViewHolder>() {

    class ContactViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvName: TextView = view.findViewById(R.id.tvItemContactName)
        val tvPhone: TextView = view.findViewById(R.id.tvItemContactPhone)
        val tvEmail: TextView = view.findViewById(R.id.tvItemContactEmail)
        val btnDelete: ImageButton = view.findViewById(R.id.btnItemDelete)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ContactViewHolder {
        val view = LayoutInflater.from(parent.context).inflate(R.layout.item_contact, parent, false)
        return ContactViewHolder(view)
    }

    override fun onBindViewHolder(holder: ContactViewHolder, position: Int) {
        val contact = items[position]
        holder.tvName.text = contact.name
        holder.tvPhone.text = contact.phone
        holder.tvEmail.text = if (contact.email.isNotBlank()) contact.email else "No email specified"
        holder.btnDelete.setOnClickListener {
            onDeleteClick(position)
        }
    }

    override fun getItemCount(): Int = items.size
}

