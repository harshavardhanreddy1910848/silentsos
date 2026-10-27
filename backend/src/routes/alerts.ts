import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';
import { sendEmergencyAlertEmail, sendTestResendEmail, RESEND_API_KEY, RESEND_FROM } from '../services/emailService';
import { shouldSendToContact } from '../middleware/rateLimiter';

const router = Router();

// GET /api/alerts - Fetch all emergency alert history
router.get('/', async (req: Request, res: Response) => {
  try {
    const { profile_id } = req.query;
    let query = supabase.from('alerts').select('*').order('started_at', { ascending: false });

    if (profile_id) {
      query = query.eq('profile_id', profile_id);
    }

    const { data, error } = await query;
    if (error) {
      return res.json({ alerts: [] });
    }
    return res.json({ alerts: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts - Create new emergency alert record
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      profile_id,
      type,
      startedAt,
      status,
      gpsPath,
      photoCount,
      videoCount,
      audioCount,
      deliveries
    } = req.body;

    const { data, error } = await supabase
      .from('alerts')
      .insert([
        {
          profile_id: profile_id || '00000000-0000-0000-0000-000000000000',
          type: type || 'sos',
          started_at: new Date(startedAt || Date.now()).toISOString(),
          status: status || 'active',
          gps_path: gpsPath || [],
          photo_count: photoCount || 0,
          video_count: videoCount || 0,
          audio_count: audioCount || 0,
          deliveries: deliveries || []
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(201).json({
        alert: {
          id: `alert-${Date.now()}`,
          type,
          startedAt: Date.now(),
          status: status || 'sent',
          gpsPath,
          photoCount,
          videoCount,
          audioCount,
          deliveries
        }
      });
    }

    return res.status(201).json({ alert: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Helper to validate an email string
 */
function isValidEmail(email?: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^\S+@\S+\.\S+$/.test(email.trim());
}

export interface ContactDeliveryResult {
  contactId?: string;
  name: string;
  email: string;
  status: 'sent' | 'failed' | 'skipped';
  reason?: string;
}

/**
 * Emergency Alert Email Dispatch Handler
 * Used by POST /api/alerts/send-email and POST /api/emergency/send-alerts
 */
export async function handleEmergencyAlertDispatch(req: Request, res: Response) {
  try {
    const {
      sessionId = `SOS-${Date.now()}`,
      recipients = [],
      userName = 'SilentSOS User',
      alertType = 'sos',
      triggerGesture,
      location,
      lat = location?.latitude,
      lng = location?.longitude,
      accuracy = location?.accuracy,
      messageTemplate,
      photoDataUrl,
      photoDataUrls,
      videoDataUrl,
      audioDataUrl,
      bloodGroup,
      address,
      parentsName
    } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No emergency contacts provided for notification.'
      });
    }

    const results: ContactDeliveryResult[] = [];
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const contact of recipients) {
      const email = (contact.email || '').trim();
      const contactName = contact.name || 'Emergency Contact';
      const contactId = contact.id || email;

      // 1. Check for valid email address
      if (!isValidEmail(email)) {
        results.push({
          contactId,
          name: contactName,
          email,
          status: 'skipped',
          reason: 'No valid email address configured for this contact.'
        });
        skippedCount++;
        continue;
      }

      // 2. Duplicate SOS check (throttle rapid spam, but always permit initial dispatch & fresh evidence)
      const hasFreshMedia = Boolean(videoDataUrl || audioDataUrl);
      const allowed = shouldSendToContact(sessionId, email, hasFreshMedia ? 5000 : 15000);
      if (!allowed) {
        results.push({
          contactId,
          name: contactName,
          email,
          status: 'skipped',
          reason: 'Duplicate notification suppressed for active SOS session.'
        });
        skippedCount++;
        continue;
      }

      // 3. Dispatch Email via Resend Official API Service
      try {
        await sendEmergencyAlertEmail({
          to: email,
          recipientName: contactName,
          userName,
          alertType,
          triggerGesture,
          bloodGroup,
          address,
          parentsName,
          lat: typeof lat === 'number' ? lat : undefined,
          lng: typeof lng === 'number' ? lng : undefined,
          accuracy: typeof accuracy === 'number' ? accuracy : undefined,
          sessionId,
          messageTemplate,
          photoDataUrl,
          photoDataUrls,
          videoDataUrl,
          audioDataUrl
        });

        results.push({
          contactId,
          name: contactName,
          email,
          status: 'sent'
        });
        sentCount++;
      } catch (sendErr: any) {
        console.error(`🚨 [Alert Dispatch Error] Failed to send email to ${email}:`, sendErr.message);
        results.push({
          contactId,
          name: contactName,
          email,
          status: 'failed',
          reason: sendErr.message || 'Resend API transmission failure'
        });
        failedCount++;
      }
    }

    console.log(`📊 [SOS Session ${sessionId}] Email dispatch complete: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped.`);

    // Note: If all emails fail, we still respond with a 200/partial payload so the SOS session on frontend remains ACTIVE
    return res.json({
      success: sentCount > 0,
      sessionId,
      sentCount,
      failedCount,
      skippedCount,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('Fatal emergency alert dispatch error:', err);
    // Return 200 with error details to prevent frontend emergency crash
    return res.status(200).json({
      success: false,
      error: 'Emergency email service encountered a server exception.',
      details: err.message
    });
  }
}

// POST /api/alerts/send-email
router.post('/send-email', handleEmergencyAlertDispatch);

// POST /api/emergency/send-alerts
router.post('/send-alerts', handleEmergencyAlertDispatch);

// POST /api/alerts/test-resend - Test Resend API configuration directly
router.post('/test-resend', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const targetEmail = (email || 'sheshadriharshavardhanreddy@gmail.com').trim();

    if (!RESEND_API_KEY) {
      return res.status(400).json({
        success: false,
        error: 'RESEND_API_KEY is not configured on the server.'
      });
    }

    const result = await sendTestResendEmail(targetEmail);
    return res.json({
      success: true,
      message: `Test email successfully dispatched via Resend to ${targetEmail}`,
      sender: RESEND_FROM,
      result
    });
  } catch (err: any) {
    console.error('Error executing test Resend send:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// DELETE /api/alerts/:id - Delete an alert record
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('alerts').delete().eq('id', id);
    return res.json({ success: !error });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

