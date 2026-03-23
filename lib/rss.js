// lib/rss.js — Production-grade multi-source news fetcher
// Sources: Google News + PIB + The Hindu + Ministry feeds

const SOURCES = [
  {
    url: 'https://news.google.com/rss/search?q=RBI+supreme+court+parliament+bill+amendment+india&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'polity', priority: 3, name: 'Google News — Polity'
  },
  {
    url: 'https://news.google.com/rss/search?q=india+economy+budget+GDP+inflation+fiscal+RBI+SEBI&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'economy', priority: 3, name: 'Google News — Economy'
  },
  {
    url: 'https://news.google.com/rss/search?q=india+government+policy+scheme+ministry&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'polity', priority: 2, name: 'Google News — Policy'
  },
  {
    url: 'https://news.google.com/rss/search?q=india+environment+climate+COP+biodiversity+wildlife+forest&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'enviro', priority: 2, name: 'Google News — Environment'
  },
  {
    url: 'https://news.google.com/rss/search?q=india+international+relations+foreign+policy+bilateral+treaty&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'ir', priority: 2, name: 'Google News — IR'
  },
  {
    url: 'https://news.google.com/rss/search?q=india+science+technology+ISRO+space+nuclear+defense+research&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'science', priority: 2, name: 'Google News — Science'
  },
  {
    url: 'https://news.google.com/rss/search?q=india+geography+disaster+earthquake+flood+river+monsoon&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'geography', priority: 1, name: 'Google News — Geography'
  },
  {
    url: 'https://news.google.com/rss/search?q="ministry+of+finance"+OR+"ministry+of+environment"+OR+"ministry+of+external+affairs"+india&hl=en-IN&gl=IN&ceid=IN:en',
    category: 'polity', priority: 3, name: 'Ministry News'
  },

  // PIB — Most authoritative for UPSC
  { url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3',  category: 'polity',  priority: 4, name: 'PIB — Government' },
  { url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=10', category: 'economy', priority: 4, name: 'PIB — Economy' },
  { url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=14', category: 'enviro',  priority: 3, name: 'PIB — Environment' },
  { url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=24', category: 'science', priority: 3, name: 'PIB — Science' },

  // The Hindu — UPSC bible
  { url: 'https://www.thehindu.com/news/national/feeder/default.rss',      category: 'polity',  priority: 3, name: 'The Hindu — National' },
  { url: 'https://www.thehindu.com/business/feeder/default.rss',           category: 'economy', priority: 3, name: 'The Hindu — Business' },
  { url: 'https://www.thehindu.com/sci-tech/feeder/default.rss',           category: 'science', priority: 2, name: 'The Hindu — Sci-Tech' },
  { url: 'https://www.thehindu.com/news/international/feeder/default.rss', category: 'ir',      priority: 2, name: 'The Hindu — International' },
];

// ── FILTERS ───────────────────────────────────────────────────────────────────

const REJECT_KEYWORDS = [
  'bollywood', 'cricket', 'ipl', 'celebrity', 'actor', 'actress', 'film',
  'movie', 'box office', 'entertainment', 'gossip', 'marriage', 'divorce',
  'murder', 'rape', 'crime', 'accident', 'road crash', 'viral video',
  'tiktok', 'instagram', 'youtube views', 'meme', 'funny', 'onlyfans',
  'stock tip', 'buy now', 'discount', 'offer', 'sale',
  'horoscope', 'astrology', 'vastu', 'numerology', 'match preview',
  'live score', 'wicket', 'innings', 'batting', 'bowling'
];

const UPSC_BOOST_KEYWORDS = [
  'act', 'bill', 'amendment', 'policy', 'scheme', 'mission', 'authority',
  'commission', 'tribunal', 'committee', 'ordinance', 'notification', 'regulation',
  'supreme court', 'high court', 'judgment', 'verdict', 'constitutional',
  'parliament', 'lok sabha', 'rajya sabha', 'rbi', 'sebi', 'niti aayog',
  'gdp', 'inflation', 'fiscal', 'monetary', 'budget', 'revenue', 'tax',
  'isro', 'drdo', 'nuclear', 'satellite', 'mission', 'launch', 'research',
  'climate', 'cop', 'biodiversity', 'wildlife', 'forest', 'pollution', 'emission',
  'treaty', 'agreement', 'bilateral', 'multilateral', 'un ', 'who ', 'wto',
  'pib', 'government of india', 'ministry', 'department', 'central government',
  'digital', 'platform', 'sanction', 'reform', 'development', 'infrastructure',
  'election', 'constitution', 'fundamental', 'directive', 'article '
];

// Concept detector — maps news to UPSC concepts
const CONCEPT_MAP = [
  { keywords: ['digital', 'platform', 'fintech', 'upi', 'payment'],  concept: 'Digital Economy' },
  { keywords: ['sanction', 'diplomatic', 'bilateral', 'multilateral'], concept: 'International Relations' },
  { keywords: ['climate', 'emission', 'carbon', 'net zero', 'cop'],   concept: 'Climate Change & Paris Agreement' },
  { keywords: ['rbi', 'repo', 'monetary', 'inflation', 'mpc'],        concept: 'Monetary Policy' },
  { keywords: ['supreme court', 'high court', 'judgment', 'verdict'], concept: 'Judicial System' },
  { keywords: ['biodiversity', 'wildlife', 'forest', 'species'],      concept: 'Biodiversity & Conservation' },
  { keywords: ['isro', 'satellite', 'space', 'launch', 'mission'],    concept: 'Space Technology' },
  { keywords: ['parliament', 'lok sabha', 'rajya sabha', 'bill'],     concept: 'Parliamentary Procedure' },
  { keywords: ['gdp', 'fiscal', 'budget', 'deficit', 'revenue'],      concept: 'Fiscal Policy' },
  { keywords: ['nuclear', 'energy', 'reactor', 'uranium'],            concept: 'Nuclear Technology' },
  { keywords: ['scheme', 'mission', 'yojana', 'programme'],           concept: 'Government Schemes' },
  { keywords: ['amendment', 'constitution', 'article', 'fundamental'], concept: 'Constitutional Law' },
];

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

// FIX 1: UPSC keyword required + PIB always allowed
function isRelevant(title, sourceName = '') {
  const lower = title.toLowerCase();

  // Hard reject — even PIB ke liye (bad titles possible)
  for (const kw of REJECT_KEYWORDS) {
    if (lower.includes(kw)) return false;
  }

  // Fix 2 (title length): Low quality clickbait remove
  if (title.split(' ').length < 5) return false;

  // PIB is always authoritative — never miss it
  if (sourceName.includes('PIB')) return true;

  // All other sources must have at least 1 UPSC keyword
  const hasUPSC = UPSC_BOOST_KEYWORDS.some(k => lower.includes(k));
  return hasUPSC;
}

function getBoostScore(title) {
  const lower = title.toLowerCase();
  let boost = 0;
  for (const kw of UPSC_BOOST_KEYWORDS) {
    if (lower.includes(kw)) boost++;
  }
  return boost;
}

// FIX 2: Concept detector
function detectConcept(title) {
  const lower = title.toLowerCase();
  for (const { keywords, concept } of CONCEPT_MAP) {
    if (keywords.some(k => lower.includes(k))) return concept;
  }
  return null;
}

// FIX 4: Date filter — only last 48 hours
function isRecent(pubDate) {
  if (!pubDate) return true; // if no date, don't reject
  try {
    const newsDate = new Date(pubDate);
    const now = new Date();
    const diffMs = now - newsDate;
    return diffMs <= 1000 * 60 * 60 * 48; // 48 hours
  } catch {
    return true;
  }
}

function parseRSSXML(xml, source) {
  const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  const results = [];

  for (const item of items) {
    const title = cleanText(
      item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/s)?.[1] ||
      item.match(/<title>(.*?)<\/title>/s)?.[1] || ''
    );

    if (!title || title.length < 15) continue;
    if (!isRelevant(title, source.name)) continue;  // FIX 1+2 applied

    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/s)?.[1] || '';
    if (!isRecent(pubDate)) continue;  // FIX 4 applied

    const link =
      item.match(/<link>(.*?)<\/link>/s)?.[1] ||
      item.match(/<guid[^>]*>(.*?)<\/guid>/s)?.[1] || '';

    const sourceName = cleanText(
      item.match(/<source[^>]*>(.*?)<\/source>/s)?.[1] || source.name
    );

    const cleanLink = link
      .replace(/https:\/\/news\.google\.com\/rss\/articles\/.*?url=(https?:\/\/[^&]+).*/, '$1')
      .trim() || link;

    const boostScore = getBoostScore(title);

    // FIX 5: Minimum quality — at least 1 boost keyword (already guaranteed by isRelevant)
    if (boostScore < 1) continue;

    // FIX 2: Concept detection
    const concept = detectConcept(title);

    // FIX 3: Source weight added to final score
    const finalScore = boostScore + source.priority;

    results.push({
      title, link: cleanLink, pubDate,
      source: sourceName,
      category: source.category,
      boostScore,
      finalScore,  // FIX 3
      concept      // FIX 2
    });
  }
  return results;
}

async function fetchFeed(source) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClearUPSC-Bot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });

    clearTimeout(timeout);
    if (!res.ok) return [];

    const xml = await res.text();
    const items = parseRSSXML(xml, source);
    console.log(`  ✓ ${source.name}: ${items.length} items`);
    return items;

  } catch (e) {
    console.log(`  ✗ Failed: ${source.name} — ${e.message}`);
    return [];
  }
}

export async function fetchAllNews() {
  console.log(`\nFetching from ${SOURCES.length} sources...`);

  // Parallel fetch — fast
  const results = await Promise.allSettled(SOURCES.map(fetchFeed));

  const allNews = [];
  const seenLinks = new Set();
  const seenTitles = new Set();

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const item of result.value) {
      if (!item.title) continue;

      const linkKey = item.link?.substring(0, 100) || '';
      if (linkKey && seenLinks.has(linkKey)) continue;

      const titleKey = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60);
      if (seenTitles.has(titleKey)) continue;

      if (linkKey) seenLinks.add(linkKey);
      seenTitles.add(titleKey);
      allNews.push(item);
    }
  }

  // FIX 3: Sort by finalScore (boostScore + source priority)
  allNews.sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0));

  // FIX 4: Max 10 per category — balanced coverage, no economy spam
  const categoryCount = {};
  const balanced = [];
  for (const item of allNews) {
    const cat = item.category || 'other';
    if (!categoryCount[cat]) categoryCount[cat] = 0;
    if (categoryCount[cat] >= 10) continue;
    categoryCount[cat]++;
    balanced.push(item);
  }

  console.log(`Total unique UPSC-relevant news: ${balanced.length}`);
  console.log('Category breakdown:', categoryCount);
  return balanced.slice(0, 80);
}
