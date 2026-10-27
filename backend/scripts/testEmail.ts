import dotenv from 'dotenv';
import { verifyResendConnection, sendPasswordResetEmail, sendEmergencyAlertEmail, sendTestResendEmail } from '../src/services/emailService';

dotenv.config();

async function runResendDiagnostic() {
  console.log('====================================================');
  console.log('  SilentSOS Resend Official API Diagnostic & Test   ');
  console.log('====================================================\n');

  console.log('Configured Resend Parameters:');
  console.log(`- RESEND_API_KEY: ${process.env.RESEND_API_KEY ? 'Configured (Active)' : 'Missing'}`);
  console.log(`- RESEND_FROM: ${process.env.RESEND_FROM}`);
  console.log(`- FRONTEND_URL: ${process.env.FRONTEND_URL}\n`);

  await verifyResendConnection();

  const targetEmail = 'sheshadriharshavardhanreddy@gmail.com';

  console.log(`\n🧪 Testing Resend API Direct Dispatch to: ${targetEmail}...`);
  try {
    const res = await sendTestResendEmail(targetEmail);
    console.log('✅ Resend test email dispatch successful:', res);
  } catch (err: any) {
    console.warn('⚠️ Resend test notice:', err.message);
  }

  console.log(`\n🧪 Testing Password Reset Email Dispatch to: ${targetEmail}...`);
  try {
    const res1 = await sendPasswordResetEmail({
      to: targetEmail,
      token: 'test-cryptographic-token-1234567890abcdef',
      resetCode: '849201',
      expiresInMinutes: 15
    });
    console.log('✅ Password reset email dispatch test completed:', res1);
  } catch (err: any) {
    console.warn('⚠️ Password reset test notice:', err.message);
  }

  console.log(`\n🧪 Testing Full Emergency SOS Alert (Photos + Video + Audio + Location) to: ${targetEmail}...`);
  try {
    // 1x1 test JPEG data URI
    const testPhotoDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
    // Small valid WAV audio data URI
    const testAudioDataUrl = 'data:audio/wav;base64,UklGRjAAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    // Small valid WebM video data URI
    const testVideoDataUrl = 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAHTEU2bmfsggAEAAAAAAAA0m5mZBgEAAAAAAACFkXN1cABhgQhChYEDZ3VpZAGCh4EDm1Mu3A==';

    const res2 = await sendEmergencyAlertEmail({
      to: targetEmail,
      recipientName: 'Primary Contact',
      userName: 'Harshavardhan (SilentSOS User)',
      alertType: 'sos',
      triggerGesture: 'Raised palm / wave',
      lat: 13.0827,
      lng: 80.2707,
      accuracy: 12,
      sessionId: `TEST-SOS-${Date.now()}`,
      messageTemplate: '🚨 TEST EMERGENCY: Live photos, video, audio sound, and location dispatched via Resend Official API.',
      photoDataUrl: testPhotoDataUrl,
      photoDataUrls: [testPhotoDataUrl],
      videoDataUrl: testVideoDataUrl,
      audioDataUrl: testAudioDataUrl,
      bloodGroup: 'O+',
      address: 'Test Location, Bengaluru'
    });
    console.log('✅ Full Emergency alert email with Photos, Video, Audio, & GPS dispatched successfully:', res2);
  } catch (err: any) {
    console.warn('⚠️ Emergency alert test notice:', err.message);
  }

  console.log('\n====================================================');
  console.log('  SilentSOS Resend API Verification Complete!       ');
  console.log('====================================================\n');
}

runResendDiagnostic();
