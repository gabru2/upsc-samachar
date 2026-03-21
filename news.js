export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    const feeds = [
      'https://feeds.feedburner.com/ndtvnews-india-news',
      'https://www.thehindu.com/news/national/feeder/default.rss',
      'https://indianexpress.com/section/india/feed/'
    ];

    const rssUrl = encodeURIComponent(feeds[0]);
    const resp = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&count=15`);
    const data = await resp.json();

    if (data.status !== 'ok') throw new Error('RSS fetch failed');

    const CAT_MAP = {
      economy: { cat: 'economy', badgeClass: 'badge-economy', badgeText: 'Economy' },
      environment: { cat: 'enviro', badgeClass: 'badge-enviro', badgeText: 'Paryavaran' },
      science: { cat: 'science', badgeClass: 'badge-science', badgeText: 'Vigyan & Tech' },
      world: { cat: 'ir', badgeClass: 'badge-ir', badgeText: 'Videsh Niti' },
      politics: { cat: 'polity', badgeClass: 'badge-polity', badgeText: 'Rajneeti' }
    };

    const news = data.items.map((item, i) => {
      const text = (item.title + ' ' + (item.description || '')).toLowerCase();
      let catInfo = CAT_MAP.politics;
      if (text.match(/economy|rbi|gdp|inflation|budget|rupee|market|bank/)) catInfo = CAT_MAP.economy;
      else if (text.match(/environment|climate|pollution|forest|carbon|green/)) catInfo = CAT_MAP.environment;
      else if (text.match(/science|space|isro|nasa|tech|ai|research/)) catInfo = CAT_MAP.science;
      else if (text.match(/china|pakistan|us |russia|foreign|international|global/)) catInfo = CAT_MAP.world;

      const words = item.title.split(' ').filter(w => w.length > 4).slice(0, 4);
      const cleanDesc = (item.description || '').replace(/<[^>]*>/g, '').slice(0, 200);

      return {
        id: i + 1,
        cat: catInfo.cat,
        badgeClass: catInfo.badgeClass,
        badgeText: catInfo.badgeText,
        title: item.title,
        date: item.pubDate ? timeAgo(item.pubDate) : 'Aaj',
        source: 'NDTV',
        summary: cleanDesc + '…',
        tags: words.length ? words : [catInfo.badgeText, 'India', 'UPSC'],
        difficulty: Math.floor(Math.random() * 3) + 1,
        trending: i < 2
      };
    });

    res.json({ success: true, news });

  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return `${diff} min pehle`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ghante pehle`;
  return `${Math.floor(diff / 1440)} din pehle`;
}
