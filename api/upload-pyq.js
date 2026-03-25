import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Invalid JSON format" });
    }

    const BATCH_SIZE = 100;

    for (let i = 0; i < questions.length; i += BATCH_SIZE) {
      const batch = questions.slice(i, i + BATCH_SIZE);

      const { error } = await supabase
        .from('pyq_questions')
        .upsert(batch, { onConflict: 'id' });

      if (error) throw error;
    }

    res.json({ success: true, count: questions.length });

  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
