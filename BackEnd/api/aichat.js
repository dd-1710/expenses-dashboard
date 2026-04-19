const router = require('express').Router();
const authMiddleware = require('../middleware/authmiddleware');
const Expense = require('../schemas/expenseSchema');
const User = require('../schemas/userSchema');
const mongoose = require('mongoose');
const Groq = require('groq-sdk');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

let groq;
if (GROQ_API_KEY) {
  groq = new Groq({ apiKey: GROQ_API_KEY });
}

const CHAT_MODEL = 'llama-3.3-70b-versatile';
const EXTRACTION_MODEL = 'llama-3.3-70b-versatile';

const VALID_CATEGORIES = [
  'Food', 'Shopping', 'Vacation', 'Health', 'Insurance',
  'Transportation', 'Entertainment', 'Bills', 'Education', 'Investment', 'Others'
];

// -------- Keyword fallback ----------
function extractExpenseFromKeywords(userMsg) {
  const amountMatch = userMsg.match(/(\d[\d,]*)/);
  if (!amountMatch) return null;

  const amount = parseInt(amountMatch[1].replace(/,/g, ''));
  if (!amount || amount <= 0 || amount > 10000000) return null;

  return {
    amount,
    category: 'Others',
    description: userMsg.substring(0, 100)
  };
}

// -------- UPI/SMS detection ----------
function looksLikeUPIOrSMS(message) {
  const msg = message.toLowerCase();
  const patterns = [
    /(?:paid|sent|debited|credited).*(?:upi|gpay|phonepe|paytm|bhim)/i,
    /(?:upi|gpay|phonepe|paytm|bhim).*(?:paid|sent|debited|credited)/i,
    /inr\s*[\d,]+.*debited/i,
    /debited.*inr\s*[\d,]+/i,
    /rs\.?\s*[\d,]+.*(?:debited|credited|transferred)/i,
    /(?:txn|transaction).*(?:id|ref|no)/i,
    /a\/c\s*(?:xx|\*)/i,
    /vpa[:\s]/i,
    /upi\s*ref/i
  ];
  return patterns.some(p => p.test(message));
}

// -------- Smart intent detection ----------
function detectIntent(message) {
  const msg = message.toLowerCase();

  if (msg.includes('help') || msg.includes('what can you do') || msg.includes('how can you help')) {
    return 'HELP';
  }

  // Burndown / forecast queries
  const burndownKeywords = [
    'when will i run out', 'burndown', 'forecast', 'last me',
    'how long', 'budget last', 'run out', 'days left',
    'daily limit', 'spend per day', 'daily budget',
    'how much per day', 'how much can i spend today',
    'pace', 'at this rate'
  ];
  if (burndownKeywords.some(k => msg.includes(k))) {
    return 'BURNDOWN';
  }

  // UPI / SMS paste — detect before general expense
  if (looksLikeUPIOrSMS(message)) {
    return 'UPI_SMS';
  }

  // Advice queries — asking for tips or recommendations
  const adviceKeywords = [
    'tip', 'tips', 'save', 'saving', 'advice', 'suggest', 'recommend',
    'reduce', 'cut', 'improve', 'budget better', 'overspending',
    'how to', 'should i', 'what should', 'help me save', 'too much'
  ];
  if (adviceKeywords.some(k => msg.includes(k))) {
    return 'ADVICE';
  }

  // Expense adding — mentions amounts with action verbs
  if (/\d/.test(msg) && (
    msg.includes('spent') || msg.includes('paid') || msg.includes('bought') ||
    msg.includes('add') || msg.includes('log') || msg.includes('record')
  )) {
    return 'EXPENSE';
  }

  return 'CHAT';
}

// -------- Safe JSON parse ----------
function safeJSONParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// -------- Build rich spending context ----------
async function buildSpendingContext(userId, budget) {
  const objectId = new mongoose.Types.ObjectId(userId);

  // Category breakdown
  const categoryData = await Expense.aggregate([
    { $match: { userId: objectId } },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);

  // Total spent
  const totalAgg = await Expense.aggregate([
    { $match: { userId: objectId } },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const totalSpent = totalAgg[0]?.total || 0;
  const remaining = budget - totalSpent;
  const spentPercent = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

  // Recent 10 transactions
  const recentExpenses = await Expense.find({ userId })
    .sort({ date: -1 })
    .limit(10)
    .select('amount category description date');

  // Current month spending
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthAgg = await Expense.aggregate([
    { $match: { userId: objectId, date: { $gte: monthStart } } },
    { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } }
  ]);
  const thisMonthTotal = thisMonthAgg.reduce((s, c) => s + c.total, 0);

  // Top single expense
  const topExpense = await Expense.findOne({ userId }).sort({ amount: -1 }).select('amount category description date');

  // -------- Burndown / daily limit calculation ----------
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0); // last day of month
  const daysLeft = Math.max(1, Math.ceil((monthEnd - now) / (1000 * 60 * 60 * 24)));
  const dailyLimit = remaining > 0 ? Math.round(remaining / daysLeft) : 0;

  // Calculate daily burn rate from this month's data
  const dayOfMonth = now.getDate();
  const dailyBurnRate = dayOfMonth > 0 ? Math.round(thisMonthTotal / dayOfMonth) : 0;
  const daysUntilBudgetZero = dailyBurnRate > 0 ? Math.round(remaining / dailyBurnRate) : null;
  const projectedMonthTotal = dailyBurnRate * new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedOverUnder = budget - projectedMonthTotal;

  // Build context string
  const categoryLines = categoryData.map(c =>
    `  • ${c._id}: ₹${c.total} (${c.count} transactions, ${budget > 0 ? Math.round((c.total / totalSpent) * 100) : 0}% of spending)`
  ).join('\n');

  const thisMonthLines = thisMonthAgg.map(c =>
    `  • ${c._id}: ₹${c.total} (${c.count} txns)`
  ).join('\n');

  const recentLines = recentExpenses.map(e =>
    `  • ₹${e.amount} on ${e.category}${e.description ? ' (' + e.description + ')' : ''} — ${e.date.toLocaleDateString()}`
  ).join('\n');

  return {
    totalSpent,
    remaining,
    spentPercent,
    categoryData,
    thisMonthTotal,
    context: `
=== USER'S FINANCIAL SNAPSHOT ===
Budget: ₹${budget} | Spent: ₹${totalSpent} | Remaining: ₹${remaining} | Used: ${spentPercent}%

--- Category Breakdown (All Time) ---
${categoryLines || '  No expenses yet'}

--- This Month (${now.toLocaleString('default', { month: 'long' })}) ---
Total: ₹${thisMonthTotal}
${thisMonthLines || '  No expenses this month'}

--- Recent Transactions ---
${recentLines || '  No recent transactions'}

--- Biggest Single Expense ---
${topExpense ? `₹${topExpense.amount} on ${topExpense.category}${topExpense.description ? ' (' + topExpense.description + ')' : ''}` : 'None'}

--- Budget Forecast ---
Days left in month: ${daysLeft}
Daily spending limit to stay in budget: ₹${dailyLimit}/day
Current daily burn rate: ₹${dailyBurnRate}/day
${daysUntilBudgetZero !== null ? `At current pace, budget runs out in: ${daysUntilBudgetZero} days` : 'No spending data to project'}
Projected month-end total: ₹${projectedMonthTotal}
${projectedOverUnder >= 0 ? `Projected to save: ₹${projectedOverUnder}` : `Projected to overshoot by: ₹${Math.abs(projectedOverUnder)}`}
`.trim()
  };
}

// -------- Route ----------
router.post('/aichat', authMiddleware, async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(503).json({
        reply: 'AI assistant is temporarily unavailable.'
      });
    }

    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ message: 'Message is required' });
    }

    const intent = detectIntent(message);

    // -------- HELP ----------
    if (intent === 'HELP') {
      return res.json({
        reply: `Here's what I can do for you:

**� Paste UPI/SMS to add expenses**
• Paste "Paid ₹450 to Swiggy via UPI" — I'll auto-extract it
• Paste bank SMS like "INR 1,200 debited at Amazon"
• I detect the merchant and pick the right category

**⏱️ Budget forecast**
• "How much can I spend per day?"
• "When will I run out of budget?"
• "Am I on pace this month?"

**💡 Personalized advice**
• "Tips to save money" — I'll suggest cuts based on YOUR actual data
• "Am I overspending anywhere?"

**➕ Quick add (no forms!)**
• "Spent ₹500 on food"
• "₹1200 rent, ₹300 groceries" — adds multiple at once`
      });
    }

    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user || !user.budget) {
      return res.status(403).json({
        reply: 'Please set your monthly budget first before I can help you.'
      });
    }

    // Build rich context for AI
    const spending = await buildSpendingContext(userId, user.budget);

    let addedExpenses = [];

    // -------- UPI/SMS + EXPENSE EXTRACTION ----------
    if (intent === 'UPI_SMS' || intent === 'EXPENSE') {
      try {
        const extraction = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `Extract ALL expenses from the user's message. The message may be a UPI notification, bank SMS, or natural language.
Today's date is ${new Date().toISOString().split('T')[0]}.

Return ONLY JSON:
{
  "expenses": [
    { "amount": number, "category": string, "description": string, "date": "YYYY-MM-DD" }
  ]
}

Rules:
- Parse UPI messages like "Paid ₹450 to Swiggy via UPI" → amount: 450, category: Food, description: Swiggy
- Parse bank SMS like "INR 1,200 debited at Amazon" → amount: 1200, category: Shopping, description: Amazon
- Parse natural text like "Spent 500 on food" → amount: 500, category: Food
- Identify merchant names and map to categories: Swiggy/Zomato→Food, Amazon/Flipkart→Shopping, Uber/Ola→Transportation, Netflix/Hotstar→Entertainment, etc.
- For date: extract from message if mentioned ("yesterday", "last Monday", "on 15th", date in SMS). If no date mentioned, use today: ${new Date().toISOString().split('T')[0]}
- Date must be in YYYY-MM-DD format and must not be in the future or older than 1 year
- Ignore invalid or zero amounts
- Categories must be from: ${VALID_CATEGORIES.join(', ')}
- Pick the best matching category based on the merchant/description
- If no category fits, use "Others"
- If no valid expenses found → { "expenses": [] }`
            },
            { role: 'user', content: message }
          ],
          model: EXTRACTION_MODEL,
          temperature: 0,
          response_format: { type: 'json_object' }
        });

        const parsed = safeJSONParse(extraction.choices[0].message.content);

        if (parsed && Array.isArray(parsed.expenses)) {
          for (const item of parsed.expenses) {
            const amount = parseInt(item.amount);

            if (!amount || amount <= 0 || amount > 10000000) continue;

            // Validate extracted date — must be within last 1 year and not future
            let expenseDate = new Date();
            if (item.date) {
              const parsed = new Date(item.date);
              const oneYearAgo = new Date();
              oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
              if (!isNaN(parsed.getTime()) && parsed <= new Date() && parsed >= oneYearAgo) {
                expenseDate = parsed;
              }
            }

            const newExpense = await Expense.create({
              userId,
              amount,
              category: VALID_CATEGORIES.includes(item.category)
                ? item.category
                : 'Others',
              description: item.description || '',
              date: expenseDate
            });

            addedExpenses.push(newExpense);
          }
        }
      } catch (err) {
        // fallback (single)
        const fallback = extractExpenseFromKeywords(message);

        if (fallback) {
          const newExpense = await Expense.create({
            userId,
            amount: fallback.amount,
            category: fallback.category,
            description: fallback.description,
            date: new Date()
          });

          addedExpenses.push(newExpense);
        }
      }
    }

    // -------- Build system prompt based on intent ----------
    let systemPrompt;

    if (intent === 'BURNDOWN') {
      systemPrompt = `You are a smart budget forecaster. The user wants to know about their spending pace and daily limits.

${spending.context}

Rules:
• Focus on the Budget Forecast section — daily limit, burn rate, projected totals
• Be specific: "You can spend ₹X per day for the next Y days"
• If they'll overshoot, warn them clearly with exact numbers
• If they're on track, be encouraging
• Mention how many days are left in the month
• Keep it under 80 words
• Use ₹`;

    } else if (intent === 'UPI_SMS' && addedExpenses.length > 0) {
      const addedSummary = addedExpenses.map(e => `₹${e.amount} — ${e.category}${e.description ? ' (' + e.description + ')' : ''}`).join(', ');
      systemPrompt = `You are a friendly expense assistant. The user pasted a UPI notification or bank SMS and you extracted and saved the expense(s).

${spending.context}

Just added from UPI/SMS: ${addedSummary}

Rules:
• Confirm what was extracted and saved with a ✓
• Show the merchant name and category you picked
• Show updated remaining budget
• Keep it under 50 words
• Use ₹`;

    } else if (intent === 'ADVICE') {
      systemPrompt = `You are a personal finance advisor. Give practical, personalized advice based on the user's real spending data.

${spending.context}

Rules:
• Give 3-4 specific, actionable tips based on THEIR data
• Reference their actual numbers (e.g., "You spend ₹X on Food which is Y% of your budget")
• Suggest realistic cuts — don't say "stop spending", say "try reducing Food by 20% to save ₹Z"
• Keep it under 120 words
• Use ₹ for amounts
• Be encouraging, not judgmental`;

    } else if (intent === 'EXPENSE' && addedExpenses.length > 0) {
      const addedSummary = addedExpenses.map(e => `₹${e.amount} (${e.category})`).join(', ');
      systemPrompt = `You are a friendly expense assistant. Confirm the expense(s) were added.

${spending.context}

Just added: ${addedSummary}

Rules:
• Confirm what was added with a ✓
• Show updated remaining budget
• If they're over 80% budget usage, add a brief warning
• Keep it under 50 words
• Use ₹`;

    } else {
      systemPrompt = `You are a helpful expense assistant with access to the user's spending data.

${spending.context}

Rules:
• Answer based on real data when relevant
• Max 80 words
• Use ₹ for amounts
• Be conversational but concise
• If they ask about spending amounts or categories, briefly answer but suggest checking the Analytics tab for charts
• If they seem to be trying to add an expense, guide them to say "Spent ₹X on Y"
• If they ask something forecast-related, give daily limit and burndown info from the Budget Forecast data`;
    }

    // -------- CHAT RESPONSE ----------
    const chat = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      model: CHAT_MODEL,
      temperature: intent === 'BURNDOWN' ? 0.3 : 0.5
    });

    return res.json({
      reply: chat.choices[0].message.content,
      intent,
      expenseAdded: addedExpenses.length > 0,
      expenses: addedExpenses
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      reply: 'Something went wrong. Please try again.'
    });
  }
});

module.exports = router;