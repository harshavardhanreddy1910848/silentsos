/**
 * Professional HTML & Plain-text Email Templates for SilentSOS
 * Compatible with Gmail, Outlook, Apple Mail, and mobile email clients.
 */

export interface PasswordResetEmailOptions {
  resetUrl: string;
  resetCode: string;
  recipientEmail: string;
  expiresInMinutes?: number;
}

export interface EmergencyAlertEmailOptions {
  userName: string;
  recipientName?: string;
  alertType?: string;
  timestamp: string;
  lat?: number;
  lng?: number;
  accuracy?: number;
  sessionId?: string;
  locationUrl?: string;
  staticMapUrl?: string | null;
  message?: string;
  triggerGesture?: string;
  bloodGroup?: string;
  address?: string;
  parentsName?: string;
  hasPhotoPreview?: boolean;
  evidenceSummary?: {
    photoCount: number;
    videoCount: number;
    audioCount: number;
  };
}

/**
 * 1. Forgot Password / Password Reset Email Template
 */
export function renderPasswordResetEmail(options: PasswordResetEmailOptions): { html: string; text: string } {
  const { resetUrl, resetCode, recipientEmail, expiresInMinutes = 15 } = options;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SilentSOS - Password Reset Request</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #080a0f; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #111520; border: 1px solid #1f293d; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #ff1744 0%, #d50000 100%); padding: 28px 24px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 8px 18px; border-radius: 30px; margin-bottom: 8px;">
                      <span style="font-size: 13px; font-weight: 800; color: #ffffff; letter-spacing: 2px; text-transform: uppercase;">🛡️ Security Dispatch</span>
                    </div>
                    <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">SilentSOS</h1>
                    <p style="margin: 4px 0 0 0; font-size: 14px; color: rgba(255, 255, 255, 0.9);">Password Reset Verification</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #e2e8f0;">
                Hello,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #94a3b8;">
                We received a request to reset the password associated with your account (<strong style="color: #f1f5f9;">${recipientEmail}</strong>). To complete the password reset, click the button below:
              </p>

              <!-- Reset Button Action -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #ff1744; color: #ffffff; font-size: 16px; font-weight: 800; text-decoration: none; padding: 14px 36px; border-radius: 12px; box-shadow: 0 8px 20px rgba(255, 23, 68, 0.35); text-align: center; border: 1px solid #ff5252;">
                      Reset Password Now &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Alternative OTP Box -->
              <div style="background-color: #0b0e17; border: 1px solid #232d42; border-radius: 14px; padding: 20px; text-align: center; margin: 24px 0;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1.5px;">
                  Or use this 6-digit verification code:
                </p>
                <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #ff1744; padding: 6px 0;">
                  ${resetCode}
                </div>
              </div>

              <!-- Security Notices -->
              <div style="background-color: rgba(255, 145, 0, 0.08); border-left: 4px solid #ff9100; border-radius: 6px; padding: 14px 16px; margin: 24px 0;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #fed7aa;">
                  <strong>Security Notice:</strong> This reset link and code will expire in <strong>${expiresInMinutes} minutes</strong> and can only be used once. If you did not make this request, you can safely ignore this email — your account remains secure.
                </p>
              </div>

              <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.6; color: #64748b;">
                If the button above does not work, copy and paste this link into your web browser:<br>
                <a href="${resetUrl}" style="color: #ff5252; word-break: break-all; text-decoration: underline;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0b0e17; border-top: 1px solid #1a2233; padding: 20px 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
                Sent automatically by <strong>SilentSOS Emergency & Safety Platform</strong>.<br>
                This is an automated system email. Please do not reply directly.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `SilentSOS - Password Reset Request

Hello,

We received a request to reset the password for your account (${recipientEmail}).

You can reset your password using the link below:
${resetUrl}

Or enter your 6-digit verification code: ${resetCode}

This code and link will expire in ${expiresInMinutes} minutes.
If you did not request this password reset, please ignore this email. Your account remains secure.

--
SilentSOS Emergency & Safety Platform
`;

  return { html, text };
}

/**
 * 2. Emergency Alert Email Template
 */
export function renderEmergencyAlertEmail(options: EmergencyAlertEmailOptions): { html: string; text: string } {
  const {
    userName,
    recipientName = 'Emergency Contact',
    alertType = 'SOS',
    timestamp,
    lat,
    lng,
    accuracy,
    sessionId = `SOS-${Date.now()}`,
    locationUrl = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : undefined,
    staticMapUrl,
    message = '🚨 I need immediate help! My live location and captured evidence are attached. Please contact me or emergency services immediately.',
    triggerGesture,
    bloodGroup,
    address,
    parentsName,
    hasPhotoPreview = false,
    evidenceSummary = { photoCount: 1, videoCount: 1, audioCount: 1 }
  } = options;

  const typeUpper = alertType.toUpperCase();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🚨 SILENTSOS EMERGENCY ALERT</title>
</head>
<body style="margin: 0; padding: 0; background-color: #06070a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #ffffff;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #06070a; padding: 24px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #0f121a; border: 2px solid #ff1744; border-radius: 20px; overflow: hidden; box-shadow: 0 0 40px rgba(255, 23, 68, 0.4);">
          
          <!-- Urgent Header Banner -->
          <tr>
            <td style="background-color: #d50000; background: linear-gradient(135deg, #ff1744 0%, #b70000 100%); padding: 24px 20px; text-align: center;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center">
                    <span style="display: inline-block; background-color: #000000; color: #ffffff; font-size: 13px; font-weight: 900; letter-spacing: 2px; padding: 6px 16px; border-radius: 20px; text-transform: uppercase; margin-bottom: 8px;">
                      ⚠️ HIGH PRIORITY DISTRESS SIGNAL
                    </span>
                    <h1 style="margin: 6px 0 0 0; font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: 0.5px; text-transform: uppercase;">
                      🚨 SILENTSOS EMERGENCY ALERT
                    </h1>
                    <p style="margin: 4px 0 0 0; font-size: 15px; font-weight: 700; color: rgba(255, 255, 255, 0.95);">
                      Immediate Attention Required [Type: ${typeUpper}]
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Alert Body -->
          <tr>
            <td style="padding: 28px 24px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #e2e8f0;">
                Dear <strong>${recipientName}</strong>,
              </p>

              <div style="background-color: rgba(255, 23, 68, 0.12); border: 1px solid rgba(255, 23, 68, 0.4); border-radius: 12px; padding: 16px 18px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 17px; font-weight: 800; color: #ff5252; line-height: 1.5;">
                  <strong>${userName}</strong> has triggered an active emergency SOS alert and designated you as their trusted emergency contact.
                </p>
              </div>

              <!-- Emergency Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #171d2b; border: 1px solid #232d42; border-radius: 14px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #232d42;">
                    <strong style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Person in Distress:</strong><br>
                    <span style="font-size: 16px; font-weight: 700; color: #ffffff;">${userName}</span>
                  </td>
                </tr>
                ${triggerGesture ? `
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #232d42; background-color: rgba(0, 230, 118, 0.08);">
                    <strong style="color: #00e676; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">⚡ Alert Trigger Method:</strong><br>
                    <span style="font-size: 15px; color: #00e676; font-weight: 800;">Live Camera Gesture Detection (${triggerGesture})</span>
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #232d42;">
                    <strong style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Timestamp:</strong><br>
                    <span style="font-size: 15px; color: #ffffff;">${timestamp}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #232d42;">
                    <strong style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Emergency Session ID:</strong><br>
                    <span style="font-family: monospace; font-size: 14px; color: #38bdf8; font-weight: bold;">${sessionId}</span>
                  </td>
                </tr>
                ${bloodGroup || address || parentsName ? `
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #232d42; background-color: rgba(255, 23, 68, 0.05);">
                    <strong style="color: #ff5252; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">🩸 Medical & Emergency Identity:</strong><br>
                    ${bloodGroup ? `<div style="margin-top: 6px; font-size: 14px; color: #ffffff;"><strong>Blood Group:</strong> <span style="background-color: #ff1744; color: #fff; padding: 2px 8px; border-radius: 4px; font-weight: 800;">${bloodGroup}</span></div>` : ''}
                    ${parentsName ? `<div style="margin-top: 4px; font-size: 14px; color: #e2e8f0;"><strong>Parents / Guardian:</strong> ${parentsName}</div>` : ''}
                    ${address ? `<div style="margin-top: 4px; font-size: 14px; color: #e2e8f0;"><strong>Residential Address:</strong> ${address}</div>` : ''}
                  </td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 16px 20px;">
                    <strong style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Distress Message:</strong><br>
                    <span style="font-size: 15px; color: #f8fafc; font-style: italic;">"${message}"</span>
                  </td>
                </tr>
              </table>

              <!-- GPS Location Section -->
              ${
                lat && lng
                  ? `
              <div style="background-color: #0b1e16; border: 1px solid #00e676; border-radius: 14px; padding: 20px; margin-bottom: 24px;">
                <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #00e676; text-transform: uppercase; letter-spacing: 1.5px;">
                  📍 Live GPS Coordinates & Location
                </p>
                <p style="margin: 0 0 6px 0; font-size: 15px; font-family: monospace; color: #ffffff;">
                  <strong>Latitude:</strong> ${lat} &nbsp;|&nbsp; <strong>Longitude:</strong> ${lng}
                </p>
                ${accuracy ? `<p style="margin: 0 0 14px 0; font-size: 13px; color: #86efac;">Accuracy: &plusmn;${Math.round(accuracy)} meters</p>` : '<div style="height: 10px;"></div>'}

                ${
                  staticMapUrl
                    ? `
                <div style="margin: 12px 0; text-align: center;">
                  <a href="${locationUrl}" target="_blank">
                    <img src="${staticMapUrl}" alt="Google Map Location" style="width: 100%; max-width: 520px; border-radius: 8px; border: 1px solid #00e676;" />
                  </a>
                </div>
                `
                    : ''
                }

                <div style="text-align: center; margin-top: 14px;">
                  <a href="${locationUrl}" target="_blank" style="display: inline-block; background-color: #00e676; color: #000000; font-size: 15px; font-weight: 900; text-decoration: none; padding: 12px 28px; border-radius: 10px; box-shadow: 0 4px 16px rgba(0, 230, 118, 0.3);">
                    🗺️ View Interactive Location on Google Maps &rarr;
                  </a>
                </div>
              </div>
              `
                  : `
              <div style="background-color: #171d2b; border: 1px solid #334155; border-radius: 14px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 14px; color: #94a3b8;">
                  📍 GPS coordinates were unavailable at the precise moment of dispatch.
                </p>
              </div>
              `
              }

              <!-- Inline Captured Photo Card -->
              ${
                hasPhotoPreview
                  ? `
              <div style="background-color: #171d2b; border: 1px solid #ff1744; border-radius: 14px; padding: 18px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0 0 10px 0; font-size: 12px; font-weight: 800; color: #ff5252; text-transform: uppercase; letter-spacing: 1px;">
                  📸 Live Captured Incident Snapshot:
                </p>
                <img src="cid:emergency_photo_preview" alt="Emergency Snapshot" style="width: 100%; max-width: 520px; border-radius: 10px; border: 1px solid rgba(255, 23, 68, 0.4); display: inline-block;" />
              </div>
              `
                  : ''
              }

              <!-- Evidence Summary Card -->
              <div style="background-color: #171d2b; border: 1px solid #232d42; border-radius: 14px; padding: 18px; margin-bottom: 24px;">
                <p style="margin: 0 0 12px 0; font-size: 12px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">
                  📁 Incident Evidence Attached in this Email:
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="font-size: 14px; color: #cbd5e1; padding: 6px 0;">📸 Camera Photos:</td>
                    <td align="right" style="font-size: 14px; font-weight: bold; color: #38bdf8;">${evidenceSummary.photoCount} Photos Attached</td>
                  </tr>
                  <tr>
                    <td style="font-size: 14px; color: #cbd5e1; padding: 6px 0;">🎥 Video Recording:</td>
                    <td align="right" style="font-size: 14px; font-weight: bold; color: ${evidenceSummary.videoCount > 0 ? '#00e676' : '#94a3b8'};">
                      ${evidenceSummary.videoCount > 0 ? '✓ Live Video File Attached' : 'None'}
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size: 14px; color: #cbd5e1; padding: 6px 0;">🎙️ Microphone Sound:</td>
                    <td align="right" style="font-size: 14px; font-weight: bold; color: ${evidenceSummary.audioCount > 0 ? '#00e676' : '#94a3b8'};">
                      ${evidenceSummary.audioCount > 0 ? '✓ Ambient Audio Sound Attached' : 'None'}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Action Guidelines -->
              <div style="background-color: rgba(255, 23, 68, 0.08); border-left: 4px solid #ff1744; border-radius: 6px; padding: 14px 16px;">
                <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: bold; color: #ff5252;">
                  RECOMMENDED ACTIONS:
                </p>
                <ol style="margin: 0; padding-left: 18px; font-size: 13px; color: #e2e8f0; line-height: 1.6;">
                  <li>Attempt to contact ${userName} immediately.</li>
                  <li>Check their live location via the Google Maps link above.</li>
                  <li>If they are unresponsive or in danger, contact local emergency services (e.g. 911 / 112 / 100) and provide their GPS coordinates and Session ID.</li>
                </ol>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0b0e17; border-top: 1px solid #1a2233; padding: 18px 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                Sent automatically by <strong>SilentSOS Emergency Dispatch Network</strong> at ${timestamp}.<br>
                Session ID: ${sessionId}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `🚨 SILENTSOS EMERGENCY ALERT - Immediate Attention Required

An emergency alert has been triggered by ${userName}.

Person in Distress: ${userName}
Time: ${timestamp}
Alert Type: ${typeUpper}
${triggerGesture ? `Alert Trigger Method: Live Camera Gesture Detection (${triggerGesture})\n` : ''}${bloodGroup ? `Blood Group: ${bloodGroup}\n` : ''}${parentsName ? `Parents / Guardian: ${parentsName}\n` : ''}${address ? `Residential Address: ${address}\n` : ''}Emergency Session ID: ${sessionId}
Distress Message: "${message}"

${lat && lng ? `Location: Latitude ${lat}, Longitude ${lng}${accuracy ? ` (Accuracy: ±${Math.round(accuracy)}m)` : ''}\nView Location on Google Maps: ${locationUrl}` : 'Location: GPS coordinates unavailable.'}

RECOMMENDED ACTIONS:
1. Attempt to contact ${userName} immediately.
2. Check their live location on Google Maps.
3. If necessary, contact emergency services and provide the GPS coordinates and Session ID above.

--
SilentSOS Emergency Dispatch Network
`;

  return { html, text };
}

export interface TokenAuthEmailOptions {
  tokenUrl: string;
  authCode: string;
  recipientEmail: string;
  userName?: string;
  expiresInMinutes?: number;
}

/**
 * 3. Token Authentication / Magic Link Login Email Template
 */
export function renderTokenAuthEmail(options: TokenAuthEmailOptions): { html: string; text: string } {
  const { tokenUrl, authCode, recipientEmail, userName = 'User', expiresInMinutes = 15 } = options;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SilentSOS - Instant Token Authentication</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #080a0f; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #111520; border: 1px solid #1f293d; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #00e676 0%, #00b0ff 100%); padding: 28px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #080a0f; letter-spacing: 1px;">
                ⚡ SILENTSOS TOKEN ACCESS
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 14px; font-weight: 800; color: rgba(8, 10, 15, 0.85); text-transform: uppercase;">
                Secure One-Time Token Authentication
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #e2e8f0;">
                Hello <strong>${userName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; color: #94a3b8; line-height: 1.6;">
                We received a token authentication request for your SilentSOS account (<strong>${recipientEmail}</strong>). Click the button below to sign in instantly, or enter your 6-digit access code in the web app:
              </p>

              <!-- One-Click Login Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${tokenUrl}" target="_blank" style="display: inline-block; background-color: #00e676; color: #080a0f; font-size: 16px; font-weight: 900; padding: 16px 36px; border-radius: 12px; text-decoration: none; letter-spacing: 0.5px; box-shadow: 0 4px 16px rgba(0, 230, 118, 0.4);">
                      Sign In Instantly to Web App →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- 6-Digit Code Card -->
              <div style="background-color: #171d2b; border: 1px dashed #00e676; border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px;">
                  Or Enter Your 6-Digit Verification Code
                </p>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #00e676;">
                  ${authCode}
                </div>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">
                  Expires in ${expiresInMinutes} minutes • Single-use security token
                </p>
              </div>

              <p style="margin: 0 0 16px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                If you did not request this token, you can safely ignore this email. Your account remains protected.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0b0e17; border-top: 1px solid #1a2233; padding: 18px 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                SilentSOS Emergency Safety Platform • Resend Official Delivery Network
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `SILENTSOS - SECURE TOKEN AUTHENTICATION

Hello ${userName},

A secure login token has been requested for your SilentSOS account (${recipientEmail}).

Your 6-Digit Authentication Code: ${authCode}

Or click this link to sign in directly:
${tokenUrl}

This token will expire in ${expiresInMinutes} minutes and can only be used once.

--
SilentSOS Safety System
`;

  return { html, text };
}

