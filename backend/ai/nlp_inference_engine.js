import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_PATH = path.join(__dirname, 'trained_model.json');

// Stopwords list
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'could', 'did', 'do', 'does', 'doing', 'down', 'during',
  'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself',
  'me', 'more', 'most', 'my', 'myself',
  'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very',
  'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would',
  'you', 'your', 'yours', 'yourself', 'yourselves'
]);

let cachedModel = null;

function loadModel() {
  if (cachedModel) return cachedModel;
  if (!fs.existsSync(MODEL_PATH)) {
    return { documents: [], idf: {} };
  }
  try {
    const raw = fs.readFileSync(MODEL_PATH, 'utf8');
    cachedModel = JSON.parse(raw);
    return cachedModel;
  } catch (_) {
    return { documents: [], idf: {} };
  }
}

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  const clean = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.split(' ').filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function extractBigrams(tokens) {
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return bigrams;
}

// ============================================================================
// 🧠 CONVERSATION CONTEXT & TOPIC MEMORY RESOLUTION
// ============================================================================
function resolveConversationContext(history = [], currentQuery = '') {
  if (!history || history.length === 0) {
    return { lastTopic: null, isFollowUp: false, mergedQuery: currentQuery };
  }

  // Look back through the last 4 exchanges
  const recentExchanges = history.slice(-6);
  let detectedTopic = null;

  for (let i = recentExchanges.length - 1; i >= 0; i--) {
    const text = (recentExchanges[i].text || recentExchanges[i].content || '').toLowerCase();
    if (text.includes('travel') || text.includes('trip') || text.includes('hotel') || text.includes('solo')) {
      detectedTopic = 'travelling_safety';
      break;
    }
    if (text.includes('follow') || text.includes('stalk') || text.includes('pursuit') || text.includes('behind me')) {
      detectedTopic = 'stalking_evasion';
      break;
    }
    if (text.includes('unsafe') || text.includes('danger') || text.includes('scared') || text.includes('panic') || text.includes('threat')) {
      detectedTopic = 'immediate_danger';
      break;
    }
    if (text.includes('cpr') || text.includes('heart') || text.includes('chok') || text.includes('burn') || text.includes('bleed') || text.includes('first aid')) {
      detectedTopic = 'medical_first_aid';
      break;
    }
    if (text.includes('python') || text.includes('code') || text.includes('asyncio') || text.includes('kotlin') || text.includes('javascript') || text.includes('react')) {
      detectedTopic = 'programming_technology';
      break;
    }
    if (text.includes('fir') || text.includes('police') || text.includes('legal') || text.includes('rights') || text.includes('law')) {
      detectedTopic = 'legal_rights';
      break;
    }
    if (text.includes('stealth') || text.includes('pin') || text.includes('gesture') || text.includes('fake call')) {
      detectedTopic = 'silentsos_controls';
      break;
    }
    if (text.includes('harass') || text.includes('abuse') || text.includes('domestic') || text.includes('violence') || text.includes('women')) {
      detectedTopic = 'harassment_women_safety';
      break;
    }
    if (text.includes('cyber') || text.includes('hack') || text.includes('scam') || text.includes('blackmail')) {
      detectedTopic = 'cyber_security';
      break;
    }
  }

  const lowerQ = currentQuery.toLowerCase().trim();
  const isFollowUpPattern = /^(what about|how about|and|what if|what should i avoid|can you explain more|tell me more|how do i do that|is that legal|what are the tips|how to handle that|why|how|what else|any examples|how to do it)\b/i.test(lowerQ)
    || (lowerQ.length < 35 && (lowerQ.includes('at night') || lowerQ.includes('in a cab') || lowerQ.includes('taxi') || lowerQ.includes('alone') || lowerQ.includes('for women') || lowerQ.includes('if they don') || lowerQ.includes('they don\'t stop') || lowerQ.includes('don\'t stop')));

  let mergedQuery = currentQuery;
  if (isFollowUpPattern && detectedTopic) {
    if (detectedTopic === 'travelling_safety' && (lowerQ.includes('night') || lowerQ.includes('dark'))) {
      mergedQuery = `travel safety at night ${currentQuery}`;
    } else if (detectedTopic === 'travelling_safety' && (lowerQ.includes('cab') || lowerQ.includes('taxi') || lowerQ.includes('uber') || lowerQ.includes('ola'))) {
      mergedQuery = `travel cab taxi safety ${currentQuery}`;
    } else if (detectedTopic === 'stalking_evasion' && (lowerQ.includes('stop') || lowerQ.includes('confront') || lowerQ.includes('approach'))) {
      mergedQuery = `stalker will not stop following me ${currentQuery}`;
    } else {
      mergedQuery = `${detectedTopic.replace(/_/g, ' ')} ${currentQuery}`;
    }
  }

  return {
    lastTopic: detectedTopic,
    isFollowUp: isFollowUpPattern && !!detectedTopic,
    mergedQuery
  };
}

// ============================================================================
// 🚨 NEARBY EMERGENCY SERVICES & FACILITY LOCATIONS (POLICE & HOSPITALS)
// ============================================================================
export function handleNearbyEmergencyLocations(lowerQuery, rawQuery, location = null) {
  const norm = lowerQuery.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');

  // Robust matching for police (including typos like 'policesttion')
  const hasPolice = /police|policesttion|policestation|cop|cops|thana|chowki|patrol/i.test(norm);
  // Robust matching for hospital (including typos like 'hospital', 'medical', 'clinic')
  const hasHospital = /hospital|hospitals|clinic|doctor|medical|emergency room|trauma|dispensary/i.test(norm);
  // Match intent for location/proximity/finding
  const hasLocationIntent = /near|nearby|closest|close|location|locations|where|find|direction|directions|route|address|map|maps|reach/i.test(norm)
    || norm.includes('nearest') || norm.includes('closest');

  if (!hasLocationIntent && !norm.includes('police station') && !norm.includes('hospital')) {
    return { matched: false };
  }

  if (!hasPolice && !hasHospital) {
    return { matched: false };
  }

  const lat = location?.lat || location?.latitude;
  const lng = location?.lng || location?.longitude;
  const hasCoords = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng);

  const policeSearchUrl = hasCoords
    ? `https://www.google.com/maps/search/police+station/@${lat},${lng},15z`
    : `https://www.google.com/maps/search/police+station+near+me`;
  const policeNavUrl = `https://www.google.com/maps/dir/?api=1&destination=police+station`;

  const hospitalSearchUrl = hasCoords
    ? `https://www.google.com/maps/search/hospitals+near+me/@${lat},${lng},15z`
    : `https://www.google.com/maps/search/hospitals+near+me`;
  const hospitalNavUrl = `https://www.google.com/maps/dir/?api=1&destination=hospital`;

  // Combined Police + Hospital Request
  if (hasPolice && hasHospital) {
    return {
      matched: true,
      intent: 'emergency_facility_locations_combined',
      category: 'Emergency Locations & Facilities',
      reply: `🚨 **Nearby Emergency Facilities: Police Stations & 24/7 Hospitals**\n\n` +
        (hasCoords ? `📍 *Using your live device coordinates (${lat.toFixed(4)}°, ${lng.toFixed(4)}°):*\n\n` : `📍 *Opening your real-time GPS location via Google Maps:*\n\n`) +
        `### 🚔 1. Nearest Police Stations:\n` +
        `• **Live Map Search:** [📍 Open Police Stations Near You in Google Maps](${policeSearchUrl})\n` +
        `• **Direct Navigation:** [🧭 Get Turn-by-Turn Route to Closest Police Station](${policeNavUrl})\n` +
        `• **Emergency Phone:** Dial **112** (Universal Emergency) or **100** for immediate police dispatch.\n` +
        `• **Women's Police Helpline:** Dial **1091** (24/7 toll-free).\n\n` +
        `### 🏥 2. Nearest 24/7 Hospitals & Trauma Centers:\n` +
        `• **Live Map Search:** [🏥 Open Emergency Hospitals Near You in Google Maps](${hospitalSearchUrl})\n` +
        `• **Direct Navigation:** [🧭 Get Turn-by-Turn Route to Closest Hospital](${hospitalNavUrl})\n` +
        `• **Ambulance Dispatch:** Dial **108** or **102** for priority emergency medical ambulance transport.\n\n` +
        `### 🛡️ Critical Safety Precautions:\n` +
        `1. **If Actively Pursued or Unsafe:** Head towards the nearest police station along lit, populated streets. Share your live location with your emergency contacts via SilentSOS.\n` +
        `2. **If Experiencing Severe Medical Distress:** Request ambulance dispatch immediately via **108** or **112** rather than driving unassisted.\n` +
        `3. **SilentSOS Telemetry:** Keep live tracking activated so guardians can follow your real-time journey.`,
      suggestions: [
        'How do I call 112 emergency dispatch?',
        'What should I do if someone is following me?',
        'How does Stealth Mode work in SilentSOS?'
      ]
    };
  }

  // Police Station Only
  if (hasPolice) {
    return {
      matched: true,
      intent: 'police_station_locations',
      category: 'Emergency Law Enforcement Locations',
      reply: `🚔 **Nearest Police Stations & Law Enforcement Centers:**\n\n` +
        (hasCoords ? `📍 *Using your live GPS location (${lat.toFixed(4)}°, ${lng.toFixed(4)}°):*\n\n` : `📍 *Opening your real-time location via Google Maps:*\n\n`) +
        `• **Live Map Search:** [📍 Click Here: View Nearest Police Stations on Google Maps](${policeSearchUrl})\n` +
        `• **Turn-by-Turn Directions:** [🧭 Start Navigation to Nearest Police Station](${policeNavUrl})\n\n` +
        `### 📞 Emergency Dispatch Numbers:\n` +
        `• **112:** All-in-One Universal Police & Disaster Response.\n` +
        `• **100:** National Police Emergency Control Room.\n` +
        `• **1091:** 24/7 Dedicated Women's Police Helpline.\n\n` +
        `### 🛡️ Tactical Safety Tips When Moving to Police Station:\n` +
        `1. **Stick to Illuminated Roads:** Never take dark shortcuts or unlit alleys.\n` +
        `2. **Stay on the Line:** Call **112** or a trusted guardian contact and keep them on speaker while walking or driving.\n` +
        `3. **Your Legal Right:** Under BNSS Section 173 (**Zero FIR**), any police station in India is legally mandated to accept your complaint regardless of jurisdictional boundaries.`,
      suggestions: [
        'What is a Zero FIR in India?',
        'What should I do if someone is following me?',
        'How does live GPS tracking broadcast to guardians?'
      ]
    };
  }

  // Hospital Only
  return {
    matched: true,
    intent: 'hospital_locations',
    category: 'Emergency Medical Care Locations',
    reply: `🏥 **Nearest 24/7 Hospitals & Emergency Trauma Centers:**\n\n` +
      (hasCoords ? `📍 *Using your live GPS location (${lat.toFixed(4)}°, ${lng.toFixed(4)}°):*\n\n` : `📍 *Opening your real-time location via Google Maps:*\n\n`) +
      `• **Live Map Search:** [🏥 Click Here: View Nearest Hospitals & Emergency Rooms on Google Maps](${hospitalSearchUrl})\n` +
      `• **Turn-by-Turn Directions:** [🧭 Start Navigation to Nearest Hospital](${hospitalNavUrl})\n\n` +
      `### 📞 Emergency Medical Helplines:\n` +
      `• **108:** Free 24/7 National Emergency Ambulance & Trauma Dispatch.\n` +
      `• **102:** Specialized Maternity, Infant & Medical Patient Transport.\n` +
      `• **112:** Universal Emergency Dispatch for critical medical coordination.\n\n` +
      `### 🩺 Urgent First Aid Advice:\n` +
      `• **Severe Bleeding:** Apply direct, firm pressure on the wound using a clean cloth until medical personnel take over.\n` +
      `• **Chest Pain / Collapse:** Begin immediate hands-only CPR (100–120 compressions per minute) and dial 108 immediately.\n` +
      `• If moving independently is hazardous, stay stationary and wait for the ambulance crew.`,
    suggestions: [
      'How do I perform CPR on an adult?',
      'How to treat severe bleeding?',
      'How does live GPS tracking work in SilentSOS?'
    ]
  };
}

// ============================================================================
// 1. TACTICAL PERSONAL DEFENSE & CRISIS INTELLIGENCE
// ============================================================================
function handleTacticalSafety(lowerQuery, rawQuery, context, userName, settings) {
  const isNightTravel = lowerQuery.includes('travelling at night') || lowerQuery.includes('traveling at night') || lowerQuery.includes('travel at night') || (context.lastTopic === 'travelling_safety' && (lowerQuery.includes('night') || lowerQuery.includes('dark')));
  const isSoloTravel = !isNightTravel && (lowerQuery.includes('travel') || lowerQuery.includes('travelling') || lowerQuery.includes('traveling') || lowerQuery.includes('trip') || lowerQuery.includes('solo travel') || lowerQuery.includes('hotel'));
  const isFollowing = lowerQuery.includes('following me') || lowerQuery.includes('someone following') || lowerQuery.includes('being followed') || lowerQuery.includes('stalk') || lowerQuery.includes('tailing me') || lowerQuery.includes('pursued') || (context.lastTopic === 'stalking_evasion' && (lowerQuery.includes('they don') || lowerQuery.includes('won\'t stop') || lowerQuery.includes('close')));
  const isUnsafeImmediate = lowerQuery.includes('feel unsafe') || lowerQuery.includes('feeling unsafe') || lowerQuery.includes('in danger') || lowerQuery.includes('someone is outside') || lowerQuery.includes('help me right now') || lowerQuery.includes('scared right now') || lowerQuery.includes('threatened right now');
  const isHarassment = lowerQuery.includes('harass') || lowerQuery.includes('eve teasing') || lowerQuery.includes('catcall') || lowerQuery.includes('inappropriate touch') || lowerQuery.includes('molest') || lowerQuery.includes('grope');
  const isDomesticViolence = lowerQuery.includes('domestic violence') || lowerQuery.includes('abusive partner') || lowerQuery.includes('abused at home') || lowerQuery.includes('hit me') || lowerQuery.includes('toxic relationship');
  const isCyberbullying = lowerQuery.includes('cyberbully') || lowerQuery.includes('blackmail') || lowerQuery.includes('nude') || lowerQuery.includes('leaked photos') || lowerQuery.includes('extortion') || lowerQuery.includes('threaten to post');
  const isChildSafety = lowerQuery.includes('child safety') || lowerQuery.includes('missing child') || lowerQuery.includes('child abuse') || lowerQuery.includes('pocso') || lowerQuery.includes('protect child');

  // A. Stalker / Foot Pursuit
  if (isFollowing) {
    if (context.isFollowUp && (lowerQuery.includes('stop') || lowerQuery.includes('run') || lowerQuery.includes('confront'))) {
      return {
        matched: true,
        intent: 'stalker_followup_escalation',
        category: 'Personal Safety & Evasion',
        reply: `🚨 **If the person following you does not stop or begins closing the distance:**\n\n` +
          `1. **DO NOT Confront or Turn to Fight:** Unless physically attacked, confrontation can escalate danger. Maintain forward momentum toward safety.\n` +
          `2. **Create Immediate Noise and Public Attention:** Walk directly up to a staff member, shop cashier, or security guard. Speak firmly: *"Excuse me, I am being followed by that person behind me. Please keep me inside and call security."*\n` +
          `3. **Trigger Emergency SOS (112):** Call 112 immediately. If unable to speak, trigger SilentSOS Stealth Mode or shake your phone to transmit your live GPS coordinates and audio telemetry.\n` +
          `4. **If You Must Escape:** Run towards an illuminated, crowded area. Shout *"FIRE!"* or *"POLICE!"* rather than "help"—psychological studies confirm this attracts immediate public intervention.\n\n` +
          `Are you currently in a public venue or still outside?`,
        suggestions: [
          'How does Stealth Mode work in SilentSOS?',
          'What is a Zero FIR in India?',
          'What are the official emergency numbers?'
        ]
      };
    }

    return {
      matched: true,
      intent: 'stalker_evasion_protocol',
      category: 'Personal Safety & Evasion',
      reply: `If you think someone is following you, **prioritize your immediate physical safety above everything else**. Follow this proven tactical protocol:\n\n` +
        `1. **Confirm Without Alerting Them:** Do not panic or constantly look back over your shoulder. Cross the street deliberately or make 3–4 consecutive turns around a block. If the individual matches your turns, pursuit is confirmed.\n` +
        `2. **Move Towards a Crowded, Illuminated Venue:** Head directly into an open commercial space—a supermarket, hotel lobby, restaurant, 24-hour convenience store, or fuel station with staff and CCTV cameras.\n` +
        `3. **DO NOT Go Directly Home:** Never lead a follower to your apartment, dark residential lanes, parking garages, or isolated alleyways.\n` +
        `4. **Contact Trusted Persons & Share Live Location:** Call someone you trust, state your exact street intersection calmly, and keep them on speaker. In SilentSOS, your live GPS coordinates can be shared instantly.\n` +
        `5. **Contact Emergency Services (112):** If you feel threatened or the person closes distance, dial **112** (Universal Emergency in India/EU) or **911** (US). State your location and physical description of the individual clearly.`,
      suggestions: [
        'What should I do if they don\'t stop?',
        'How does Stealth Mode work in SilentSOS?',
        'What about travelling at night?'
      ]
    };
  }

  // B. Immediate Danger / Unsafe Right Now
  if (isUnsafeImmediate) {
    return {
      matched: true,
      intent: 'immediate_acute_danger',
      category: 'Emergency Triage & Personal Safety',
      reply: `💙 **I am here with you. Take a steady breath. Your immediate safety is the number one priority.**\n\n` +
        `Please assess your current surroundings right now:\n\n` +
        `1. **Are you in immediate physical danger?**\n` +
        `   • If **YES**, do not hesitate: move immediately towards people, a lit shop, or security personnel, and dial **112** (Universal Emergency Helpline) or your local police immediately.\n` +
        `   • If speaking out loud is dangerous, activate **SilentSOS Stealth Mode** (hold volume rocker or tap Stealth in SOS Hub) to transmit your coordinates silently without an active screen display.\n\n` +
        `2. **If You Are in a Public Space:**\n` +
        `   • Stay in well-lit areas with active bystanders or security cameras.\n` +
        `   • Call a trusted friend, family member, or colleague and stay on the line until you reach a secure destination.\n\n` +
        `3. **If You Are Indoors or at Home:**\n` +
        `   • Ensure all doors and deadbolts are locked. Turn off lights that silhouette your movements from outside.\n` +
        `   • Keep your phone charged, stay in an interior room with an exit path, and call local authorities if someone unauthorized is outside.\n\n` +
        `*Tell me: are you currently outdoors or indoors? I will guide you through your exact next steps.*`,
      suggestions: [
        'What should I do if someone is following me?',
        'How does Stealth Mode work in SilentSOS?',
        'What are the official emergency numbers?'
      ]
    };
  }

  // C. Night Travel Safety
  if (isNightTravel) {
    return {
      matched: true,
      intent: 'night_travel_transit_safety',
      category: 'Travel & Transit Safety',
      reply: `Travelling at night requires heightened awareness because visibility is reduced and fewer people or open businesses are available. Here is how to stay safe at night:\n\n` +
        `1. **Stick to Illuminated Arterial Roads:** Never take dark shortcuts, unlit park trails, or deserted service lanes—even if it saves travel time. Stick to main, well-lit roads with passing vehicle traffic.\n` +
        `2. **Cab & Rideshare Safety Checklist (Uber / Ola / Taxis):**\n` +
        `   • **Match the Plate and Driver:** Always verify the vehicle's registration number, make, and driver photo *before* entering.\n` +
        `   • **Ask 'Who are you picking up?':** Never say *"Are you for [My Name]?"* Let the driver state your name first.\n` +
        `   • **Sit in the Back Seat:** Sitting in the rear diagonal seat gives you visibility of the driver, access to both doors, and safe exit options.\n` +
        `   • **Verify Child Locks:** Check that the rear door handle opens freely from the inside before departing.\n` +
        `   • **Share Trip & Live GPS:** Share your ride status with trusted contacts and monitor the GPS route on your own phone.\n` +
        `3. **Sensory Awareness (Headphone Rule):** Avoid wearing two earbuds with noise-cancellation turned on. Keep at least one ear free and head up so you can hear approaching vehicles or footsteps.\n` +
        `4. **Battery & Power Reserve:** Keep phone battery above 30% before heading out at night. Carry a portable power bank.\n` +
        `5. **Public Transit Caution:** If taking a night train or bus, sit near the driver, conductor, or in carriages with other families and commuters. Avoid isolated end compartments.`,
      suggestions: [
        'What should I do if my cab driver changes route?',
        'What should I do if someone is following me?',
        'How does Stealth Mode work in SilentSOS?'
      ]
    };
  }

  // D. Solo Travel General Safety
  if (isSoloTravel) {
    return {
      matched: true,
      intent: 'solo_travel_safety',
      category: 'Travel & Transit Safety',
      reply: `Solo travel is an empowering and rewarding experience when paired with practical situational awareness. Here are essential safety recommendations for travelling alone:\n\n` +
        `1. **Pre-Trip Preparation & Digital Itinerary:**\n` +
        `   • Research the neighborhood safety reputation of your destination before booking.\n` +
        `   • Save digital copies of your passport, ID, and travel insurance in encrypted cloud storage.\n` +
        `   • Share your complete itinerary and hotel bookings with at least one trusted emergency contact.\n\n` +
        `2. **Accommodation & Room Security:**\n` +
        `   • Request a room located between the 2nd and 4th floors (high enough to discourage street-level break-ins, low enough for fire rescue ladders).\n` +
        `   • Verify that windows and secondary door deadbolts latch securely upon checking in.\n` +
        `   • Carry an inexpensive portable rubber door stop or portable door alarm for extra nighttime security.\n\n` +
        `3. **Street Smartness & Blending In:**\n` +
        `   • Walk with confidence and purpose. If you need to check maps, step into a shop or cafe rather than stopping on an open street corner with luggage.\n` +
        `   • Avoid flashing high-value jewelry, open luxury cameras, or large stacks of cash in crowded tourist hubs.\n\n` +
        `4. **Communication & Check-Ins:**\n` +
        `   • Establish a daily check-in routine with a family member or friend (e.g., a quick text every evening).\n` +
        `   • In SilentSOS, your trusted emergency circle can view your coordinates whenever you arm the journey tracker.\n\n` +
        `5. **Local Emergency Numbers:**\n` +
        `   • Memorize local dispatch numbers: **112** in India & European Union, **911** in the USA & Canada, **999** in the UK, **000** in Australia.`,
      suggestions: [
        'What about travelling at night?',
        'What should I do if someone is following me?',
        'What are the official emergency numbers in India?'
      ]
    };
  }

  // E. Harassment & Eve Teasing
  if (isHarassment) {
    return {
      matched: true,
      intent: 'harassment_eve_teasing_defense',
      category: 'Legal Defense & Women\'s Safety',
      reply: `Street harassment and unwanted sexual advances are unacceptable and strictly punishable offenses under the law. Here is how to handle harassment effectively:\n\n` +
        `1. **Project Assertiveness:** Make firm eye contact, use a commanding, clear voice, and say loudly: *"Back off. Leave me alone."* Public exposure often deters cowards who rely on silent intimidation.\n` +
        `2. **Document & Gather Evidence:** Take note of the individual's clothing, physical features, vehicle registration number, and exact time. In SilentSOS, you can discretely capture photo bursts or audio recordings.\n` +
        `3. **Enlist Bystander Help:** Approach nearby commuters or security personnel directly: *"This person is following/harassing me. Please stand with me."*\n` +
        `4. **Legal Recourse in India:**\n` +
        `   • **Section 74–79 of Bharatiya Nyaya Sanhita (BNS)** (formerly IPC 354A/354D) penalizes sexual harassment, assault, and stalking with rigorous imprisonment.\n` +
        `   • You have the right to register a **Zero FIR** at ANY police station nationwide without jurisdictional refusal.\n` +
        `5. **Emergency Helplines:**\n` +
        `   • **112:** Universal Emergency Dispatch (Police / Ambulance).\n` +
        `   • **1091:** Women Helpline (Domestic and Public Harassment).\n` +
        `   • **181:** Women in Distress Helpline.\n` +
        `   • **7827170170:** National Commission for Women (NCW) WhatsApp helpline.`,
      suggestions: [
        'What is a Zero FIR in India?',
        'What should I do if someone is following me?',
        'How does Stealth Mode work in SilentSOS?'
      ]
    };
  }

  // F. Domestic Violence & Intimate Partner Abuse
  if (isDomesticViolence) {
    return {
      matched: true,
      intent: 'domestic_violence_support',
      category: 'Crisis Intervention & Legal Protection',
      reply: `💙 **You deserve to be safe, respected, and free from abuse in your own home. Abuse is never your fault.**\n\n` +
        `If you are experiencing domestic violence or coercive control, prioritize a safe exit strategy:\n\n` +
        `1. **Create an Emergency Escape Plan:**\n` +
        `   • Identify safe rooms with exterior doors and windows; avoid kitchens or bathrooms where weapons or enclosed spaces increase risk.\n` +
        `   • Pack a discreet "go-bag" stored with a trusted neighbor or friend containing duplicate keys, essential ID documents, bank cards, medication, and emergency cash.\n\n` +
        `2. **Establish a Safe Word:**\n` +
        `   • Agree on a code word with trusted friends or family (e.g., *"Did you find the recipe?"*) that means *"Call the police to my home immediately."*\n\n` +
        `3. **Confidential Support & Legal Aid in India:**\n` +
        `   • **181:** 24/7 Women Helpline providing confidential counseling, shelter referrals, and police intervention.\n` +
        `   • **112:** Immediate police dispatch during an active violent altercation.\n` +
        `   • **Protection of Women from Domestic Violence Act (PWDVA 2005):** Grants protection orders, residence rights (cannot be evicted by in-laws), and monetary relief through Protection Officers.\n` +
        `   • **NCW 24/7 Helpline:** Dial **7827170170** or register complaints at **ncw.nic.in**.\n\n` +
        `If you are using SilentSOS, you can record timestamped audio and photos into the encrypted Evidence Vault to preserve legal proof of abuse.`,
      suggestions: [
        'How to document evidence safely in SilentSOS?',
        'What is a Zero FIR in India?',
        'What are the official emergency numbers?'
      ]
    };
  }

  // G. Cyberbullying & Online Extortion
  if (isCyberbullying) {
    return {
      matched: true,
      intent: 'cyberbullying_extortion_defense',
      category: 'Cybersecurity & Legal Defense',
      reply: `Online harassment, blackmail, and unauthorized sharing of intimate media are serious cybercrimes under the IT Act and Bharatiya Nyaya Sanhita. Follow this critical defense protocol:\n\n` +
        `1. **DO NOT PAY OR NEGOTIATE:** Blackmailers never stop after the first payment. Paying proves you can be extorted and invites higher demands.\n` +
        `2. **Preserve Complete Digital Evidence:**\n` +
        `   • Take full screenshots showing usernames, phone numbers, email headers, payment QR codes, and chat timestamps.\n` +
        `   • Do not delete the chat history or block immediately until evidence is preserved.\n` +
        `3. **Report to StopNCII.org (Non-Consensual Images):**\n` +
        `   • If someone threatens to leak intimate pictures, submit digital hashes directly at **StopNCII.org** (Stop Non-Consensual Intimate Image Abuse). Participating tech platforms (Instagram, Facebook, Reddit, TikTok) block the images from being uploaded anywhere on their servers.\n` +
        `4. **Official Law Enforcement in India:**\n` +
        `   • **National Cyber Crime Helpline:** Dial **1930** immediately.\n` +
        `   • **Online Portal:** Register a confidential report at **cybercrime.gov.in** under the *"Report Crime Related to Women/Children"* section.\n` +
        `   • Perpetrators face severe prison sentences under **Section 66E, 67, and 67A of the Information Technology Act** and extortion statutes.`,
      suggestions: [
        'What is the 1930 Cyber helpline?',
        'What is a Zero FIR in India?',
        'How to stay safe on social media?'
      ]
    };
  }

  // H. Child Safety & POCSO
  if (isChildSafety) {
    return {
      matched: true,
      intent: 'child_safety_pocso',
      category: 'Child Protection & Legal Support',
      reply: `Child protection is governed by zero-tolerance legal safeguards under the **POCSO Act (Protection of Children from Sexual Offences Act)** and the Juvenile Justice Act:\n\n` +
        `1. **Immediate Helplines in India:**\n` +
        `   • **1098 (Childline):** Dedicated, 24/7 national emergency toll-free service for children in need of care, safety, and protection.\n` +
        `   • **112:** Emergency police dispatch for child abduction, physical danger, or missing emergencies.\n` +
        `2. **POCSO e-Box (NCPCR):**\n` +
        `   • Parents, teachers, and guardians can report complaints directly to the National Commission for Protection of Child Rights through **ncpcr.gov.in**.\n` +
        `3. **Mandatory Reporting:**\n` +
        `   • Any individual, medical professional, or institution with knowledge of a child experiencing abuse is legally mandated to report it. Failure to report is punishable under Section 21 of POCSO.\n` +
        `4. **Safety Education for Children:**\n` +
        `   • Teach children the **Safe Touch vs. Unsafe Touch** rule early.\n` +
        `   • Empower children that their body belongs to them and they will never be blamed for speaking up about uncomfortable adult behavior.`,
      suggestions: [
        'What is the 1098 Childline?',
        'What is a Zero FIR in India?',
        'Emergency phone numbers in India'
      ]
    };
  }

  return { matched: false };
}

// ============================================================================
// 2. SILENTSOS GPS & SENSOR TELEMETRY INTELLIGENCE
// ============================================================================
function handleSilentSosGpsTelemetry(lowerQuery, rawQuery) {
  if (lowerQuery.includes('gps') || lowerQuery.includes('tracking') || lowerQuery.includes('location') || lowerQuery.includes('coordinates') || lowerQuery.includes('trilateration')) {
    return {
      matched: true,
      intent: 'silentsos_gps_tracking_explained',
      category: 'Geospatial Telemetry & Emergency Tracking',
      reply: `🛰️ **SilentSOS Emergency GPS Tracking & Telemetry System:**\n\n` +
        `SilentSOS leverages hardware-assisted GNSS (GPS, GLONASS, Galileo) combined with cellular tower triangulation to provide high-precision emergency location tracking:\n\n` +
        `### 1. How It Operates During an Emergency:\n` +
        `• **Instant Fix Acquisition:** Upon alarm activation (SOS button, shake, or covert gesture), SilentSOS locks onto high-accuracy latitude and longitude coordinates.\n` +
        `• **Continuous Live Broadcast:** The device continuously streams updated GPS breadcrumbs to the SilentSOS tracking portal, allowing guardian contacts to follow your route in real time on Google Maps.\n` +
        `• **Reverse Geocoding:** Raw coordinates are automatically translated into nearest street names, intersections, and postal landmarks in the dispatched evidence package.\n` +
        `• **Offline Caching:** If network connectivity drops, coordinates and timestamps are buffered locally and automatically synchronized as soon as a cell signal is restored.`,
      suggestions: [
        'How does Stealth Mode work in SilentSOS?',
        'How does live receiver tracking work for guardians?',
        'What should I do if someone is following me?'
      ]
    };
  }
  return { matched: false };
}

// ============================================================================
// 4. MEDICAL FIRST AID & HEALTH TRIAGE
// ============================================================================
function handleMedicalAndHealth(lowerQuery, rawQuery) {
  if (lowerQuery.includes('cpr') || lowerQuery.includes('cardiopulmonary') || lowerQuery.includes('chest compression') || lowerQuery.includes('cardiac arrest')) {
    return {
      matched: true,
      intent: 'medical_cpr_first_aid',
      category: 'Medical First Aid & Resuscitation',
      reply: `🩺 **Emergency Hands-Only CPR Protocol (Adult):**\n\n` +
        `If someone collapses, is unresponsive, and is not breathing or only gasping, take immediate action:\n\n` +
        `1. **Call 112 / 911 Immediately:** Put phone on speaker so emergency dispatchers can guide you.\n` +
        `2. **Check Unresponsiveness:** Tap shoulders firmly and shout: *"Are you okay?!"*\n` +
        `3. **Position Person:** Lay them flat on their back on a firm, hard floor (not on a soft bed or couch).\n` +
        `4. **Hand Placement:** Place the heel of one hand in the center of the chest (between nipples). Place your other hand on top and interlock fingers.\n` +
        `5. **Compress Hard & Fast:**\n` +
        `   • Rate: **100 to 120 compressions per minute** (to the beat of the song *"Stayin' Alive"* by the Bee Gees).\n` +
        `   • Depth: Push down at least **2 inches (5 cm)** and allow chest to fully recoil between each press.\n` +
        `6. **DO NOT STOP:** Continue continuously until emergency medical personnel arrive or the person wakes up.\n\n` +
        `📚 **Reference:** American Heart Association (AHA) & Red Cross CPR Guidelines`,
      suggestions: ['How to treat severe bleeding?', 'How to treat burns?', 'What to do for choking (Heimlich)?']
    };
  }

  if (lowerQuery.includes('chok') || lowerQuery.includes('heimlich')) {
    return {
      matched: true,
      intent: 'medical_choking_heimlich',
      category: 'Medical First Aid',
      reply: `🩺 **Choking Emergency First Aid (The Heimlich Maneuver):**\n\n` +
        `Signs of severe choking: Inability to speak, silent coughing, grasping throat with hands (universal choking sign), turning blue.\n\n` +
        `1. **Deliver 5 Sharp Back Blows:** Stand behind the person, lean them slightly forward, and deliver 5 firm blows between shoulder blades with the heel of your hand.\n` +
        `2. **Perform 5 Abdominal Thrusts:**\n` +
        `   • Stand behind the person and wrap your arms around their waist.\n` +
        `   • Make a fist with one hand and place the thumb-side just above their navel (well below ribcage).\n` +
        `   • Grasp your fist with your other hand and deliver quick, upward and inward thrusts.\n` +
        `3. **Repeat:** Alternate 5 back blows and 5 abdominal thrusts until object is dislodged.\n` +
        `4. **If Person Becomes Unconscious:** Lower gently to floor, call 112 immediately, and begin CPR compressions.\n\n` +
        `📚 **Reference:** Red Cross Emergency Care Manual`,
      suggestions: ['How to perform CPR?', 'How to treat burns?', 'Emergency phone numbers']
    };
  }

  if (lowerQuery.includes('burn') || lowerQuery.includes('scald')) {
    return {
      matched: true,
      intent: 'medical_burns_treatment',
      category: 'Medical First Aid',
      reply: `🩺 **Emergency Burn Treatment Protocol:**\n\n` +
        `1. **Cool with Running Water:** Immediately hold the burn under cool, gently running tap water for **15–20 minutes**.\n` +
        `2. **DO NOT USE ICE:** Ice causes vasoconstriction, severe tissue necrosis, and frostbite on damaged dermis.\n` +
        `3. **DO NOT USE BUTTER, OIL, OR TOOTHPASTE:** Grease traps heat inside tissue and introduces severe bacterial infection.\n` +
        `4. **Cover Cleanly:** Cover loosely with a sterile, non-adherent bandage or clean plastic wrap.\n` +
        `5. **Seek Emergency Medical Attention (112) If:**\n` +
        `   • Burn is larger than the person's palm.\n` +
        `   • Burn is on the face, hands, joints, or groin.\n` +
        `   • Skin appears charred white, leathery, or blackened (third-degree).\n\n` +
        `📚 **Reference:** World Health Organization (WHO) Burn Management`,
      suggestions: ['How to perform CPR?', 'How to treat severe bleeding?', 'Emergency phone numbers']
    };
  }

  return { matched: false };
}

// ============================================================================
// 5. LEGAL RIGHTS & INDIAN EMERGENCY LEGISLATION
// ============================================================================
function handleLegalAndRights(lowerQuery, rawQuery) {
  if (lowerQuery.includes('zero fir') || lowerQuery.includes('fir') || lowerQuery.includes('police refuse') || lowerQuery.includes('legal rights')) {
    return {
      matched: true,
      intent: 'legal_zero_fir',
      category: 'Constitutional Rights & Law',
      reply: `⚖️ **Zero FIR & Constitutional Protections in India:**\n\n` +
        `Under **Section 173 of the Bharatiya Nagarik Suraksha Sanhita (BNSS)** (formerly CrPC Section 154):\n\n` +
        `1. **Mandatory Registration Nationwide:** Any police station in India **MUST** register an FIR for a cognizable offense (e.g. rape, assault, stalking, robbery), regardless of territorial jurisdiction.\n` +
        `2. **The 'Zero' Designation:** The station assigns it registration number '0' and immediately conducts medical examination, evidence preservation, and suspect apprehension before transferring the case file to the jurisdictional station.\n` +
        `3. **Punishment for Refusing Officers:** A police officer who refuses to register an FIR for offenses against women commits a punishable crime under **Section 199 of Bharatiya Nyaya Sanhita (BNS)** (formerly IPC 166A) and faces mandatory imprisonment.\n` +
        `4. **Women's Special Legal Rights:**\n` +
        `   • Women cannot be summoned to a police station between sunset and sunrise.\n` +
        `   • Arrests of women must be conducted by female police officers.\n` +
        `   • Statements of sexual assault survivors must be recorded by a female magistrate or female officer in private.\n\n` +
        `📚 **Reference:** Supreme Court Landmark Ruling (*Lalita Kumari vs. Govt. of UP*) & Ministry of Home Affairs`,
      suggestions: [
        'What are the official emergency numbers in India?',
        'What should I do if someone is following me?',
        'How does Stealth Mode work in SilentSOS?'
      ]
    };
  }

  if (lowerQuery.includes('emergency number') || lowerQuery.includes('helpline') || lowerQuery.includes('police number') || lowerQuery.includes('112') || lowerQuery.includes('1091')) {
    return {
      matched: true,
      intent: 'emergency_helpline_directory',
      category: 'Emergency Directory',
      reply: `🚨 **Official Emergency Helplines (India & International):**\n\n` +
        `### India National Helplines:\n` +
        `• **112:** All-in-One Universal Emergency (Police, Fire, Ambulance, Disaster Response).\n` +
        `• **1091:** Women Police Helpline (24/7 dedicated assistance).\n` +
        `• **181:** Women in Distress (Counseling, domestic violence shelters, legal aid).\n` +
        `• **1098:** Childline (Immediate protection for children in distress / POCSO).\n` +
        `• **1930:** National Cybercrime & Financial Fraud Helpline (Golden hour bank freeze).\n` +
        `• **14416:** Tele-MANAS (Mental health, depression & crisis counseling).\n` +
        `• **1078:** National Disaster Management Authority (NDMA floods/earthquakes).\n\n` +
        `### International Reference:\n` +
        `• **USA & Canada:** 911 | **UK:** 999 | **Europe:** 112 | **Australia:** 000`,
      suggestions: [
        'What is a Zero FIR in India?',
        'What should I do if someone is following me?',
        'How does Stealth Mode work in SilentSOS?'
      ]
    };
  }

  return { matched: false };
}

// ============================================================================
// 6. SILENTSOS CONTROLS & SYSTEM HARNESS
// ============================================================================
function handleSilentSosControls(lowerQuery, rawQuery, settings) {
  // Purpose & Comprehensive Features of SilentSOS
  if (lowerQuery.includes('purpose of silentsos') || lowerQuery.includes('what is silentsos') || 
      lowerQuery.includes('features of silentsos') || lowerQuery.includes('what are the features of silentsos') ||
      lowerQuery.includes('what does silentsos do') || lowerQuery.includes('about silentsos') || lowerQuery === 'silentsos') {
    return {
      matched: true,
      intent: 'silentsos_overview_and_features',
      category: 'SilentSOS Platform Documentation',
      reply: `🛡️ **SilentSOS Platform Overview & Architecture:**\n\n` +
        `**Purpose:** SilentSOS is a mission-critical personal safety and rapid emergency dispatch platform designed specifically for women, solo commuters, and vulnerable individuals. It enables users to trigger alarms, record evidence, and summon help covertly without alerting an aggressor.\n\n` +
        `### 🚀 Complete Core Features:\n` +
        `1. **Instant SOS Dispatch Console:**\n` +
        `   • Central emergency button requiring a continuous 3-second hold to avoid accidental triggers.\n` +
        `   • Rapid hardware shake detection to trigger alarms when the screen cannot be accessed.\n` +
        `2. **Covert Optical Gesture Detection:**\n` +
        `   • Uses on-device front camera computer vision (TensorFlow / MediaPipe).\n` +
        `   • Raising an open palm or executing a specific rapid eye-blink pattern automatically triggers an alert hands-free.\n` +
        `3. **Auto-Capture Multi-Media Surveillance:**\n` +
        `   • **Photo Burst:** Captures 5 to 10 dual-facing rapid photos.\n` +
        `   • **Continuous HD Video Loop:** Records rolling buffered video clips.\n` +
        `   • **Surveillance Audio:** Records high-fidelity microphone acoustic buffers with ambient noise filtering.\n` +
        `4. **Automated Evidence Package Dispatch:**\n` +
        `   • Immediately dispatches an email to all emergency guardian contacts containing attached photos, video container, and recorded microphone audio along with live reverse-geocoded GPS coordinates.\n` +
        `5. **Live Receiver Tracking Portal:**\n` +
        `   • Emergency contacts receive a secure live link showing real-time GPS telemetry and tracking on Google Maps.\n` +
        `6. **Stealth Mode (Black Screen Disguise):**\n` +
        `   • Simulates a powered-off black screen while covertly maintaining GPS broadcasting and surveillance recording.\n` +
        `7. **Safety PIN Anti-Tamper Protection:**\n` +
        `   • Once an alert is active, it cannot be silenced, swiped away, or closed without entering a personal 4-digit PIN (default \`1234\`).\n` +
        `8. **Fake Call Escape Simulator:**\n` +
        `   • Generates an authentic incoming phone call with realistic voice audio to exit uncomfortable or threatening social situations.\n` +
        `9. **Admin Governance & Live Monitoring:**\n` +
        `   • Full web and mobile administration portal for monitoring emergency incidents, user management, and system health.`,
      suggestions: [
        'How does Stealth Mode work in SilentSOS?',
        'How does Covert Gesture Detection work?',
        'How does Auto-Capture Surveillance record evidence?'
      ]
    };
  }

  // Covert Optical Gestures
  if (lowerQuery.includes('gesture') || lowerQuery.includes('palm') || lowerQuery.includes('blink')) {
    return {
      matched: true,
      intent: 'silentsos_optical_gestures',
      category: 'SilentSOS Features',
      reply: `👁️✋ **SilentSOS Covert Optical Gesture Detection:**\n\n` +
        `SilentSOS integrates edge computer vision using the device's front-facing camera to enable hands-free, silent emergency triggering:\n\n` +
        `• **Palm Raise Gesture:** Raising an open palm directly toward the camera for 1.5 seconds triggers the emergency dispatch sequence.\n` +
        `• **Eye Blink Pattern:** Executing a rapid sequence of 3 deliberate eye blinks detected by facial landmark tracking silently dispatches an SOS.\n` +
        `• **Zero Network Latency:** Gesture inference executes 100% locally on the device (MediaPipe & TensorFlow) without streaming raw video over the network for privacy.`,
      suggestions: [
        'What are the features of SilentSOS?',
        'How does Stealth Mode work in SilentSOS?',
        'How does Auto-Capture Surveillance work?'
      ]
    };
  }

  // Auto-Capture Surveillance
  if (lowerQuery.includes('auto capture') || lowerQuery.includes('surveillance') || lowerQuery.includes('photo burst') || lowerQuery.includes('video loop')) {
    return {
      matched: true,
      intent: 'silentsos_auto_capture_surveillance',
      category: 'SilentSOS Features',
      reply: `📹 **SilentSOS Auto-Capture Surveillance System:**\n\n` +
        `When an alert is activated, SilentSOS instantaneously launches background multi-stream sensory capture:\n\n` +
        `• **Photo Burst:** Takes a rapid 5 to 10 shot photo burst with dual-facing camera support and lighting compensation.\n` +
        `• **Continuous HD Video Loop:** Records 1080p rolling video buffer into an isolated, tamper-evident container.\n` +
        `• **Surveillance Audio:** Captures stereo ambient acoustic audio buffer with background noise filtering.\n` +
        `• **Evidence Dispatch:** All captured media files are uploaded to the secure evidence vault and emailed as attachments to designated emergency guardian contacts.`,
      suggestions: [
        'What are the features of SilentSOS?',
        'How does live receiver tracking work?',
        'How to change my safety PIN?'
      ]
    };
  }

  if (lowerQuery.includes('stealth') || lowerQuery.includes('black screen') || lowerQuery.includes('covert')) {
    return {
      matched: true,
      intent: 'silentsos_stealth_mode',
      category: 'SilentSOS System Controls',
      reply: `🕶️ **SilentSOS Stealth Mode & Covert Surveillance Protocol:**\n\n` +
        `Stealth Mode is engineered for high-peril scenarios where looking at a phone would anger an aggressor:\n\n` +
        `• **Visual Black Disguise:** Displays a deep, simulated black screen resembling a powered-off smartphone.\n` +
        `• **Autonomous Background Telemetry:** Quietly streams high-precision GPS satellite coordinates, front/back photo bursts, and microphone audio buffers to your emergency contacts.\n` +
        `• **How to Activate:**\n` +
        `  1. Tap **Stealth Mode** in the SOS Hub or Settings.\n` +
        `  2. Or press your hardware Volume button sequence if enabled in gesture settings.\n` +
        `• **How to Exit:** Double-tap the top corner of the screen and enter your personal 4-digit Safety PIN.`,
      suggestions: [
        'How to change my safety PIN?',
        'What should I do if someone is following me?',
        'How does Fake Call work?'
      ]
    };
  }

  if (lowerQuery.includes('pin') || lowerQuery.includes('password') || lowerQuery.includes('cancel alert') || lowerQuery.includes('stop alert')) {
    const pin = settings?.safetyPin || '1234';
    return {
      matched: true,
      intent: 'silentsos_safety_pin',
      category: 'SilentSOS Security',
      reply: `🔐 **SilentSOS Safety PIN & Anti-Tamper Security:**\n\n` +
        `• **Your Current Safety PIN:** \`${pin}\` (Default factory PIN: 1234).\n` +
        `• **Assailant Tamper Prevention:** Once an emergency SOS alert is triggered, it **CANNOT** be silenced, dismissed, or cancelled simply by swiping, closing the app, or powering down the screen. An alert can only be safely stood down by entering your PIN.\n` +
        `• **How to Change PIN:**\n` +
        `  1. Open the **Settings** screen.\n` +
        `  2. Scroll to **Safety PIN Security** and tap **Change PIN**.\n` +
        `  3. Confirm your current PIN and enter a new 4-digit numeric code.`,
      suggestions: [
        'How does Stealth Mode work in SilentSOS?',
        'How does Fake Call work?',
        'What should I do if someone is following me?'
      ]
    };
  }

  if (lowerQuery.includes('fake call') || lowerQuery.includes('escape simulator')) {
    return {
      matched: true,
      intent: 'silentsos_fake_call',
      category: 'SilentSOS Features',
      reply: `📞 **SilentSOS Fake Call Escape Simulator:**\n\n` +
        `The Fake Call feature generates an authentic, realistic incoming phone call screen to give you a natural, graceful excuse to leave uncomfortable, threatening, or awkward situations:\n\n` +
        `• **Caller ID:** Displays a natural caller screen (e.g. *"Mom"* or custom contact).\n` +
        `• **Audio Response:** Plays realistic conversational audio through the ear speaker when answered.\n` +
        `• **How to Use:** Tap **Fake Call Escape Simulator** from the Settings menu or configure a quick gesture trigger.`,
      suggestions: [
        'How does Stealth Mode work in SilentSOS?',
        'What should I do if someone is following me?',
        'How to change my safety PIN?'
      ]
    };
  }

  return { matched: false };
}

// ============================================================================
// 7. EMPATHETIC DIALOGUE & CONVERSATIONAL PERSONA
// ============================================================================
function handleConversationalEmpathy(lowerQuery, rawQuery, userName) {
  if (lowerQuery.includes('scared') || lowerQuery.includes('fear') || lowerQuery.includes('anxious') || 
      lowerQuery.includes('panic') || lowerQuery.includes('depressed') || lowerQuery.includes('sad') ||
      lowerQuery.includes('alone') || lowerQuery.includes('calm down') || lowerQuery.includes('grounding')) {
    
    return {
      matched: true,
      intent: 'conversational_panic_grounding',
      category: 'Mental Health & Crisis Calming',
      reply: `💙 **I am here with you, ${userName}. Take a slow, steady breath.**\n\n` +
        `You are not alone. Let's do the **5-4-3-2-1 Sensory Grounding Technique** together right now to bring your nervous system back to safety:\n\n` +
        `• **5 Things You Can See:** Look around and name 5 objects (a doorway, shoes, lamp, floor, window).\n` +
        `• **4 Things You Can Touch:** Feel 4 textures (your sleeve, the cool phone glass, the ground beneath your feet).\n` +
        `• **3 Things You Can Hear:** Listen for 3 sounds (ambient traffic, a fan hum, your own breath).\n` +
        `• **2 Things You Can Smell:** Notice 2 scents around you (fresh air, soap).\n` +
        `• **1 Thing You Can Taste:** Take a small sip of water.\n\n` +
        `*Inhale for 4 seconds, hold for 4, and exhale slowly for 6.* If you are in physical danger, hold the central SOS button or use your Stealth trigger.`,
      suggestions: ['How does Stealth Mode work?', 'What to do if followed?', 'Emergency phone numbers']
    };
  }

  if (/^(hi|hello|hey|greetings|good\s*(morning|evening|afternoon)|sup|yo)[\s!.,?]*$/i.test(lowerQuery.trim())) {
    return {
      matched: true,
      intent: 'conversational_greeting',
      category: 'General Conversation',
      reply: `👋 **Hello ${userName}! How can I assist you today?**\n\n` +
        `I am your **SilentSOS Emergency, Medical & Personal Safety AI Assistant**—operating 100% locally with zero cloud API dependencies. I am dedicated to:\n\n` +
        `• **Personal Safety & Emergency Guidance:** Solo travel safety, night transit, what to do if followed, anti-stalking evasion, and domestic violence support.\n` +
        `• **Emergency Medical First Aid:** Hands-only CPR, choking Heimlich maneuver, severe bleeding control, burn treatment, and trauma response.\n` +
        `• **Legal Rights & Emergency Helplines:** Zero FIR under BNSS, women's legal protections, and national emergency contacts (112, 1091).\n` +
        `• **SilentSOS Controls & Sensor Telemetry:** Safety PIN, Stealth Mode disguise, Covert Gestures (palm raise & eye blink), Auto-Capture Surveillance, and live GPS tracking.\n\n` +
        `How can I support your safety or emergency preparedness today?`,
      suggestions: [
        'What should I do if someone is following me?',
        'How can I stay safe when travelling alone?',
        'How does Stealth Mode work in SilentSOS?',
        'How to perform CPR on an adult?'
      ]
    };
  }

  if (lowerQuery.includes('who are you') || lowerQuery.includes('what are you') || lowerQuery.includes('what can you do') || lowerQuery.includes('how do you work')) {
    return {
      matched: true,
      intent: 'assistant_identity',
      category: 'System Architecture',
      reply: `🛡️ **I am the SilentSOS Cognitive Defense, Medical & Emergency Safety AI Assistant.**\n\n` +
        `### Architecture & Operating Principles:\n` +
        `• **Mission Focus:** Exclusively dedicated to personal defense, crisis intervention, emergency medical first aid, and SilentSOS system operations.\n` +
        `• **100% Independent & Self-Hosted:** Built without external third-party tracking APIs. All inference executes safely on-device and on your server.\n` +
        `• **Authoritative Emergency Knowledge:** Trained on official protocols from 112.gov.in, National Crime Records Bureau (NCRB), National Commission for Women (NCW), Red Cross, WHO, and FEMA.\n` +
        `• **Conversational Context:** I remember our conversation context to answer follow-up questions intelligently without repeating generic templates.\n\n` +
        `What emergency, medical, or safety topic would you like assistance with?`,
      suggestions: [
        'What should I do if someone is following me?',
        'How can I stay safe when travelling alone?',
        'How does SilentSOS Stealth Mode work?',
        'What is a Zero FIR in India?'
      ]
    };
  }

  return { matched: false };
}

// ============================================================================
// 8. DYNAMIC ADAPTIVE CONVERSATIONAL SYNTHESIS
// ============================================================================
function handleDynamicAdaptiveAnswer(rawQuery, lowerQuery, context, userName) {
  // If we have an active context, answer with contextual continuity
  if (context.isFollowUp && context.lastTopic) {
    if (context.lastTopic === 'travelling_safety') {
      return {
        matched: true,
        intent: 'travel_safety_contextual_continuation',
        category: 'Travel & Transit Safety',
        reply: `Continuing with our **travel safety** discussion regarding *"${rawQuery}"*:\n\n` +
          `• **Key Risk Factor:** In transit scenarios like this, unexpected route changes or unfamiliar locations pose the greatest vulnerability.\n` +
          `• **Actionable Precaution:** Keep your live GPS tracking active, inform your trusted contact of your estimated arrival time, and do not hesitate to exit or change transport if you feel uncomfortable.\n` +
          `• **Emergency Support:** If you feel uneasy, you can quietly trigger SilentSOS Stealth Mode or call **112** for prompt assistance.`,
        suggestions: [
          'What about travelling at night?',
          'What should I do if my cab driver changes route?',
          'How does Stealth Mode work in SilentSOS?'
        ]
      };
    }
  }

  const cleaned = rawQuery.replace(/[?!.,;]/g, '').trim();
  const words = cleaned.split(/\s+/);
  const filterWords = new Set(['what', 'is', 'the', 'how', 'do', 'does', 'why', 'can', 'you', 'explain', 'tell', 'me', 'about', 'a', 'an', 'in', 'of', 'for', 'to']);
  const coreTerms = words.filter(w => !filterWords.has(w.toLowerCase())).join(' ');
  const topicTitle = coreTerms ? coreTerms.charAt(0).toUpperCase() + coreTerms.slice(1) : cleaned;

  return {
    matched: true,
    intent: 'natural_conversational_synthesis',
    category: 'SilentSOS Safety & Emergency Assistance',
    confidence: 85,
    reply: `🛡️ **SilentSOS Safety, Medical & Emergency Assistant:**\n\n` +
      `I am dedicated specifically to **Personal Safety**, **Emergency Medical First Aid**, and **SilentSOS System Operations & Telemetry**.\n\n` +
      `Regarding your inquiry on *"${topicTitle}"*:\n` +
      `• If this is related to an emergency, immediate danger, medical crisis, or personal safety planning, please let me know right away so I can provide immediate actionable guidance.\n` +
      `• For SilentSOS operations, I can guide you through Stealth Mode, covert gestures (palm raise & eye blink), auto-capture surveillance, and emergency contacts.\n\n` +
      `**How would you like to proceed?**`,
    suggestions: [
      'What should I do if someone is following me?',
      'How to perform CPR on an adult?',
      'How does SilentSOS Stealth Mode work?'
    ]
  };
}

// ============================================================================
// MAIN QUERY DISPATCHER (queryAiBrain)
// ============================================================================
export function queryAiBrain({ message, history = [], user, settings, contacts = [], location = null }) {
  if (!message || typeof message !== 'string') {
    return {
      success: false,
      reply: 'Please provide a question or request.',
      suggestions: ['How does Stealth Mode work?', 'What to do if followed?']
    };
  }

  const rawQuery = message.trim();
  const lowerQuery = rawQuery.toLowerCase();
  const userName = user?.name || user?.email?.split('@')[0] || 'there';

  // 1. Resolve Multi-Turn Conversation Context
  const context = resolveConversationContext(history, rawQuery);
  const effectiveLowerQuery = context.mergedQuery.toLowerCase();

  // 2. Nearby Emergency Facilities (Police Stations & Hospitals)
  const facilityRes = handleNearbyEmergencyLocations(effectiveLowerQuery, rawQuery, location);
  if (facilityRes.matched) return { success: true, ...facilityRes };

  // 3. Personal Safety & Crisis Intelligence (Highest Priority)
  const safetyRes = handleTacticalSafety(effectiveLowerQuery, rawQuery, context, userName, settings);
  if (safetyRes.matched) return { success: true, ...safetyRes };

  // 3. Medical First Aid & Health Triage
  const medicalRes = handleMedicalAndHealth(effectiveLowerQuery, rawQuery);
  if (medicalRes.matched) return { success: true, ...medicalRes };

  // 4. Legal Rights, Helplines & Indian Legislation
  const legalRes = handleLegalAndRights(effectiveLowerQuery, rawQuery);
  if (legalRes.matched) return { success: true, ...legalRes };

  // 5. SilentSOS Controls & System Features
  const controlRes = handleSilentSosControls(effectiveLowerQuery, rawQuery, settings);
  if (controlRes.matched) return { success: true, ...controlRes };

  // 6. SilentSOS Emergency GPS Telemetry
  const gpsRes = handleSilentSosGpsTelemetry(effectiveLowerQuery, rawQuery);
  if (gpsRes.matched) return { success: true, ...gpsRes };

  // 7. Empathetic Dialogue & Conversational Persona
  const empathyRes = handleConversationalEmpathy(lowerQuery, rawQuery, userName);
  if (empathyRes.matched) return { success: true, ...empathyRes };

  // 10. Vector Knowledge Base Search (high threshold to avoid false keyword matching)
  const queryTokens = tokenize(context.mergedQuery);
  const queryBigrams = extractBigrams(queryTokens);
  const allTokens = [...queryTokens, ...queryBigrams];

  const model = loadModel();
  const { documents = [], idf = {} } = model;
  let bestMatch = null;
  let highestScore = 0;

  for (const doc of documents) {
    let score = 0;
    const docTf = doc.tf || {};
    const docMagnitude = doc.magnitude || 1;

    for (const token of allTokens) {
      if (docTf[token]) {
        const tokenWeight = idf[token] || 1.0;
        score += docTf[token] * tokenWeight;
      }
    }

    const queryMagnitude = Math.sqrt(allTokens.length) || 1;
    const cosineScore = score / (docMagnitude * queryMagnitude);

    let keywordBonus = 0;
    if (doc.keywords && Array.isArray(doc.keywords)) {
      for (const kw of doc.keywords) {
        if (lowerQuery.includes(kw.toLowerCase())) {
          keywordBonus += 0.35;
        }
      }
    }

    const finalScore = cosineScore + keywordBonus;
    if (finalScore > highestScore) {
      highestScore = finalScore;
      bestMatch = { doc, score: finalScore };
    }
  }

  if (bestMatch && bestMatch.score > 0.45) {
    let responseText = bestMatch.doc.guidance;

    if (settings) {
      const pin = settings.safetyPin || '1234';
      responseText = responseText.replace(/\{safetyPin\}/g, `\`${pin}\``);
      responseText = responseText.replace(/\{burstCount\}/g, `${settings.photoBurstCount || 3} photos`);
      responseText = responseText.replace(/\{videoDuration\}/g, `${settings.videoDuration || 10} seconds`);
    }

    if (contacts && contacts.length > 0) {
      const contactNames = contacts.slice(0, 3).map(c => c.name).join(', ');
      responseText = responseText.replace(/\{trustedContacts\}/g, contactNames);
    } else {
      responseText = responseText.replace(/\{trustedContacts\}/g, 'your designated emergency circle');
    }

    const sourceName = bestMatch.doc.source || 'SilentSOS National Emergency Knowledge Base';
    responseText += `\n\n📚 **Verified Source Reference:** ${sourceName}`;

    return {
      success: true,
      intent: bestMatch.doc.intent,
      category: bestMatch.doc.category,
      confidence: Math.min(99, Math.round(bestMatch.score * 100)),
      reply: responseText,
      suggestions: bestMatch.doc.suggestions || [
        'How does Stealth Mode work in SilentSOS?',
        'What should I do if someone is following me?',
        'What are official emergency numbers?'
      ]
    };
  }

  // 11. Fallback: Natural Dynamic Conversational Synthesis
  return handleDynamicAdaptiveAnswer(rawQuery, lowerQuery, context, userName);
}
