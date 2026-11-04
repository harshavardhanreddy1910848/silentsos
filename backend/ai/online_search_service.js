/**
 * SilentSOS Online Web Search & Real-Time Knowledge Retrieval Engine
 * 
 * Enables the AI assistant to fetch live, verified information from the internet:
 * 1. MedlinePlus (National Library of Medicine / NIH) - Official medical & first aid portal
 * 2. Official Government Emergency Directory (112, 1091, 181, 108, 1930, 1078, BNSS Zero FIR)
 * 3. Wikipedia Public Knowledge Base (Government services, helplines, laws, public safety)
 * 4. OpenStreetMap Nominatim API (Hospitals, police stations, geographic places)
 * 
 * Features:
 * - Free and keyless: zero paid APIs or private keys required.
 * - Prioritizes official government (.gov, .nic.in), hospital, and recognized medical portals.
 * - Clickable source titles and verified URLs.
 * - Graceful offline error handling when internet connection is unavailable.
 * - Works across both Web Application and Native Android App.
 */

/**
 * Decodes HTML entities and strips HTML tags cleanly.
 */
export function decodeAndCleanHtml(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const decoded = raw
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
  return decoded
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 1. Query MedlinePlus Health & Medical Knowledge (Official NIH / NLM Government Service)
 * Keyless, official U.S. National Library of Medicine & National Institutes of Health.
 */
async function fetchMedlinePlusKnowledge(query) {
  try {
    const url = `https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SilentSOS-Emergency-AI/1.0 (safety@silentsos.org)' },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return null;
    const xml = await res.text();
    const docRegex = /<document\s+[^>]*url="([^"]+)"[^>]*>([\s\S]*?)<\/document>/gi;
    let match;
    const items = [];

    while ((match = docRegex.exec(xml)) !== null && items.length < 2) {
      const docUrl = match[1];
      const body = match[2];
      const titleMatch = /<content\s+name="title"[^>]*>([\s\S]*?)<\/content>/i.exec(body);
      const summaryMatch = /<content\s+name="FullSummary"[^>]*>([\s\S]*?)<\/content>/i.exec(body);

      const title = decodeAndCleanHtml(titleMatch ? titleMatch[1] : query);
      const summary = decodeAndCleanHtml(summaryMatch ? summaryMatch[1] : '');

      if (title && docUrl) {
        items.push({
          source: 'MedlinePlus (National Library of Medicine / NIH)',
          title: `MedlinePlus: ${title}`,
          extract: summary.slice(0, 320) + (summary.length > 320 ? '...' : ''),
          url: docUrl
        });
      }
    }

    return items.length > 0 ? items : null;
  } catch (err) {
    // Offline or network error
    return null;
  }
}

/**
 * 2. Official Government Helplines & Authorities Knowledge Directory
 * Matches verified Indian and international government emergency frameworks.
 */
function matchOfficialGovDirectory(query) {
  const q = (query || '').toLowerCase();
  const matched = [];

  // Universal Emergency 112
  if (q.includes('112') || q.includes('universal emergency') || q.includes('emergency number') || q.includes('police number') || q.includes('fire number')) {
    matched.push({
      source: 'National Emergency Response Support System (Govt. of India)',
      title: 'ERSS 112 - Pan-India Universal Emergency Service',
      extract: '112 is the single emergency number in India for Police, Fire, and Ambulance, operational 24/7 with GPS dispatch.',
      url: 'https://112.gov.in'
    });
  }

  // Women's Helpline & National Commission for Women
  if (q.includes('1091') || q.includes('women helpline') || q.includes('ncw') || q.includes('harass') || q.includes('stalk') || q.includes('eve-teas') || q.includes('women safe')) {
    matched.push({
      source: 'National Commission for Women (Govt. of India)',
      title: 'NCW 24/7 Women Helpline & Redressal (1091 & 7827170170)',
      extract: 'The National Commission for Women provides round-the-clock emergency assistance, legal guidance, and anti-harassment escalation.',
      url: 'http://ncw.nic.in'
    });
  }

  // Women Domestic Violence / Distress 181
  if (q.includes('181') || q.includes('domestic violence') || q.includes('abuse') || q.includes('women distress') || q.includes('one stop centre')) {
    matched.push({
      source: 'Ministry of Women & Child Development (Govt. of India)',
      title: '181 Women in Distress Helpline & Sakhi One Stop Centres',
      extract: '181 provides toll-free 24/7 support for women facing violence, facilitating shelter, medical aid, police intervention, and legal counsel.',
      url: 'https://wcd.nic.in'
    });
  }

  // Section 173 BNSS (Zero FIR)
  if (q.includes('zero fir') || q.includes('fir') || q.includes('bnss') || q.includes('police refuse') || q.includes('jurisdiction')) {
    matched.push({
      source: 'Ministry of Home Affairs (Govt. of India)',
      title: 'Bharatiya Nagarik Suraksha Sanhita (BNSS) - Section 173 Zero FIR',
      extract: 'Section 173 of BNSS mandates that any police station must register an FIR for cognizable crimes irrespective of territorial jurisdiction.',
      url: 'https://www.mha.gov.in'
    });
  }

  // Cyber Crime 1930
  if (q.includes('1930') || q.includes('cyber') || q.includes('online harass') || q.includes('cyber stalk') || q.includes('blackmail') || q.includes('morphed')) {
    matched.push({
      source: 'National Cyber Crime Reporting Portal (MHA Govt. of India)',
      title: 'National Cyber Crime Reporting Helpline (1930)',
      extract: 'Dedicated portal and 1930 helpline for reporting cyber crimes, online harassment, obscene content, and digital extortion.',
      url: 'https://cybercrime.gov.in'
    });
  }

  // Ambulance / Medical Emergency 108 & MoHFW
  if (q.includes('108') || q.includes('ambulance') || q.includes('medical helpline') || q.includes('mohfw') || q.includes('health ministry')) {
    matched.push({
      source: 'Ministry of Health & Family Welfare (Govt. of India)',
      title: '108 National Health Emergency Ambulance Service',
      extract: '108 is the free emergency response service providing primary care ambulances and trained emergency medical technicians (EMTs).',
      url: 'https://mohfw.gov.in'
    });
  }

  // Disaster Management 1078 (NDMA)
  if (q.includes('1078') || q.includes('disaster') || q.includes('earthquake') || q.includes('flood') || q.includes('cyclone') || q.includes('ndma')) {
    matched.push({
      source: 'National Disaster Management Authority (Govt. of India)',
      title: 'NDMA 24/7 Disaster Control Room (1078)',
      extract: 'National helpline and alert monitoring service for natural and man-made disasters, evacuation protocols, and emergency relief.',
      url: 'https://ndma.gov.in'
    });
  }

  // Indian Red Cross Society
  if (q.includes('red cross') || q.includes('cpr') || q.includes('first aid') || q.includes('blood bank') || q.includes('trauma')) {
    matched.push({
      source: 'Indian Red Cross Society',
      title: 'Indian Red Cross Society - First Aid & Disaster Relief',
      extract: 'Recognized humanitarian institution providing accredited first aid training, blood bank coordination, and emergency relief.',
      url: 'https://www.indianredcross.org'
    });
  }

  // World Health Organization (WHO)
  if (q.includes('who') || q.includes('world health') || q.includes('pandemic') || q.includes('burn') || q.includes('chok') || q.includes('bleed')) {
    matched.push({
      source: 'World Health Organization (WHO)',
      title: 'WHO Emergency & Trauma Care Guidelines',
      extract: 'Global recognized medical authority providing clinical protocols for community resuscitation, burns, and trauma care.',
      url: 'https://www.who.int'
    });
  }

  return matched;
}

/**
 * 3. Query Wikipedia Public Knowledge Base (Free & Keyless)
 */
async function fetchWikipediaKnowledge(query) {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=2`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'SilentSOS-Emergency-AI/1.0 (safety@silentsos.org)' },
      signal: AbortSignal.timeout(4500)
    });

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const items = searchData.query?.search;
    if (!items || items.length === 0) return null;

    const topItem = items[0];
    const topTitle = topItem.title;

    // Fetch full summary of top match
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topTitle)}`;
    const sumRes = await fetch(summaryUrl, {
      headers: { 'User-Agent': 'SilentSOS-Emergency-AI/1.0 (safety@silentsos.org)' },
      signal: AbortSignal.timeout(4500)
    });

    if (sumRes.ok) {
      const sumData = await sumRes.json();
      return {
        source: 'Wikipedia Public Knowledge Base',
        title: sumData.title || topTitle,
        extract: sumData.extract || decodeAndCleanHtml(topItem.snippet),
        url: sumData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(topTitle)}`
      };
    }

    return {
      source: 'Wikipedia Public Knowledge Base',
      title: topTitle,
      extract: decodeAndCleanHtml(topItem.snippet),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topTitle)}`
    };
  } catch (err) {
    return null;
  }
}

/**
 * 4. Query OpenStreetMap Nominatim for Places / Hospitals / Police Stations
 */
async function fetchNominatimLocation(query) {
  const isLocationSearch = /in\s+[a-z]+|near\s+[a-z]+|at\s+[a-z]+|police\s+in|hospital\s+in|emergency\s+in/i.test(query);
  if (!isLocationSearch) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=2`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SilentSOS-Emergency-AI/1.0 (safety@silentsos.org)' },
      signal: AbortSignal.timeout(4000)
    });

    if (!res.ok) return null;
    const places = await res.json();
    if (!places || places.length === 0) return null;

    const topPlace = places[0];
    return {
      source: 'OpenStreetMap Global Geographic Registry',
      title: topPlace.display_name,
      lat: parseFloat(topPlace.lat),
      lon: parseFloat(topPlace.lon),
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(topPlace.display_name)}`
    };
  } catch (err) {
    return null;
  }
}

/**
 * Categorizes whether a query requires live web retrieval for:
 * 1. Medical awareness and first aid
 * 2. Women's protection and safety
 * 3. Government emergency services and helplines
 * 4. Public safety information
 */
export function isWebSearchCategory(query) {
  if (!query || typeof query !== 'string') return false;
  const lower = query.toLowerCase();

  // 1. Medical awareness and first aid
  const isMedical = lower.includes('first aid') || lower.includes('cpr') || lower.includes('burn') || 
    lower.includes('bleed') || lower.includes('chok') || lower.includes('poison') || 
    lower.includes('fracture') || lower.includes('stroke') || lower.includes('heart attack') || 
    lower.includes('wound') || lower.includes('seizure') || lower.includes('heatstroke') ||
    lower.includes('asthma') || lower.includes('emergency medical') || lower.includes('bandage') ||
    lower.includes('tourniquet') || lower.includes('ambulance') || lower.includes('medical');

  // 2. Women's protection and safety
  const isWomensProtection = lower.includes('women') || lower.includes('stalk') || 
    lower.includes('harass') || lower.includes('domestic violence') || lower.includes('eve-teas') || 
    lower.includes('safety for women') || lower.includes('travel alone') || lower.includes('following me') ||
    lower.includes('safe at night') || lower.includes('girls safety') || lower.includes('molest');

  // 3. Government emergency services and helplines
  const isGovHelpline = lower.includes('112') || lower.includes('1091') || lower.includes('181') || 
    lower.includes('108') || lower.includes('1930') || lower.includes('1078') || 
    lower.includes('helpline') || lower.includes('emergency number') || lower.includes('zero fir') || 
    lower.includes('police station') || lower.includes('bnss') || lower.includes('fir') || 
    lower.includes('ncw') || lower.includes('government service') || lower.includes('cyber crime');

  // 4. Public safety information
  const isPublicSafety = lower.includes('accident') || lower.includes('fire safety') || 
    lower.includes('earthquake') || lower.includes('flood') || lower.includes('disaster') || 
    lower.includes('public safety') || lower.includes('road safety') || lower.includes('emergency evacuation') ||
    lower.includes('cyclone') || lower.includes('stampede');

  // General questions or queries explicitly asking for online facts
  const isOnlineQuery = lower.includes('online') || lower.includes('latest') || lower.includes('current') || 
    lower.includes('search') || lower.includes('what is') || lower.includes('how to');

  return isMedical || isWomensProtection || isGovHelpline || isPublicSafety || isOnlineQuery;
}

/**
 * Master Online Knowledge Fetcher
 * Aggregates results from recognized official government, medical, and public sources.
 */
export async function searchOnlineKnowledge(query) {
  const cleanQ = (query || '').trim();
  if (!cleanQ) return null;

  try {
    // 1. Check verified official government directory first (0 latency)
    const govMatches = matchOfficialGovDirectory(cleanQ);

    // 2. Concurrent live fetches with timeout guard
    const [medlineRes, wikiRes, placeRes] = await Promise.allSettled([
      fetchMedlinePlusKnowledge(cleanQ),
      fetchWikipediaKnowledge(cleanQ),
      fetchNominatimLocation(cleanQ)
    ]);

    const results = [];

    // Prioritize official government emergency sources
    if (govMatches && govMatches.length > 0) {
      results.push(...govMatches.slice(0, 2));
    }

    // Prioritize official recognized medical sources (MedlinePlus / NIH)
    if (medlineRes.status === 'fulfilled' && medlineRes.value) {
      results.push(...medlineRes.value);
    }

    // Add Wikipedia public knowledge base
    if (wikiRes.status === 'fulfilled' && wikiRes.value) {
      results.push(wikiRes.value);
    }

    // Add OpenStreetMap place if applicable
    if (placeRes.status === 'fulfilled' && placeRes.value) {
      results.push(placeRes.value);
    }

    if (results.length === 0) {
      return {
        hasOnlineData: false,
        offline: true,
        results: [],
        sources: []
      };
    }

    // Deduplicate by URL
    const seenUrls = new Set();
    const uniqueResults = [];
    for (const r of results) {
      if (r.url && !seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        uniqueResults.push(r);
      }
      if (uniqueResults.length >= 4) break;
    }

    // Build grounding prompt for Ollama llama3.2
    let groundingPrompt = '\n\n[VERIFIED LIVE ONLINE SEARCH FACTS]:\n';
    uniqueResults.forEach((r, idx) => {
      groundingPrompt += `Source ${idx + 1}: ${r.source} - "${r.title}" (${r.url})\n`;
      if (r.extract) groundingPrompt += `Verified Content: ${r.extract}\n`;
      groundingPrompt += '\n';
    });

    groundingPrompt += `INSTRUCTIONS FOR OLLAMA INFERENCE:
1. Summarize the verified online facts under the heading:
   🌐 **Verified Online Information:**
2. Provide step-by-step guidance and SilentSOS recommendations under:
   🛡️ **Safety Guidance & Action Steps:**
3. Clearly distinguish retrieved facts from AI-generated explanations.
4. List the verified official sources with markdown links at the end under:
   📌 **Verified Official Sources:**
   • [Source Name - Title](URL)
5. NEVER invent, modify, or hallucinate sources, URLs, medical facts, or emergency numbers.`;

    const sources = uniqueResults.map(r => ({
      title: r.title,
      url: r.url,
      source: r.source
    }));

    return {
      hasOnlineData: true,
      offline: false,
      results: uniqueResults,
      sources,
      groundingPrompt,
      primarySource: uniqueResults[0]
    };
  } catch (err) {
    console.warn('[Online Search Engine] Search pipeline failure (offline mode):', err.message);
    return {
      hasOnlineData: false,
      offline: true,
      results: [],
      sources: []
    };
  }
}

/**
 * Checks whether user explicitly requested links
 */
export function userExplicitlyAskedForLinks(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase();
  return q.includes('link') || q.includes('url') || q.includes('source') || q.includes('website') || q.includes('where can i read') || q.includes('provide the link');
}

/**
 * Direct Online Knowledge Synthesis (Offline/Fallback when Ollama is unavailable)
 */
export function synthesizeOnlineResponse(query, onlineData) {
  if (!onlineData || !onlineData.primarySource) return null;

  const primary = onlineData.primarySource;
  const otherSources = onlineData.results || [];

  let reply = `🌐 **Verified Online Information: ${primary.title}**\n\n`;

  if (primary.extract) {
    reply += `${primary.extract}\n\n`;
  }

  reply += `🛡️ **Safety Guidance & Action Steps:**\n`;
  reply += `• Assess your surroundings and prioritize physical safety immediately.\n`;
  reply += `• In life-threatening emergencies, dial **112** (Universal Emergency) or **108** (Ambulance).\n`;
  reply += `• Trigger SilentSOS covert tracking or SOS dispatch if in danger.\n\n`;

  reply += `---\n📌 **Verified Official Sources:**\n`;
  otherSources.forEach(s => {
    if (s.url && s.title) {
      reply += `• [${s.source} - ${s.title}](${s.url})\n`;
    }
  });

  return {
    success: true,
    intent: 'live_online_web_search',
    category: 'Live Online Web Intelligence',
    confidence: 96,
    onlineFetched: true,
    reply,
    suggestions: [
      `What are the emergency protocols for this?`,
      `Where is the nearest hospital?`,
      `How does live GPS tracking work in SilentSOS?`
    ],
    sources: onlineData.sources || []
  };
}
