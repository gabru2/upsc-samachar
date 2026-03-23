const RSS_FEEDS = [
  'https://news.google.com/rss/search?q=india+government+policy+scheme&hl=en-IN&gl=IN&ceid=IN:en',
  'https://news.google.com/rss/search?q=RBI+supreme+court+parliament+india&hl=en-IN&gl=IN&ceid=IN:en',
  'https://news.google.com/rss/search?q=india+environment+climate+biodiversity&hl=en-IN&gl=IN&ceid=IN:en',
  'https://news.google.com/rss/search?q=india+international+relations+foreign+policy&hl=en-IN&gl=IN&ceid=IN:en',
  'https://news.google.com/rss/search?q=india+science+technology+space+isro&hl=en-IN&gl=IN&ceid=IN:en',
];

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseRSSItem(item) {
  const title = cleanText(item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || '');
  const link = item.match(/<link>(.*?)<\/link>/)?.[1] || item.match(/<guid>(.*?)<\/guid>/)?.[1] || '';
  const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
  const source = cleanText(item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || '');
  const cleanLink = link.replace(/https:\/\/news\.google\.com\/rss\/articles\/.*?url=(.*?)(&|$)/, '$1') || link;
  return { title, link: cleanLink, pubDate, source };
}

export async function fetchAllNews() {
  const allNews = [];
  const seenLinks = new Set();
  const seenTitles = new Set();

  for (const feedUrl of RSS_FEEDS) {
    try {
      const res = await fetch(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ClearUPSC/1.0)' }
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];

      for (const item of items) {
        const parsed = parseRSSItem(item);
        if (!parsed.title || parsed.title.length < 10) continue;
        if (seenLinks.has(parsed.link)) continue;
        if (seenTitles.has(parsed.title.toLowerCase())) continue;

        seenLinks.add(parsed.link);
        seenTitles.add(parsed.title.toLowerCase());
        allNews.push(parsed);
      }
    } catch (e) {
      console.error(`RSS fetch failed:`, e.message);
    }
  }

  console.log(`RSS: Fetched ${allNews.length} unique news items`);
  return allNews.slice(0, 60);
}
