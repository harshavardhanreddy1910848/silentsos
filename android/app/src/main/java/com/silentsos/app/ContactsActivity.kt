package com.silentsos.app

import android.os.Bundle
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
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

        adapter = ContactsAdapter(contactsList) { contact ->
            deleteContact(contact)
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

    private fun deleteContact(contact: Contact) {
        contactsList.remove(contact)
        sessionManager.saveContacts(contactsList)
        adapter.notifyDataSetChanged()
        Toast.makeText(this, "Removed ${contact.name}", Toast.LENGTH_SHORT).show()
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
                adapter.notifyDataSetChanged()
                Toast.makeText(this, "Added $name to emergency contacts", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
