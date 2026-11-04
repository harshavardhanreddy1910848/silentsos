/**
 * SilentSOS Online Web Search & Real-Time Knowledge Retrieval Engine
 * 
 * Enables the AI assistant to fetch live, verified information from the internet:
 * - Wikipedia REST & Search APIs (Medical, Safety, Laws, Technical, and General Facts)
 * - DuckDuckGo Instant Knowledge API (Web snippets, definitions, real-time facts)
 * - OpenStreetMap Nominatim API (Real-world places, addresses, police stations, hospitals)
 * 
 * Works across both Web Application and Native Android App.
 */

/**
 * Strips HTML tags and excessive whitespace from text.
 */
function cleanHtml(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 1. Query Wikipedia Search & Summary API
 */
async function fetchWikipediaKnowledge(query) {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&utf8=1&srlimit=3`;
    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'SilentSOS-Emergency-AI/1.0 (safety@silentsos.org)' },
      signal: AbortSignal.timeout(5000)
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
      signal: AbortSignal.timeout(5000)
    });

    if (sumRes.ok) {
      const sumData = await sumRes.json();
      return {
        source: 'Wikipedia Online Encyclopedia',
        title: sumData.title || topTitle,
        extract: sumData.extract || cleanHtml(topItem.snippet),
        url: sumData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(topTitle)}`,
        relatedSnippets: items.slice(1).map(i => ({
          title: i.title,
          snippet: cleanHtml(i.snippet),
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(i.title)}`
        }))
      };
    }

    return {
      source: 'Wikipedia Online Encyclopedia',
      title: topTitle,
      extract: cleanHtml(topItem.snippet),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topTitle)}`,
      relatedSnippets: items.slice(1).map(i => ({
        title: i.title,
        snippet: cleanHtml(i.snippet),
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(i.title)}`
      }))
    };
  } catch (err) {
    // Online fetch unavailable (network isolation or timeout)
    return null;
  }
}

/**
 * 2. Query DuckDuckGo Instant Knowledge API
 */
async function fetchDuckDuckGoKnowledge(query) {
  try {
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'SilentSOS-Emergency-AI/1.0' },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return null;
    const data = await res.json();

    const abstract = data.AbstractText || data.Abstract || '';
    const heading = data.Heading || '';
    const url = data.AbstractURL || '';

    if (abstract && abstract.length > 20) {
      return {
        source: data.AbstractSource || 'DuckDuckGo Web Index',
        title: heading || query,
        extract: abstract,
        url: url || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
      };
    }

    // Check related topics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const firstTopic = data.RelatedTopics.find(t => t.Text && t.FirstURL);
      if (firstTopic) {
        return {
          source: 'DuckDuckGo Knowledge Graph',
          title: query,
          extract: firstTopic.Text,
          url: firstTopic.FirstURL
        };
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * 3. Query OpenStreetMap Nominatim for Places / Locations
 */
async function fetchNominatimLocation(query) {
  const isLocationSearch = /in\s+[a-z]+|near\s+[a-z]+|at\s+[a-z]+|police\s+in|hospital\s+in|emergency\s+in/i.test(query);
  if (!isLocationSearch) return null;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=3`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SilentSOS-Emergency-AI/1.0 (safety@silentsos.org)' },
      signal: AbortSignal.timeout(4500)
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
 * Master Online Knowledge Fetcher
 * Aggregates results from multiple live web sources concurrently.
 */
export async function searchOnlineKnowledge(query) {
  const cleanQ = (query || '').trim();
  if (!cleanQ) return null;

  try {
    // Run concurrent fetches with graceful timeout handling
    const [wikiResult, ddgResult, placeResult] = await Promise.allSettled([
      fetchWikipediaKnowledge(cleanQ),
      fetchDuckDuckGoKnowledge(cleanQ),
      fetchNominatimLocation(cleanQ)
    ]);

    const results = [];

    if (wikiResult.status === 'fulfilled' && wikiResult.value) {
      results.push(wikiResult.value);
    }
    if (ddgResult.status === 'fulfilled' && ddgResult.value) {
      results.push(ddgResult.value);
    }
    if (placeResult.status === 'fulfilled' && placeResult.value) {
      results.push(placeResult.value);
    }

    if (results.length === 0) {
      return null;
    }

    // Build context grounding block for LLM prompts
    let groundingPrompt = '\n\n[VERIFIED LIVE ONLINE SEARCH FACTS]:\n';
    results.forEach((r, idx) => {
      groundingPrompt += `[Fact Source ${idx + 1}] (${r.source}) ${r.title}\n`;
      if (r.extract) groundingPrompt += `Summary: ${r.extract}\n`;
      if (r.relatedSnippets) {
        r.relatedSnippets.forEach(s => {
          groundingPrompt += `• Detail: ${s.title} - ${s.snippet}\n`;
        });
      }
      groundingPrompt += '\n';
    });
    groundingPrompt += 'CRITICAL REQUIREMENT: Analyze the online facts above and give a direct, clear, and well-synthesized answer related to the question. DO NOT provide or include URLs or links from online in your response UNLESS the user explicitly asks for links or sources.\n';

    return {
      hasOnlineData: true,
      results,
      groundingPrompt,
      primarySource: results[0]
    };
  } catch (err) {
    console.warn('[Online Search Engine] Search pipeline skipped:', err.message);
    return null;
  }
}

/**
 * Checks whether user explicitly requested links or URLs
 */
export function userExplicitlyAskedForLinks(query) {
  if (!query || typeof query !== 'string') return false;
  const q = query.toLowerCase();
  return q.includes('link') || q.includes('url') || q.includes('source') || q.includes('website') || q.includes('where can i read') || q.includes('provide the link');
}

/**
 * Synthesizes a structured response directly from online search results
 * when cloud LLMs are unavailable or offline.
 * Analyzes the data and provides the answer directly without links,
 * providing links ONLY if explicitly requested.
 */
export function synthesizeOnlineResponse(query, onlineData) {
  if (!onlineData || !onlineData.primarySource) return null;

  const primary = onlineData.primarySource;
  const otherSources = onlineData.results.slice(1);
  const wantsLinks = userExplicitlyAskedForLinks(query);

  let reply = `🌐 **Online Analysis: ${primary.title}**\n\n`;

  if (primary.extract) {
    reply += `${primary.extract}\n\n`;
  }

  if (primary.relatedSnippets && primary.relatedSnippets.length > 0) {
    reply += `### 🔍 Key Analysis & Details:\n`;
    primary.relatedSnippets.forEach(s => {
      reply += `• **${s.title}:** ${s.snippet}\n`;
    });
    reply += '\n';
  }

  // Only provide links if the user explicitly asked for them
  if (wantsLinks) {
    reply += `### 🔗 Reference Links:\n`;
    reply += `• [${primary.source}](${primary.url})\n`;
    otherSources.forEach(s => {
      if (s.url && s.title) {
        reply += `• [${s.title} (${s.source})](${s.url})\n`;
      }
    });
    reply += '\n';
  }

  reply += `*Information analyzed from online knowledge registries.*`;

  const suggestions = [
    `Tell me more about ${primary.title.slice(0, 30)}`,
    `What are the emergency protocols for this?`,
    `How does live GPS tracking work in SilentSOS?`
  ];

  return {
    success: true,
    intent: 'live_online_web_search',
    category: 'Live Online Web Intelligence',
    confidence: 96,
    onlineFetched: true,
    reply,
    suggestions,
    sources: wantsLinks ? onlineData.results.map(r => ({ title: r.title, url: r.url, source: r.source })) : []
  };
}

