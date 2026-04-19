const { VALID_CATEGORIES, SUPPORTED_INTENTS, EXTRACTION_MODEL } = require('./constants');
const { safeJSONParse, extractAmountFromText, looksLikeUPIOrSMS } = require('./helpers');

function quickFallback(message) {
  const msg = String(message || '').toLowerCase();

  if (
    msg.includes('help') ||
    msg.includes('what can you do') ||
    msg.includes('how can you help')
  ) {
    return { intent: 'HELP', expenses: [] };
  }

  if (
    msg.includes('what if') ||
    msg.includes('what happens if') ||
    msg.includes('if i spend') ||
    msg.includes('suppose i spend')
  ) {
    const amount = extractAmountFromText(message);
    if (amount) {
      return { intent: 'WHAT_IF', amount, expenses: [] };
    }
  }

  if (
    msg.includes('remaining') ||
    msg.includes('left') ||
    msg.includes('budget status') ||
    msg.includes('how much did i spend') ||
    msg.includes('spent so far') ||
    msg.includes("what's my budget") ||
    msg.includes('whats my budget') ||
    msg.includes('my budget')
  ) {
    return { intent: 'GET_STATUS', expenses: [] };
  }

  if (
    msg.includes('daily limit') ||
    msg.includes('per day') ||
    msg.includes('run out') ||
    msg.includes('how long') ||
    msg.includes('forecast') ||
    msg.includes('burndown') ||
    msg.includes('how much can i spend')
  ) {
    return { intent: 'GET_BURNDOWN', expenses: [] };
  }

  if (
    msg.includes('tip') ||
    msg.includes('tips') ||
    msg.includes('save') ||
    msg.includes('saving') ||
    msg.includes('advice') ||
    msg.includes('suggest') ||
    msg.includes('spend less') ||
    msg.includes('cut cost') ||
    msg.includes('cut down') ||
    msg.includes('reduce') ||
    msg.includes('overspend')
  ) {
    return { intent: 'GET_ADVICE', expenses: [] };
  }

  if (
    msg.includes('recent expenses') ||
    msg.includes('last expenses') ||
    msg.includes('last 5') ||
    msg.includes('recent')
  ) {
    return { intent: 'GET_RECENT_EXPENSES', expenses: [], limit: 5 };
  }

  if (
    msg.includes('top category') ||
    msg.includes('highest category') ||
    msg.includes('most spending')
  ) {
    return { intent: 'GET_TOP_CATEGORY', expenses: [] };
  }

  for (const category of VALID_CATEGORIES) {
    const lc = category.toLowerCase();
    if (
      msg.includes(lc) &&
      (msg.includes('how much on') ||
        msg.includes('spent on') ||
        msg.includes(`${lc} spending`))
    ) {
      return { intent: 'GET_CATEGORY_SPEND', category, expenses: [] };
    }
  }

  const amount = extractAmountFromText(message);
  const expenseWords = ['spent', 'paid', 'bought', 'add', 'log', 'record'];

  if ((amount && expenseWords.some((word) => msg.includes(word))) || looksLikeUPIOrSMS(message)) {
    let category = 'Others';
    for (const c of VALID_CATEGORIES) {
      if (msg.includes(c.toLowerCase())) {
        category = c;
        break;
      }
    }
    return {
      intent: 'ADD_EXPENSE',
      expenses: [{ amount, category, description: message.slice(0, 120), date: null }]
    };
  }

  return { intent: 'UNKNOWN', expenses: [] };
}

async function extractIntent(message, groq) {
  const today = new Date().toISOString().split('T')[0];

  const systemPrompt = `
You are an expense assistant extractor.

Return ONLY valid JSON.
Do not return markdown.
Do not explain anything.

Schema:
{
  "intent": "ADD_EXPENSE" | "GET_STATUS" | "GET_REMAINING" | "GET_BURNDOWN" | "GET_ADVICE" | "GET_RECENT_EXPENSES" | "GET_TOP_CATEGORY" | "GET_CATEGORY_SPEND" | "WHAT_IF" | "HELP" | "UNKNOWN",
  "expenses": [
    {
      "amount": number,
      "category": string | null,
      "description": string,
      "date": "YYYY-MM-DD" | null
    }
  ],
  "category": string | null,
  "limit": number | null,
  "amount": number | null
}

Rules:
- Use only these categories: ${VALID_CATEGORIES.join(', ')}
- If the category is not explicitly mentioned or cannot be clearly inferred from the message, return category: null (inside expenses array too). Do NOT default to "Others"
- UPI or bank SMS may contain merchant and amount. Extract them as ADD_EXPENSE
- If date is not explicitly present in the message, return date: null
- If a date is mentioned, it must be between 2026-01-01 and today (${today}). If the year is before 2026, return date: null
- Never invent multiple expenses unless clearly mentioned
- "How much did I spend", "budget status", "remaining budget", "what's my budget" => GET_STATUS or GET_REMAINING
- "How much can I spend per day", "when will budget run out", "forecast" => GET_BURNDOWN
- "tips", "save money", "reduce spending" => GET_ADVICE
- "last 5 expenses", "recent expenses" => GET_RECENT_EXPENSES
- "highest category" => GET_TOP_CATEGORY
- "how much on food/shopping" => GET_CATEGORY_SPEND with category
- "what happens if I spend 500", "if I spend 1000 today", "what if I spend X", "what if I spend 200 every day" => WHAT_IF with amount
- Today's date is ${today}
- If unsure, return UNKNOWN
`;

  try {
    const response = await groq.chat.completions.create({
      model: EXTRACTION_MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });

    const parsed = safeJSONParse(response.choices?.[0]?.message?.content || '');

    if (!parsed || !SUPPORTED_INTENTS.includes(parsed.intent)) {
      return quickFallback(message);
    }

    return {
      intent: parsed.intent,
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      category: parsed.category || null,
      limit: Number.isInteger(parsed.limit) && parsed.limit > 0 ? parsed.limit : 5,
      amount:
        typeof parsed.amount === 'number' && parsed.amount > 0
          ? parsed.amount
          : null
    };
  } catch {
    return quickFallback(message);
  }
}

module.exports = { extractIntent, quickFallback };
