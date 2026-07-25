const OpenAI = require('openai');

const client = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const SYSTEM_PROMPT = `You triage a user's inbox. For each email given, return:
- priority: integer 1-10 (10 = needs attention right now, 1 = pure noise/promo)
- category: one of "urgent", "reply_needed", "meeting", "promotion", "low_priority"
- summary: a one-sentence summary of the email
- actionRequired: true or false

Respond with strict JSON: {"results": [{"id": <id>, "priority": <n>, "category": "<cat>", "summary": "<text>", "actionRequired": <bool>}, ...]}
The results array must have exactly one entry per input email, in the same order, matching by "id".`;

// Cheap heuristic used only if OpenAI is unavailable or errors, so IMAP fetch
// still returns something useful instead of failing outright.
function heuristicFallback(emails) {
  return emails.map((e) => {
    const subject = (e.subject || '').toLowerCase();
    let priority = 4;
    if (/urgent|asap|action required|deadline|critical/.test(subject)) priority = 9;
    else if (/re:/.test(subject)) priority = 6;
    else if (/newsletter|unsubscribe|promo|sale|offer/.test(subject)) priority = 2;
    return {
      id: e.id,
      priority,
      category: priority >= 8 ? 'urgent' : priority >= 5 ? 'reply_needed' : 'low_priority',
      summary: e.preview ? e.preview.slice(0, 120) : e.subject,
      actionRequired: priority >= 6,
    };
  });
}

async function prioritizeEmails(emails) {
  if (!emails.length) return [];
  if (!client) return heuristicFallback(emails);

  const payload = emails.map((e) => ({
    id: e.id,
    from: e.from,
    subject: e.subject,
    preview: e.preview,
  }));

  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(payload) },
      ],
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    const byId = new Map(parsed.results.map((r) => [String(r.id), r]));

    return emails.map((e) => {
      const r = byId.get(String(e.id));
      return r
        ? { id: e.id, priority: r.priority, category: r.category, summary: r.summary, actionRequired: !!r.actionRequired }
        : heuristicFallback([e])[0];
    });
  } catch (err) {
    console.error('OpenAI prioritization failed, falling back to heuristic scoring:', err.message);
    return heuristicFallback(emails);
  }
}

module.exports = { prioritizeEmails };
