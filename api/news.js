export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const url = 'https://news.google.com/rss/search?q=india+government+policy+economy+environment+upsc&hl=en-IN&gl=IN&ceid=IN:en';
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const xml = await resp.text();

    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 12) {
      const item = match[1];
      const getTag = (tag) => {
        const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim() : '';
      };

      const title = getTag('title').replace(/ - [^-]+$/, '').trim();
      const pubDate = getTag('pubDate');
      const source = getTag('source');

      // Get description from media or description tag — clean all HTML
      let desc = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
      desc = desc.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ').trim();
      // Remove Google News link text from desc
      desc = desc.replace(/^https?:\/\/\S+/,'').trim();
      if (!desc || desc.length < 20) desc = title;

      if (title && title.length > 10) {
        items.push({ title, desc: desc.slice(0, 200), pubDate, source });
      }
    }

    if (!items.length) throw new Error('No items found');

    const detect = (text) => {
      const t = text.toLowerCase();
      if (t.match(/economy|rbi|gdp|inflation|budget|rupee|market|bank|finance|trade/)) return { cat:'economy', badgeClass:'badge-economy', badgeText:'Economy' };
      if (t.match(/environment|climate|pollution|forest|carbon|green|wildlife/)) return { cat:'enviro', badgeClass:'badge-enviro', badgeText:'Paryavaran' };
      if (t.match(/science|space|isro|nasa|tech|ai|research|satellite/)) return { cat:'science', badgeClass:'badge-science', badgeText:'Vigyan & Tech' };
      if (t.match(/china|pakistan|us |russia|foreign|international|global|treaty/)) return { cat:'ir', badgeClass:'badge-ir', badgeText:'Videsh Niti' };
      return { cat:'polity', badgeClass:'badge-polity', badgeText:'Rajneeti' };
    };

    const news = items.map((item, i) => {
      const catInfo = detect(item.title + ' ' + item.desc);
      const tags = item.title.split(' ').filter(w => w.length > 4).slice(0, 4);
      return {
        id: i + 1,
        ...catInfo,
        title: item.title,
        date: item.pubDate ? timeAgo(item.pubDate) : 'Aaj',
        source: item.source || 'Google News',
        summary: item.desc + '…',
        tags: tags.length ? tags : ['India', 'UPSC', catInfo.badgeText],
        difficulty: Math.floor(Math.random() * 3) + 1,
        trending: i < 2
      };
    });

    res.json({ success: true, news });

  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
  if (diff < 60) return `${diff} min pehle`;
  if (diff < 1440) return `${Math.floor(diff/60)} ghante pehle`;
  return `${Math.floor(diff/1440)} din pehle`;
}
