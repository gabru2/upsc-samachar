export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    // Google News RSS — India UPSC relevant topics
    const googleNewsUrl = 'https://news.google.com/rss/search?q=india+government+policy+economy+environment&hl=en-IN&gl=IN&ceid=IN:en';
    
    const resp = await fetch(googleNewsUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    const xml = await resp.text();
    
    // Parse RSS XML manually
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null && items.length < 12) {
      const item = match[1];
      const title = (item.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const desc = (item.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
      const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const source = (item.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || 'News';
      
      // Clean title — remove source name at end
      const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/ - [^-]+$/, '').trim();
      const cleanDesc = desc.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').trim();
      
      if (cleanTitle) items.push({ title: cleanTitle, desc: cleanDesc, pubDate, source: source.replace(/<!\[CDATA\[|\]\]>/g, '') });
    }

    if (!items.length) throw new Error('No items parsed from RSS');

    const CAT_MAP = {
      economy: { cat: 'economy', badgeClass: 'badge-economy', badgeText: 'Economy' },
      environment: { cat: 'enviro', badgeClass: 'badge-enviro', badgeText: 'Paryavaran' },
      science: { cat: 'science', badgeClass: 'badge-science', badgeText: 'Vigyan & Tech' },
      world: { cat: 'ir', badgeClass: 'badge-ir', badgeText: 'Videsh Niti' },
      politics: { cat: 'polity', badgeClass: 'badge-polity', badgeText: 'Rajneeti' }
    };

    const news = items.map((item, i) => {
      const text = (item.title + ' ' + item.desc).toLowerCase();
      let catInfo = CAT_MAP.politics;
      if (text.match(/economy|rbi|gdp|inflation|budget|rupee|market|bank|finance|trade/)) catInfo = CAT_MAP.economy;
      else if (text.match(/environment|climate|pollution|forest|carbon|green|wildlife/)) catInfo = CAT_MAP.environment;
      else if (text.match(/science|space|isro|nasa|tech|ai|research|satellite|moon/)) catInfo = CAT_MAP.science;
      else if (text.match(/china|pakistan|us |russia|foreign|international|global|treaty/)) catInfo = CAT_MAP.world;

      const words = item.title.split(' ').filter(w => w.length > 4).slice(0, 4);

      return {
        id: i + 1,
        cat: catInfo.cat,
        badgeClass: catInfo.badgeClass,
        badgeText: catInfo.badgeText,
        title: item.title,
        date: item.pubDate ? timeAgo(item.pubDate) : 'Aaj',
        source: item.source || 'Google News',
        summary: item.desc ? item.desc.slice(0, 200) + '…' : 'Click to read more.',
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
