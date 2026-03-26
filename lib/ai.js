// lib/ai.js — Deep UPSC content generator (Groq primary, OpenAI fallback)

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// ─── DEEP CONTENT — TOP 5 news ───────────────────────────────────────────────
export async function generateDeepContent(news) {
  const prompt = `You are India's best UPSC teacher — IAS rank 1 mentor.

News: "${news.title}"
Category: ${news.category}
Topic: ${news.topic}

Generate complete UPSC study content. Return ONLY this JSON (no markdown, no extra text):

{
  "story": "7-8 line relatable story/analogy for a common Indian. Start with a real person (Ramesh, Priya, a farmer, a student). Make it emotional and memorable. Explain the news through their experience.",
  
  "whyImportant": "2-3 lines — exactly why UPSC paper setters care about this topic. Which GS paper (GS1/GS2/GS3/GS4), which specific syllabus topic it maps to, and what type of question (Prelims fact or Mains analytical) it typically generates.",
  
  "whatToRemember": [
    "Most important fact with number/date/name — exactly as should be remembered",
    "Second key fact — specific and exam-oriented",
    "Third key fact",
    "Fourth key fact",
    "Fifth key fact — include a common trap/misconception if relevant"
  ],
  
  "staticLink": [
    "Related static topic 1 — specific chapter/article/act to study",
    "Related static topic 2",
    "Related static topic 3"
  ],
  
  "keyPoints": [
    "Prelims-ready fact 1 — include specific numbers, names, dates",
    "Prelims-ready fact 2",
    "Prelims-ready fact 3",
    "Prelims-ready fact 4",
    "Prelims-ready fact 5"
  ],
  
  "mainsAnswer": {
    "question": "UPSC Mains style question based on this news (150-200 words)",
    "intro": "2-3 line strong intro with context and hook",
    "points": [
      "Point 1 with sub-details",
      "Point 2 with sub-details",
      "Point 3 with sub-details",
      "Point 4 with sub-details"
    ],
    "conclusion": "2-3 line forward-looking conclusion with way forward",
    "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]
  },
  
  "mcqs": [
    {
      "q": "Factual MCQ — direct fact from news",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "answer": "A",
      "explanation": "Why A is correct — 2 lines with the key fact"
    },
    {
      "q": "Conceptual MCQ — testing understanding",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "answer": "B",
      "explanation": "Why B is correct — common misconception addressed"
    },
    {
      "q": "Statement-based MCQ (UPSC style) — 'Consider the following statements...'",
      "options": ["A) Only 1", "B) Only 2", "C) Both 1 and 2", "D) Neither 1 nor 2"],
      "answer": "C",
      "explanation": "Both statements explained with reasoning"
    }
  ],
  
  "quickRevision": "3-4 line summary — everything important in one paragraph. Include numbers, names, key terms. Student should be able to recall the entire topic from this alone.",
  
  "mnemonic": {
    "trick": "Memory trick — acronym, story, rhyme, or visual association",
    "explanation": "How to use this trick to remember the key facts"
  },
  
  "pyqConnection": "${news.pyqMatch || 'Related topics have appeared in UPSC Prelims previously'}"
}`;

  // Try Groq first (free)
  try {
    const groqRes = await callGroq(prompt, 1800);
    if (groqRes) return groqRes;
  } catch (e) {
    console.log('Groq failed, trying OpenAI:', e.message);
  }

  // Fallback to OpenAI if available
  if (process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(prompt, 1800);
    } catch (e) {
      console.error('OpenAI also failed:', e.message);
    }
  }

  // Last resort — basic fallback content
  return generateFallbackContent(news);
}

// ─── QUICK SCAN — batch 1-liner summaries ────────────────────────────────────
export async function generateQuickScan(scanNews) {
  if (!scanNews.length) return scanNews;

  const titlesText = scanNews.map((n, i) => `${i}. "${n.title}"`).join('\n');

  const prompt = `UPSC expert. Generate 1-line summary for each news.

News:
${titlesText}

Rules:
- Max 15 words per summary
- Include: key number/name/fact if present
- UPSC angle — how is it exam-relevant
- Simple Hindi-English mix ok

Return ONLY JSON:
{
  "summaries": [
    {"index": 0, "summary": "15 word UPSC summary", "importanceTag": "High"}
  ]
}
importanceTag must be: High, Medium, or Low`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 600,
        temperature: 0.2
      })
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON');

    const parsed = JSON.parse(match[0]);
    const summaries = parsed.summaries || [];

    return scanNews.map((news, i) => {
      const s = summaries.find(x => x.index === i) || {};
      return {
        ...news,
        quickSummary: s.summary || news.oneLiner || news.title,
        importanceTag: s.importanceTag || 'Medium'
      };
    });
  } catch (e) {
    console.error('Quick scan error:', e.message);
    return scanNews.map(n => ({
      ...n,
      quickSummary: n.oneLiner || n.title,
      importanceTag: 'Medium'
    }));
  }
}

// ─── WEEKLY RADAR — Sunday prediction ────────────────────────────────────────
export async function generateWeeklyRadar(weekTopNews) {
  if (!weekTopNews?.length) return null;

  const titles = weekTopNews.slice(0, 20).map(n => `- ${n.title}`).join('\n');

  const prompt = `UPSC expert. Based on this week's important news, predict exam topics.

This week's top news:
${titles}

UPSC pattern: Policy changes → confirmed Prelims questions next cycle
SC judgments → constitutional questions
International summits → environment/IR questions

Return ONLY JSON:
{
  "hotTopics": [
    {
      "topic": "Topic name",
      "probability": "High",
      "reason": "Why UPSC will ask — 1 line with PYQ reference",
      "prepTip": "Exactly what to study — specific article/act/report",
      "category": "economy"
    }
  ],
  "weekSummary": "2-3 line UPSC-focused week summary — dominant themes and their exam angles",
  "mustRevise": ["Topic 1 — specific", "Topic 2 — specific", "Topic 3 — specific", "Topic 4", "Topic 5"]
}

Generate 4-5 hotTopics. probability must be: High, Medium, or Low`;

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.5
      })
    });

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    return JSON.parse(match[0]);
  } catch (e) {
    console.error('Weekly radar error:', e.message);
    return null;
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
async function callGroq(prompt, maxTokens = 1200) {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a UPSC expert teacher. Always respond with valid JSON only. No markdown formatting, no code blocks, no extra text.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.4
    })
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const text = data.choices?.[0]?.message?.content || '';
  return parseJSON(text);
}

async function callOpenAI(prompt, maxTokens = 1200) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a UPSC expert teacher. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens,
      temperature: 0.4,
      response_format: { type: 'json_object' }
    })
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);

  const text = data.choices?.[0]?.message?.content || '';
  return JSON.parse(text);
}

function parseJSON(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found');
  return JSON.parse(match[0]);
}

function generateFallbackContent(news) {
  return {
    story: `Yeh khabar hai: "${news.title}". Yeh UPSC ke liye important hai kyunki yeh ${news.category} se related hai.`,
    whyImportant: `Yeh topic UPSC ${news.category === 'polity' ? 'GS2' : news.category === 'economy' ? 'GS3' : 'GS1'} syllabus mein aata hai. Exam mein directly ya indirectly poochha ja sakta hai.`,
    whatToRemember: [news.title, `Category: ${news.category}`, `Topic: ${news.topic}`, 'Details ke liye refresh karein', 'AI content generate kar raha hai — thodi der baad retry karein'],
    staticLink: [`${news.topic} ka static portion padhein`, `${news.category} ke PYQ solve karein`],
    keyPoints: [news.title, `Yeh ${news.category} se related hai`, `Topic: ${news.topic}`, 'Important for upcoming Prelims', 'Check official sources for details'],
    mainsAnswer: {
      question: `${news.title} ke sandarbh mein iska UPSC par prabhav explain karein.`,
      intro: 'Is topic ka UPSC syllabus mein vishesh mahatva hai.',
      points: ['Background context', 'Current significance', 'Policy implications', 'Way forward'],
      conclusion: 'Yeh topic Prelims aur Mains dono ke liye important hai.',
      keywords: [news.topic, news.category, 'UPSC', 'India', 'Policy']
    },
    mcqs: [{
      q: `"${news.title.substring(0, 60)}..." — is news se kaun sa topic related hai?`,
      options: ['A) ' + news.topic, 'B) International Relations', 'C) Art & Culture', 'D) Ancient History'],
      answer: 'A',
      explanation: `Yeh news directly ${news.topic} se related hai jo ${news.category} ka part hai.`
    }],
    quickRevision: `${news.title} — ${news.category} category. Topic: ${news.topic}. ${news.pyqMatch || 'UPSC relevant topic.'}`,
    mnemonic: { trick: 'Topic ka pehla letter yaad rakho', explanation: `${news.topic} ko ${news.category} ke context mein yaad rakho.` },
    pyqConnection: news.pyqMatch || 'Related topics UPSC mein aate hain'
  };
}
