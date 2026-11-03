/**
 * SilentSOS Intelligent AI Safety & Crisis Assistant Engine
 * Provides context-aware guidance for settings, emergency protocols,
 * sensor troubleshooting, and tactical crisis handling.
 */

export function generateAiAssistantReply({ message, user, settings, contacts = [] }) {
  const query = (message || '').trim().toLowerCase();
  const userName = user?.name || 'there';
  const contactsCount = contacts?.length || 0;
  const currentPin = settings?.safetyPin || '1234';
  const isStealthActive = !!settings?.stealthMode;

  // 1. PIN Management & Verification
  if (query.includes('pin') || query.includes('password') || query.includes('stop alert') || query.includes('cancel alert')) {
    return {
      reply: `🔒 **Safety PIN Security Protocol:**\n\n` +
        `• Your active safety PIN is **${currentPin}** (Default: 1234).\n` +
        `• **To change it:** Go to **Settings → Security & Defense PIN → Change Safety PIN**, enter your current PIN, then enter your new 4-digit code.\n` +
        `• **Why it matters:** When an emergency SOS alert is triggered, only your Safety PIN can cancel the beacon and stop notifications. This prevents an attacker from deactivating your alert.`,
      suggestions: [
        'How does Stealth Mode work?',
        'How to add emergency contacts?',
        'What happens when SOS triggers?'
      ]
    };
  }

  // 2. Stealth Mode & Disguise
  if (query.includes('stealth') || query.includes('disguise') || query.includes('black screen') || query.includes('hide')) {
    return {
      reply: `🕶️ **Stealth Mode & Tactical Disguise:**\n\n` +
        `• **Current Status:** Stealth mode is currently **${isStealthActive ? 'ENABLED' : 'DISABLED'}**.\n` +
        `• **How it works:** When Stealth Mode is ON, your phone/screen displays a completely black, inactive disguise while continuing full-power background operations.\n` +
        `• **What remains active:** High-accuracy GPS tracking, ambient microphone recording, dual camera bursts, and emergency responder dispatch continue running secretly.\n` +
        `• **How to toggle:** Turn on the toggle in **Settings → Stealth & Disguise** or on your SOS Hub console.`,
      suggestions: [
        'How to use Fake Call?',
        'How to calibrate Shake detection?',
        'How is evidence captured?'
      ]
    };
  }

  // 3. Fake Call Simulator
  if (query.includes('fake call') || query.includes('escape') || query.includes('call simulation')) {
    return {
      reply: `📞 **Fake Call Escape Simulator:**\n\n` +
        `• **Purpose:** Provides a realistic incoming call screen (e.g. from "Mom") to give you an immediate, natural excuse to leave uncomfortable, suspicious, or hostile situations.\n` +
        `• **How to test:** Tap **Settings → Fake Call Disguise → Test** on Web or **Settings → Fake Incoming Call Simulator** on the Android app.\n` +
        `• **Tip:** Practice launching it quickly so you can access it discreetly whenever intuition tells you a situation feels unsafe.`,
      suggestions: [
        'What should I do if followed?',
        'How to trigger SOS on mobile?',
        'How to test Resend email alert?'
      ]
    };
  }

  // 4. Emergency Contacts & Resend Alert Dispatch
  if (query.includes('contact') || query.includes('guardian') || query.includes('resend') || query.includes('sms') || query.includes('email alert')) {
    return {
      reply: `👥 **Emergency Contacts & Dispatch Channels:**\n\n` +
        `• You currently have **${contactsCount} trusted contact(s)** enrolled.\n` +
        `• **Adding contacts:** Open the **Contacts** tab, click **Add Guardian**, and specify their phone, email, and notification preferences (GPS, Photos, Audio, Video).\n` +
        `• **Immediate Dispatch:** Upon SOS trigger, contacts instantly receive an SMS with Google Maps coordinates and a Resend email containing your live tracking URL and recorded media.\n` +
        `• **Test Resend Email:** Tap the **Test Alert Dispatch** button inside Settings to ensure your email delivery pipeline is verified.`,
      suggestions: [
        'How to trigger SOS quickly?',
        'Explain Evidence Vault encryption',
        'How to change safety PIN?'
      ]
    };
  }

  // 5. How to Trigger SOS (Gestures, Shake, Buttons)
  if (query.includes('trigger') || query.includes('how to use') || query.includes('shake') || query.includes('gesture') || query.includes('button')) {
    return {
      reply: `🚨 **Ways to Trigger Emergency Distress:**\n\n` +
        `1. **Shake Detection (Mobile):** Rapidly shake your phone back and forth. The built-in accelerometer detects sudden high-g spikes and immediately arms distress mode.\n` +
        `2. **Hold SOS Button (Web & Mobile):** Press and hold the glowing central SOS button for 3 seconds.\n` +
        `3. **One-Tap Quick Dispatch:** Tap Medical, Fire, Police, or Danger buttons for instant categorized triage.\n` +
        `4. **Hardware Keys:** Quickly press the physical power or volume buttons repeatedly to engage background tracking.\n` +
        `5. **Camera Hand Gesture:** Show an open raised palm in the Gestures tab for contactless visual beacon arming.`,
      suggestions: [
        'What happens when SOS triggers?',
        'What is Evidence Vault?',
        'What to do in an active threat?'
      ]
    };
  }

  // 6. Evidence Vault, Photos, Video & Audio
  if (query.includes('evidence') || query.includes('photo') || query.includes('video') || query.includes('audio') || query.includes('recording') || query.includes('camera')) {
    return {
      reply: `🛡️ **Autonomous Multi-Media Evidence Vault:**\n\n` +
        `• **Dual Photographic Bursts:** Captures front and rear camera bursts stamped with live GPS coordinates, altitude, timestamp, and tamper-evident hashes.\n` +
        `• **Ambient Audio Vault:** Immediately turns on high-sensitivity microphone recording to record perpetrators and surrounding dialogue.\n` +
        `• **Video Stream Buffer:** Records rolling incident video containers.\n` +
        `• **In-App Viewer:** Go to the **Evidence** tab to inspect all past sessions, view captured photos, listen to audio playback, and view video streams.\n` +
        `• **Email Delivery:** All recorded evidence files are packaged and emailed to your emergency contacts.`,
      suggestions: [
        'How does Stealth Mode work?',
        'What are the best safety settings?',
        'How do I test my setup?'
      ]
    };
  }

  // 7. Active Threat & Crisis Advice (Stalker, Kidnap, Danger, Medical)
  if (query.includes('danger') || query.includes('followed') || query.includes('stalk') || query.includes('attack') || query.includes('threat') || query.includes('help')) {
    return {
      reply: `⚠️ **CRITICAL PERSONAL SAFETY GUIDELINES:**\n\n` +
        `1. **If being followed on foot:** Do NOT head home. Head immediately toward well-lit public areas (open stores, gas stations, police stations). Cross the street to confirm if you are followed.\n` +
        `2. **Discreetly Arm SilentSOS:** Trigger SOS or turn on **Stealth Mode** so your live GPS coordinates and audio are streaming to your guardians.\n` +
        `3. **If in a vehicle/rideshare:** Check child locks before closing doors. Share your live tracking link with a trusted contact. If the driver deviates, demand to stop in a public area.\n` +
        `4. **Enclosed / Hostile Encounter:** Keep your phone close. Do not escalate verbal conflict. Let SilentSOS record ambient audio evidence while alerting responders.\n` +
        `5. **Call Emergency Services:** In India dial **112**, in USA/Canada dial **911**, in UK dial **999**.`,
      suggestions: [
        'How to trigger Fake Call?',
        'How does Stealth Mode work?',
        'How to add emergency contacts?'
      ]
    };
  }

  // 8. Device Permissions & Sensor Troubleshooting
  if (query.includes('permission') || query.includes('gps') || query.includes('location') || query.includes('mic') || query.includes('battery')) {
    return {
      reply: `⚙️ **Device Permissions & Sensor Optimization:**\n\n` +
        `• **Location (GPS):** Ensure Location access is set to **"Allow all the time"** with **"Use precise location"** enabled.\n` +
        `• **Camera & Microphone:** Required for autonomous evidence capture during crisis mode.\n` +
        `• **Battery Optimization:** In phone settings, set SilentSOS to **"Unrestricted"** or exclude it from aggressive battery savers so background tracking and shake detection never sleep.\n` +
        `• **Notifications:** Allow high-priority alert notifications so countdowns and status indicators appear on your lockscreen.`,
      suggestions: [
        'How to calibrate Shake detection?',
        'How does Stealth Mode work?',
        'What happens when SOS triggers?'
      ]
    };
  }

  // 9. Greeting / General fallback
  return {
    reply: `👋 Hello ${userName}! I am your **SilentSOS AI Defense Assistant**.\n\n` +
      `I can help you configure your emergency settings, master crisis gestures, troubleshoot sensors, and review tactical safety advice.\n\n` +
      `**Here are some things you can ask me:**\n` +
      `• *"How does Stealth Mode work?"*\n` +
      `• *"How do I change my safety PIN?"*\n` +
      `• *"How does the app capture evidence during SOS?"*\n` +
      `• *"What should I do if someone is following me?"*\n` +
      `• *"How are emergency contacts notified?"*`,
    suggestions: [
      'How does Stealth Mode work?',
      'How to change my safety PIN?',
      'What happens when SOS triggers?',
      'Emergency safety guidelines'
    ]
  };
}

