export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    // Latest India news — today's fresh content
    const url = 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pKVGlnQVAB?hl=en-IN&gl=IN&ceid=IN:en';
    
    const resp = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      } 
    });
    
    const xml = await resp.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
      const block = match[1];

      // Extract and clean each field
      const clean = (str) => str
        .replace(/<!\[CDATA\[|\]\]>/g, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
        .trim();

      const titleRaw = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
      const pubDateRaw = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const sourceRaw = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || '';

      const title = clean(titleRaw).replace(/ - [^-]{1,40}$/, '').trim();
      const pubDate = clean(pubDateRaw);
      const source = clean(sourceRaw);

      // Skip if title is too short or old UPSC coaching content
      if (title.length < 15) continue;
      if (source.match(/Vajiram|Vision IAS|Drishti|ClearTax|Econofact|IBEF|Diplomat/i)) continue;

      items.push({ title, pubDate, source });
    }

    if (!items.length) throw new Error('No fresh news found');

    const detect = (text) => {
      const t = text.toLowerCase();
      if (t.match(/rbi|repo|gdp|inflation|budget|rupee|market|bank|economy|finance|trade|tax/)) 
        return { cat:'economy', badgeClass:'badge-economy', badgeText:'Economy' };
      if (t.match(/environment|climate|pollution|forest|carbon|green|wildlife|flood|disaster/)) 
        return { cat:'enviro', badgeClass:'badge-enviro', badgeText:'Paryavaran' };
      if (t.match(/isro|nasa|space|tech|ai |research|satellite|science|digital|cyber/)) 
        return { cat:'science', badgeClass:'badge-science', badgeText:'Vigyan & Tech' };
      if (t.match(/china|pakistan|us |russia|foreign|international|treaty|bilateral|global|un |g20/)) 
        return { cat:'ir', badgeClass:'badge-ir', badgeText:'Videsh Niti' };
      return { cat:'polity', badgeClass:'badge-polity', badgeText:'Rajneeti' };
    };

    const news = items.map((item, i) => {
      const catInfo = detect(item.title);
      const tags = item.title.split(' ')
        .filter(w => w.length > 4 && !w.match(/^(that|this|with|from|have|been|will|their|about)$/i))
        .slice(0, 4);

      return {
        id: i + 1,
        ...catInfo,
        title: item.title,
        date: item.pubDate ? timeAgo(item.pubDate) : 'Aaj',
        source: item.source || 'Google News',
        summary: item.title + ' — Yeh khabar UPSC ke liye important hai. AI se explanation lo!',
        tags: tags.length ? tags : ['India', 'UPSC', catInfo.badgeText],
        difficulty: Math.floor(Math.random() * 3) + 1,
        trending: i < 2
      };
    });

    res.json({ success: true, news, total: news.length });

  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function timeAgo(dateStr) {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
    if (diff < 0) return 'Abhi';
    if (diff < 60) return `${diff} min pehle`;
    if (diff < 1440) return `${Math.floor(diff/60)} ghante pehle`;
    if (diff < 2880) return 'Kal';
    return `${Math.floor(diff/1440)} din pehle`;
  } catch(e) {
    return 'Aaj';
  }
}
