// api/cron-daily.js — Roz subah 6 AM chalega, news fetch + AI generate + DB save

import { fetchAllNews } from '../lib/rss.js';
import { scoreAllNews, calculateCoverage } from '../lib/scorer.js';
import { generateDeepContent, generateQuickScan, generateWeeklyRadar } from '../lib/ai.js';
import { supabase } from '../lib/supabase.js';

export const config = { maxDuration: 300 }; // 5 min timeout

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');

  // Security — cron secret check
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD IST
  console.log(`\n🚀 ClearUPSC Cron Starting — ${today}`);

  try {
    // ── STEP 1: Fetch RSS ─────────────────────────────────────────────────────
    console.log('Step 1: Fetching RSS news...');
    const rawNews = await fetchAllNews();
    if (!rawNews.length) {
      return res.status(200).json({ success: false, message: 'No news fetched from RSS' });
    }
    console.log(`  ✓ ${rawNews.length} raw news items`);

    // ── STEP 2: Score with PYQ weights ───────────────────────────────────────
    console.log('Step 2: Scoring with PYQ weights...');
    const scoredNews = await scoreAllNews(rawNews);
    const topNews = scoredNews.filter(n => n.tier === 'top').slice(0, 5);
    const scanNews = scoredNews.filter(n => n.tier === 'scan').slice(0, 15);
    console.log(`  ✓ TOP: ${topNews.length} | SCAN: ${scanNews.length}`);

    // ── STEP 3: Save to news_master (deduplicated by link) ───────────────────
    console.log('Step 3: Saving to database...');
    const allToSave = [...topNews, ...scanNews];
    const savedIds = {};

    for (const news of allToSave) {
      // Check if already exists (dedup by link — more reliable than title)
      const { data: existing } = await supabase
        .from('news_master')
        .select('id')
        .eq('link', news.link)
        .single();

      if (existing) {
        savedIds[news.link] = existing.id;
        console.log(`  ↩ Skipped duplicate: ${news.title.substring(0, 50)}`);
        continue;
      }

      const { data: saved, error } = await supabase
        .from('news_master')
        .insert({
          title: news.title,
          source: news.source || 'Google News',
          pub_date: news.pubDate,
          link: news.link,
          category: news.category,
          importance_score: news.score,
          tier: news.tier,
          quick_summary: news.oneLiner,
          importance_tag: news.importanceTag || (news.score >= 8 ? 'High' : 'Medium'),
          pyq_match: news.pyqMatch,
          topic: news.topic,
          exam_probability: news.examProbability,
          news_date: today
        })
        .select('id')
        .single();

      if (!error && saved) {
        savedIds[news.link] = saved.id;
        console.log(`  ✓ Saved: ${news.title.substring(0, 50)}`);
      } else if (error) {
        console.error(`  ✗ Save error: ${error.message}`);
      }
    }

    // ── STEP 4: Generate deep AI content for TOP 5 ──────────────────────────
    console.log('Step 4: Generating deep AI content for TOP 5...');
    for (const news of topNews) {
      const newsId = savedIds[news.link];
      if (!newsId) continue;

      // Check if AI content already exists
      const { data: existingAI } = await supabase
        .from('news_ai')
        .select('id')
        .eq('news_id', newsId)
        .single();

      if (existingAI) {
        console.log(`  ↩ AI content already exists for: ${news.title.substring(0, 40)}`);
        continue;
      }

      const aiContent = await generateDeepContent(news);

      if (!aiContent) {
        // Save minimal record so we know it was attempted
        console.warn(`  ✗ AI failed for: ${news.title.substring(0, 40)} — saving basic`);
      }

      const content = aiContent || {
        story: news.oneLiner || news.title,
        whyImportant: `${news.category} topic — UPSC relevant`,
        whatToRemember: [news.title],
        staticLink: [],
        keyPoints: [news.title],
        mainsAnswer: { question: '', intro: '', points: [], conclusion: '', keywords: [] },
        mcqs: [],
        quickRevision: news.oneLiner || news.title,
        mnemonic: { trick: '', explanation: '' },
        pyqConnection: news.pyqMatch || ''
      };

      const { error } = await supabase.from('news_ai').insert({
        news_id: newsId,
        story: content.story,
        why_important: content.whyImportant,
        what_to_remember: content.whatToRemember,
        static_link: content.staticLink,
        key_points: content.keyPoints,
        mains_answer: content.mainsAnswer,
        mcqs: content.mcqs,
        quick_revision: content.quickRevision,
        mnemonic: content.mnemonic,
        pyq_connection: content.pyqConnection
      });

      if (!error) {
        console.log(`  ✓ AI content saved: ${news.title.substring(0, 40)}`);
      } else {
        console.error(`  ✗ AI save error: ${error.message}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1500));
    }

    // ── STEP 5: Generate quick scan summaries ────────────────────────────────
    console.log('Step 5: Quick scan summaries...');
    const scanWithSummaries = await generateQuickScan(scanNews);

    for (const news of scanWithSummaries) {
      const newsId = savedIds[news.link];
      if (!newsId) continue;
      if (!news.quickSummary) continue;

      await supabase
        .from('news_master')
        .update({ quick_summary: news.quickSummary, importance_tag: news.importanceTag })
        .eq('id', newsId);
    }
    console.log(`  ✓ Quick scan summaries updated`);

    // ── STEP 6: Save coverage meter ──────────────────────────────────────────
    console.log('Step 6: Calculating coverage...');
    const coverage = calculateCoverage(scoredNews);

    await supabase.from('daily_coverage').upsert({
      coverage_date: today,
      coverage_percent: coverage.percent,
      top_count: coverage.topCount,
      scan_count: coverage.scanCount,
      message: coverage.message,
      categories: coverage.categories
    }, { onConflict: 'coverage_date' });
    console.log(`  ✓ Coverage: ${coverage.percent}%`);

    // ── STEP 7: Sunday — Weekly Radar ────────────────────────────────────────
    const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
    if (dayOfWeek === 'Sunday') {
      console.log('Step 7: Generating Weekly Radar (Sunday)...');
      const { data: weekNewsData } = await supabase
        .from('news_master')
        .select('title, category, topic, tier')
        .eq('tier', 'top')
        .gte('news_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      if (weekNewsData?.length) {
        const radar = await generateWeeklyRadar(weekNewsData);
        if (radar) {
          await supabase.from('weekly_radar').upsert({
            week_date: today,
            hot_topics: radar.hotTopics,
            week_summary: radar.weekSummary,
            must_revise: radar.mustRevise
          }, { onConflict: 'week_date' });
          console.log('  ✓ Weekly Radar saved');
        }
      }
    }

    console.log(`\n✅ Cron complete — ${today}`);
    return res.status(200).json({
      success: true,
      date: today,
      stats: {
        fetched: rawNews.length,
        top: topNews.length,
        scan: scanNews.length,
        coverage: coverage.percent
      }
    });

  } catch (err) {
    console.error('Cron fatal error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
