// lib/scorer.js — PYQ-weighted scoring (Groq — free)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const PYQ_SYSTEM = `You are a UPSC exam expert with 10 years of paper analysis experience.

UPSC PRELIMS — HIGH FREQUENCY TOPICS (2014-2024):

ECONOMY (17 q/year — HIGHEST PRIORITY):
- Monetary Policy, Repo Rate, RBI functions, MPC
- GDP, inflation (CPI/WPI), fiscal deficit, FRBM
- Budget, taxation (GST, direct/indirect), fiscal policy
- Banking sector, NPAs, financial inclusion, Jan Dhan
- Trade policy, FDI, FII, FEMA, BoP
- Economic Survey, NITI Aayog, Planning Commission history
- WTO, IMF, World Bank, ADB, NDB

POLITY (15 q/year):
- Constitutional Articles — 32, 226, 356, 368, 370 (historical)
- Fundamental Rights, DPSP, Fundamental Duties
- Parliament procedures — bills, sessions, committees, zero hour
- Supreme Court/HC jurisdiction, recent landmark judgments
- President, Governor powers, constitutional deadlock
- Panchayati Raj — 73rd/74th amendments, devolution
- Election Commission, CAG, UPSC, Finance Commission

ENVIRONMENT (14 q/year):
- Climate change, Paris Agreement, NDCs, UNFCCC
- COP summits — recent decisions most important
- Biodiversity conventions — CBD, CITES, Ramsar, Bonn
- Protected areas — national parks, wildlife sanctuaries, biosphere reserves
- NGT judgments, pollution laws (Air/Water/EP Act)
- Renewable energy — solar mission, green hydrogen, wind
- SDGs, sustainable development goals

GEOGRAPHY (12 q/year):
- Indian rivers, watersheds, linking projects
- Mountain passes, important peaks
- Cyclones, monsoon mechanism, El Nino/La Nina
- Mineral distribution, critical minerals
- Coastal geography, maritime zones, EEZ
- International boundaries, border disputes

SCIENCE & TECH (11 q/year):
- ISRO missions — current ones MOST important
- Space — satellites, launch vehicles, recent achievements
- Biotechnology, CRISPR, GM crops, biosafety
- Nuclear — civilian program, treaties (NPT, CTBT)
- Defense technology, recent acquisitions
- Health tech, new vaccines, disease outbreaks

HISTORY (10 q/year):
- Freedom struggle — 1857 to 1947, key personalities
- Constitutional history — committees, Acts before independence
- Socio-religious reform movements
- Ancient India — Maurya, Gupta, Indus Valley
- Medieval — Delhi Sultanate, Mughal, Bhakti/Sufi

ART & CULTURE (5 q/year):
- Classical dance forms, music gharanas
- UNESCO World Heritage Sites (India)
- Ancient texts, literature, architecture styles

KEY PATTERN: Policy change → question CONFIRMED next prelims
SC judgment → constitutional article question
International summit → environment/IR question
Report/Index released → economy/development question`;

export async function scoreAllNews(newsList) {
  if (!newsList.length) return [];

  const titlesJSON = newsList.map((n, i) => `${i}: "${n.title}"`).join('\n');

  const prompt = `Score each news item for UPSC Prelims exam relevance.

News items:
${titlesJSON}

Scoring criteria:
8-10 (TOP — HIGH exam probability):
  - Direct policy change, RBI decision, SC judgment, new law/amendment
  - Matches HIGH FREQUENCY PYQ topics
  - International agreement India signed/ratified
  - Major government scheme launched/modified
  
5-7 (SCAN — moderate relevance):
  - Indirectly related to syllabus
  - Reports/indices/surveys released
  - Background context news
  
1-4 (IGNORE):
  - Crime, sports results, entertainment, bollywood
  - Local/state news without national policy angle
  - Celebrity news, political drama without policy substance

Return ONLY this JSON (no extra text):
{
  "results": [
    {
      "index": 0,
      "score": 9,
      "tier": "top",
      "category": "economy",
      "topic": "Monetary Policy",
      "pyqMatch": "RBI functions — 2019, 2021, 2023 prelims mein aaya tha",
      "examProbability": 85,
      "oneLiner": "RBI repo rate 6% ki — EMI aur liquidity par seedha asar"
    }
  ]
}

category must be one of: polity/economy/enviro/ir/science/geography/history/art`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: PYQ_SYSTEM },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
        temperature: 0.1
      })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON found in scorer response');

    const parsed = JSON.parse(match[0]);
    const results = parsed.results || [];

    return newsList.map((news, i) => {
      const r = results.find(x => x.index === i) || {
        score: 3, tier: 'ignore', category: 'polity',
        topic: 'General', pyqMatch: '', examProbability: 10, oneLiner: news.title
      };
      return {
        ...news,
        score: r.score,
        tier: r.tier,
        category: r.category,
        topic: r.topic,
        pyqMatch: r.pyqMatch,
        examProbability: r.examProbability,
        oneLiner: r.oneLiner
      };
    });

  } catch (e) {
    console.error('Scorer error:', e.message);
    // Fallback — don't crash, return basic scored items
    return newsList.map(n => ({
      ...n, score: 5, tier: 'scan', category: 'polity',
      topic: 'General', pyqMatch: '', examProbability: 40, oneLiner: n.title
    }));
  }
}

export function calculateCoverage(scoredNews) {
  const top = scoredNews.filter(n => n.tier === 'top').length;
  const scan = scoredNews.filter(n => n.tier === 'scan').length;
  const total = scoredNews.filter(n => n.tier !== 'ignore').length;

  const coveragePercent = Math.min(97, Math.round(((top * 2 + scan) / Math.max(total * 2, 1)) * 100));

  const categories = {};
  scoredNews.filter(n => n.tier !== 'ignore').forEach(n => {
    categories[n.category] = (categories[n.category] || 0) + 1;
  });

  return {
    percent: coveragePercent,
    topCount: top,
    scanCount: scan,
    totalRelevant: total,
    categories,
    message: coveragePercent >= 90
      ? `Aaj ki ${coveragePercent}% UPSC-relevant khabrein cover! ✅`
      : `${coveragePercent}% important khabrein cover ho gayi.`
  };
}
