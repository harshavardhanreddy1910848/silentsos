// Native fetch is available globally in Node.js v18+
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BACKEND_URL = 'http://localhost:3001';

async function runTest() {
  console.log('--- STARTING 3-PHASE EMAIL DISPATCH VERIFICATION ---');

  // Step 1: Login to get token
  console.log('\n[Step 1] Logging in...');
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'harshavardhanreddy1910848@gmail.com',
      password: '123456'
    })
  });

  if (!loginRes.ok) {
    console.error('❌ Login failed:', await loginRes.text());
    process.exit(1);
  }

  const { token, user } = await loginRes.json();
  console.log(`✅ Logged in successfully as User ID: ${user.id} (${user.name})`);
  console.log(`Token acquired: ${token.substring(0, 15)}...`);

  // Step 2: Trigger Alert (Email 1)
  console.log('\n[Step 2] Triggering alert (Email 1 - Initial Warning)...');
  const triggerRes = await fetch(`${BACKEND_URL}/api/alerts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      type: 'Test Distress Alert',
      location: { 
        lat: 12.9716, 
        lng: 77.5946,
        googleMapsLink: 'https://maps.google.com/?q=12.9716,77.5946',
        timestamp: Date.now()
      }
    })
  });

  if (!triggerRes.ok) {
    console.error('❌ Trigger failed:', await triggerRes.text());
    process.exit(1);
  }

  const alert = await triggerRes.json();
  const alertId = alert.id;
  console.log(`✅ Alert triggered successfully! Alert ID: ${alertId}`);
  console.log('📨 Check server logs: Email 1 should be dispatched immediately.');

  // Step 3: Simulate upload of evidence files
  console.log('\n[Step 3] Simulating evidence file uploads...');
  
  // We can write fake test evidence file content
  const uploadsDir = path.join(__dirname, 'evidence');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Define some mock files to register in the alert
  const mockFiles = [
    { type: 'photo', url: `/evidence/${alertId}-photo-mock.jpg` },
    { type: 'audio', url: `/evidence/${alertId}-audio-mock.webm` },
    { type: 'video', url: `/evidence/${alertId}-video-mock.webm` }
  ];

  // Physically write dummy files to avoid file-not-found errors during email attachment building
  mockFiles.forEach(file => {
    const filename = path.basename(file.url);
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, 'Mock evidence file content.');
    console.log(`   Written dummy evidence file to disk: ${filename}`);
  });

  // Call the backend endpoint to add evidence files to the alert
  // (We do this by directly updating history in DB or calling a mock evidence update.
  // Actually, we can use the backend `/api/alerts/:id/evidence` endpoint,
  // but since we just want to test email sending, we can write them directly to DB
  // or simulate it. Wait! The `/api/alerts/:id/evidence` expects a multipart file upload,
  // we can use standard multipart-form-data or we can just append to db JSON directly to keep it simple,
  // or we can test the real upload endpoint.
  // Let's use db.updateHistoryEvent in a small script, or let's use the real API!
  // Wait, let's just use the multipart-form-data using a form-data npm package? node-fetch v2 doesn't have FormData by default,
  // but we can mock it by importing FormData if we had it, or we can just use the db helper directly.
  // Since db.js is exported, we can just load db.js directly in our test script and mutate the entry, then trigger complete!
  // Yes! That's incredibly elegant and avoids multipart packages.)
  console.log('   Registering mock evidence in database...');
  const { db } = await import('./db.js');
  const alertState = (await db.getAllHistory()).find(e => e.id === alertId);
  if (alertState) {
    alertState.evidence = {
      photos: 1,
      videos: 1,
      audio: 1,
      files: mockFiles
    };
    await db.updateHistoryEvent(alertId, { evidence: alertState.evidence });
    console.log('✅ Evidence files registered successfully in database.');
  } else {
    console.error('❌ Could not find alert in database.');
    process.exit(1);
  }

  // Step 4: Complete alert capturing (Email 2)
  console.log('\n[Step 4] Signaling capture completion (Email 2 - Evidence Package)...');
  const completeRes = await fetch(`${BACKEND_URL}/api/alerts/${alertId}/complete`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!completeRes.ok) {
    console.error('❌ Complete failed:', await completeRes.text());
    process.exit(1);
  }

  console.log('✅ Complete endpoint returned status OK.');
  console.log('📨 Check server logs: Email 2 (with attached files) should be dispatched now.');

  // Step 5: Cancel Alert (Email 3)
  console.log('\n[Step 5] Triggering alert cancellation (Email 3 - Cancel notification)...');
  const cancelRes = await fetch(`${BACKEND_URL}/api/alerts/${alertId}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!cancelRes.ok) {
    console.error('❌ Cancel failed:', await cancelRes.text());
    process.exit(1);
  }

  console.log('✅ Cancel endpoint returned status OK.');
  console.log('📨 Check server logs: Email 3 should be dispatched immediately.');

  console.log('\n--- ALL TEST PHASES CALLED SUCCESSFULLY! ---');
  console.log('Check your email inbox at harshavardhanreddy1910848@gmail.com.');
}

runTest().catch(console.error);
