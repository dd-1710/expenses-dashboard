const router = require('express').Router();
const authMiddleware = require('../middleware/authmiddleware');
const Expense = require('../schemas/expenseSchema');
const User = require('../schemas/userSchema');
const Groq = require('groq-sdk');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

let groq;
if (GROQ_API_KEY) {
  groq = new Groq({ apiKey: GROQ_API_KEY });
}

const EXTRACTION_MODEL = 'llama-3.3-70b-versatile';

const VALID_CATEGORIES = [
  'Food',
  'Shopping',
  'Vacation',
  'Health',
  'Insurance',
  'Transportation',
  'Entertainment',
  'Bills',
  'Education',
  'Investment',
  'Others'
];

const SUPPORTED_INTENTS = [
  'ADD_EXPENSE',
  'GET_STATUS',
  'GET_REMAINING',
  'GET_BURNDOWN',
  'GET_ADVICE',
  'GET_RECENT_EXPENSES',
  'GET_TOP_CATEGORY',
  'GET_CATEGORY_SPEND',
  'WHAT_IF',
  'HELP',
  'UNKNOWN'
];

// ----------------------------
// Helpers
// ----------------------------

function safeJSONParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

function normalizeCategory(category) {
  if (!category || typeof category !== 'string') return 'Others';

  const found = VALID_CATEGORIES.find(
    (c) => c.toLowerCase() === category.trim().toLowerCase()
  );

  return found || 'Others';
}

function extractAmountFromText(message) {
  const match = String(message || '').match(/(\d[\d,]*)/);
  if (!match) return null;

  const amount = parseInt(match[1].replace(/,/g, ''), 10);
  if (!amount || amount <= 0 || amount > 10000000) return null;

  return amount;
}

function looksLikeUPIOrSMS(message) {
  const msg = String(message || '').toLowerCase();

  const patterns = [
    /(?:paid|sent|debited).*(?:upi|gpay|phonepe|paytm|bhim)/i,
    /(?:upi|gpay|phonepe|paytm|bhim).*(?:paid|sent|debited)/i,
    /inr\s*[\d,]+.*debited/i,
    /debited.*inr\s*[\d,]+/i,
    /rs\.?\s*[\d,]+.*(?:debited|transferred|paid)/i,
    /(?:txn|transaction).*(?:id|ref|no)/i,
    /upi\s*ref/i,
    /vpa[:\s]/i,
    /a\/c\s*(?:xx|\*)/i
  ];

  return patterns.some((p) => p.test(msg));
}

function getMonthEnd(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getMonthRange(date = new Date()) {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1)
  };
}

function getDaysLeftInMonth(date = new Date()) {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const monthEnd = getMonthEnd(date);
  const diffMs = monthEnd - today;
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

function parseExplicitDate(value) {
  if (!value || typeof value !== 'string') return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseRelativeDate(text) {
  if (!text || typeof text !== 'string') return null;

  const msg = text.trim().toLowerCase();
  const now = new Date();

  if (msg === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  if (msg === 'yesterday') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - 1);
    return d;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }

  return null;
}

function isValidExpenseDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  return date <= today && date >= oneYearAgo;
}

function isRecurringScenario(message) {
  const msg = String(message || '').toLowerCase();
  return (
    msg.includes('every day') ||
    msg.includes('daily') ||
    msg.includes('each day')
  );
}

// ----------------------------
// Fallback intent detection
// ----------------------------

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
      return {
        intent: 'WHAT_IF',
        amount,
        expenses: []
      };
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
    msg.includes('reduce spending')
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
      return {
        intent: 'GET_CATEGORY_SPEND',
        category,
        expenses: []
      };
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
      expenses: [
        {
          amount,
          category,
          description: message.slice(0, 120),
          date: null
        }
      ]
    };
  }

  return { intent: 'UNKNOWN', expenses: [] };
}

// ----------------------------
// AI extraction only
// ----------------------------

async function extractIntent(message) {
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
      "category": string,
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
- UPI or bank SMS may contain merchant and amount. Extract them as ADD_EXPENSE
- If date is not explicitly present in the message, return date: null
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

// ----------------------------
// Data aggregation
// ----------------------------

async function loadExpenseStats(userId, budget) {
  const allExpenses = await Expense.find({ userId }).sort({ date: -1 });

  const totalSpent = allExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const remaining = Number(budget || 0) - totalSpent;
  const spentPercent = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

  const { start: monthStart, end: monthEndExclusive } = getMonthRange(new Date());

  const monthExpenses = allExpenses.filter((e) => {
    const d = new Date(e.date);
    return d >= monthStart && d < monthEndExclusive;
  });

  const thisMonthSpent = monthExpenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  const daysLeft = getDaysLeftInMonth(new Date());
  const dailyLimit = remaining > 0 ? Math.floor(remaining / daysLeft) : 0;

  const today = new Date();
  const elapsedDays = Math.max(today.getDate(), 1);
  const currentDailyBurnRate =
    elapsedDays > 0 ? Math.round(thisMonthSpent / elapsedDays) : 0;

  let projectedMonthTotal = null;
  if (currentDailyBurnRate > 0) {
    projectedMonthTotal = currentDailyBurnRate * getMonthEnd(today).getDate();
  }

  const categoryTotals = {};
  for (const expense of monthExpenses) {
    const category = normalizeCategory(expense.category);
    categoryTotals[category] =
      (categoryTotals[category] || 0) + Number(expense.amount || 0);
  }

  const sortedCategories = Object.entries(categoryTotals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const topCategory = sortedCategories[0] || null;

  return {
    allExpenses,
    totalSpent,
    remaining,
    spentPercent,
    monthExpenses,
    thisMonthSpent,
    daysLeft,
    dailyLimit,
    currentDailyBurnRate,
    projectedMonthTotal,
    sortedCategories,
    topCategory
  };
}

// ----------------------------
// Response builders
// ----------------------------

function buildAdviceReply({
  budget,
  totalSpent,
  remaining,
  daysLeft,
  dailyLimit,
  monthExpenses,
  topCategory
}) {
  if (monthExpenses.length < 3) {
    return `You've spent ${formatCurrency(totalSpent)} out of ${formatCurrency(budget)} (${budget > 0 ? Math.round((totalSpent / budget) * 100) : 0}%), with ${formatCurrency(remaining)} remaining. There isn't enough data yet for strong personalized tips. Keep tracking your expenses, and I'll identify spending patterns as more data builds up.`;
  }

  const parts = [];

  parts.push(
    `You've spent ${formatCurrency(totalSpent)} out of ${formatCurrency(budget)}, with ${formatCurrency(remaining)} remaining.`
  );

  if (daysLeft > 0) {
    parts.push(
      `You have ${daysLeft} day${daysLeft > 1 ? 's' : ''} left in the month, so keeping daily spending around ${formatCurrency(dailyLimit)} can help you stay within budget.`
    );
  }

  if (topCategory) {
    parts.push(
      `Your top spending category this month is ${topCategory.category} at ${formatCurrency(topCategory.amount)}.`
    );
  }

  if (budget > 0) {
    const usage = Math.round((totalSpent / budget) * 100);

    if (usage >= 90) {
      parts.push(
        `You've already used most of your budget, so cut non-essential spending for the rest of the month.`
      );
    } else if (usage >= 75) {
      parts.push(
        `Your budget usage is getting high, so be careful with discretionary expenses.`
      );
    } else {
      parts.push(
        `You're still within budget, so the main focus is staying consistent and avoiding sudden spikes.`
      );
    }
  }

  return parts.join(' ');
}

function formatRecentExpenses(expenses, limit = 5) {
  const recent = expenses.slice(0, Math.min(limit, 10));

  if (!recent.length) {
    return 'No expenses found yet.';
  }

  return recent
    .map((e, index) => {
      const category = normalizeCategory(e.category);
      const date = new Date(e.date).toLocaleDateString('en-IN');
      return `${index + 1}. ${category} — ${formatCurrency(e.amount)} on ${date}`;
    })
    .join('\n');
}

function buildWhatIfReply({ amount, stats, budget, recurring }) {
  if (!amount || amount <= 0) {
    return 'Please specify a valid amount.';
  }

  if (recurring) {
    const totalFutureSpend = amount * stats.daysLeft;
    const newRemaining = stats.remaining - totalFutureSpend;

    if (newRemaining < 0) {
      return `If you spend ${formatCurrency(amount)} every day for the next ${stats.daysLeft} day${stats.daysLeft > 1 ? 's' : ''}, you will spend ${formatCurrency(totalFutureSpend)} in total. This exceeds your remaining budget of ${formatCurrency(stats.remaining)} by ${formatCurrency(Math.abs(newRemaining))}.`;
    }

    if (newRemaining === 0) {
      return `If you spend ${formatCurrency(amount)} every day for the next ${stats.daysLeft} day${stats.daysLeft > 1 ? 's' : ''}, you will exactly use up your remaining budget of ${formatCurrency(stats.remaining)}.`;
    }

    return `If you spend ${formatCurrency(amount)} every day for the next ${stats.daysLeft} day${stats.daysLeft > 1 ? 's' : ''}, you will have ${formatCurrency(newRemaining)} left by the end of the month.`;
  }

  const newSpent = stats.totalSpent + amount;
  const newRemaining = budget - newSpent;

  if (newRemaining < 0) {
    return `If you spend ${formatCurrency(amount)}, your total spending will become ${formatCurrency(newSpent)}, which exceeds your budget by ${formatCurrency(Math.abs(newRemaining))}.`;
  }

  if (newRemaining === 0) {
    return `If you spend ${formatCurrency(amount)}, you will use your entire budget (${formatCurrency(budget)}), leaving ₹0 for the rest of the month. That would leave you ${stats.daysLeft} day${stats.daysLeft > 1 ? 's' : ''} with no budget remaining.`;
  }

  return `If you spend ${formatCurrency(amount)}, you will have ${formatCurrency(newRemaining)} left for the rest of the month. That would leave you ${stats.daysLeft} day${stats.daysLeft > 1 ? 's' : ''} to manage the remaining budget.`;
}

// ----------------------------
// Route
// ----------------------------

router.post('/aichat', authMiddleware, async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(503).json({
        reply: 'AI assistant is temporarily unavailable.'
      });
    }

    const { message, draftExpense } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        message: 'Message is required'
      });
    }

    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user || user.budget == null || user.budget <= 0) {
      return res.status(403).json({
        reply: 'Please set a valid monthly budget first.'
      });
    }

    // ----------------------------
    // Pending date flow
    // ----------------------------
    if (draftExpense && typeof draftExpense === 'object') {
      const resolvedDate =
        parseRelativeDate(message.trim()) ||
        parseExplicitDate(message.trim());

      if (!isValidExpenseDate(resolvedDate)) {
        return res.json({
          reply: 'Please provide a valid date like today, yesterday, or YYYY-MM-DD.',
          needsDate: true,
          draftExpense
        });
      }

      const savedExpense = await Expense.create({
        userId,
        amount: Number(draftExpense.amount),
        category: normalizeCategory(draftExpense.category),
        description: draftExpense.description || '',
        date: resolvedDate
      });

      const stats = await loadExpenseStats(userId, user.budget);

      return res.json({
        reply: `Added ${formatCurrency(savedExpense.amount)} to ${normalizeCategory(savedExpense.category)} on ${resolvedDate.toLocaleDateString('en-IN')}. Spent: ${formatCurrency(stats.totalSpent)}. Remaining: ${formatCurrency(stats.remaining)}.`,
        intent: 'ADD_EXPENSE',
        expenseAdded: true,
        expenses: [savedExpense],
        needsDate: false
      });
    }

    // ----------------------------
    // Intent extraction
    // ----------------------------
    const extracted = await extractIntent(message.trim());

    if (extracted.intent === 'HELP') {
      return res.json({
        reply:
          `I can help with:\n` +
          `• Add expense: "Spent 250 on Food"\n` +
          `• Paste UPI/SMS to log expense\n` +
          `• Budget status: "How much did I spend?"\n` +
          `• Remaining budget: "What is left?"\n` +
          `• Daily limit: "How much can I spend per day?"\n` +
          `• Spending tips: "Give me tips to reduce spending"\n` +
          `• Recent expenses: "Show last 5 expenses"\n` +
          `• Top category: "Which category is highest?"\n` +
          `• What-if: "What happens if I spend 980 today?"\n` +
          `• Recurring what-if: "What if I spend 200 every day?"`
      });
    }

    // ----------------------------
    // Add expense flow
    // ----------------------------
    if (extracted.intent === 'ADD_EXPENSE') {
      const validExpenses = extracted.expenses
        .map((item) => ({
          amount: parseInt(item.amount, 10),
          category: normalizeCategory(item.category),
          description:
            typeof item.description === 'string'
              ? item.description.trim().slice(0, 120)
              : '',
          date: item.date || null
        }))
        .filter((item) => item.amount > 0 && item.amount <= 10000000);

      if (!validExpenses.length) {
        return res.json({
          reply: 'I could not detect a valid expense. Try: "Spent 250 on Food".',
          intent: 'ADD_EXPENSE',
          expenseAdded: false,
          expenses: []
        });
      }

      if (validExpenses.length === 1 && !validExpenses[0].date) {
        return res.json({
          reply: 'What date should I record this expense for? Reply with today, yesterday, or YYYY-MM-DD.',
          intent: 'ADD_EXPENSE',
          expenseAdded: false,
          expenses: [],
          needsDate: true,
          draftExpense: validExpenses[0]
        });
      }

      const missingDate = validExpenses.find((e) => !e.date);
      if (missingDate) {
        return res.json({
          reply: 'One or more expenses are missing a date. Please add dates when logging multiple expenses.',
          intent: 'ADD_EXPENSE',
          expenseAdded: false,
          expenses: [],
          needsDate: false
        });
      }

      const docsToInsert = validExpenses
        .map((item) => {
          const parsedDate = parseExplicitDate(item.date);
          if (!isValidExpenseDate(parsedDate)) return null;

          return {
            userId,
            amount: item.amount,
            category: item.category,
            description: item.description,
            date: parsedDate
          };
        })
        .filter(Boolean);

      if (!docsToInsert.length) {
        return res.json({
          reply: 'I could not detect a valid expense date. Use today, yesterday, or YYYY-MM-DD.',
          intent: 'ADD_EXPENSE',
          expenseAdded: false,
          expenses: []
        });
      }

      const created = await Expense.insertMany(docsToInsert);
      const stats = await loadExpenseStats(userId, user.budget);

      if (created.length === 1) {
        return res.json({
          reply: `Added ${formatCurrency(created[0].amount)} to ${normalizeCategory(created[0].category)}. Spent: ${formatCurrency(stats.totalSpent)}. Remaining: ${formatCurrency(stats.remaining)}.`,
          intent: 'ADD_EXPENSE',
          expenseAdded: true,
          expenses: created,
          needsDate: false
        });
      }

      const totalAdded = created.reduce(
        (sum, expense) => sum + Number(expense.amount || 0),
        0
      );

      return res.json({
        reply: `Added ${created.length} expenses totaling ${formatCurrency(totalAdded)}. Spent: ${formatCurrency(stats.totalSpent)}. Remaining: ${formatCurrency(stats.remaining)}.`,
        intent: 'ADD_EXPENSE',
        expenseAdded: true,
        expenses: created,
        needsDate: false
      });
    }

    // ----------------------------
    // Stats for all non-add flows
    // ----------------------------
    const stats = await loadExpenseStats(userId, user.budget);

    if (extracted.intent === 'GET_STATUS') {
      return res.json({
        reply: `Budget: ${formatCurrency(user.budget)}. Spent: ${formatCurrency(stats.totalSpent)}. Remaining: ${formatCurrency(stats.remaining)}. Used: ${stats.spentPercent}%.`,
        intent: 'GET_STATUS',
        expenseAdded: false,
        expenses: []
      });
    }

    if (extracted.intent === 'GET_REMAINING') {
      return res.json({
        reply: `Remaining budget: ${formatCurrency(stats.remaining)}.`,
        intent: 'GET_REMAINING',
        expenseAdded: false,
        expenses: []
      });
    }

    if (extracted.intent === 'GET_BURNDOWN') {
      if (stats.thisMonthSpent <= 0) {
        return res.json({
          reply: 'There is not enough spending data this month to forecast your budget yet. Add a few expenses first.',
          intent: 'GET_BURNDOWN',
          expenseAdded: false,
          expenses: []
        });
      }

      let reply = `You have ${formatCurrency(stats.remaining)} left for ${stats.daysLeft} day${stats.daysLeft > 1 ? 's' : ''}, which is about ${formatCurrency(stats.dailyLimit)} per day.`;

      // Only show burn/projection if data is not tiny
      if (stats.monthExpenses.length >= 3 && stats.thisMonthSpent >= 100) {
        if (stats.currentDailyBurnRate > 0) {
          reply += ` Your current daily burn rate is ${formatCurrency(stats.currentDailyBurnRate)}.`;
        }

        if (stats.projectedMonthTotal != null) {
          reply += ` Projected month-end spend: ${formatCurrency(stats.projectedMonthTotal)}.`;
        }
      }

      return res.json({
        reply,
        intent: 'GET_BURNDOWN',
        expenseAdded: false,
        expenses: []
      });
    }

    if (extracted.intent === 'GET_ADVICE') {
      return res.json({
        reply: buildAdviceReply({
          budget: user.budget,
          totalSpent: stats.totalSpent,
          remaining: stats.remaining,
          daysLeft: stats.daysLeft,
          dailyLimit: stats.dailyLimit,
          monthExpenses: stats.monthExpenses,
          topCategory: stats.topCategory
        }),
        intent: 'GET_ADVICE',
        expenseAdded: false,
        expenses: []
      });
    }

    if (extracted.intent === 'GET_RECENT_EXPENSES') {
      return res.json({
        reply: formatRecentExpenses(stats.allExpenses, extracted.limit || 5),
        intent: 'GET_RECENT_EXPENSES',
        expenseAdded: false,
        expenses: []
      });
    }

    if (extracted.intent === 'GET_TOP_CATEGORY') {
      if (!stats.topCategory) {
        return res.json({
          reply: 'No expenses found this month yet.',
          intent: 'GET_TOP_CATEGORY',
          expenseAdded: false,
          expenses: []
        });
      }

      return res.json({
        reply: `Your top spending category this month is ${stats.topCategory.category} at ${formatCurrency(stats.topCategory.amount)}.`,
        intent: 'GET_TOP_CATEGORY',
        expenseAdded: false,
        expenses: []
      });
    }

    if (extracted.intent === 'GET_CATEGORY_SPEND') {
      const requestedCategory = normalizeCategory(extracted.category || 'Others');
      const found = stats.sortedCategories.find(
        (item) => item.category === requestedCategory
      );

      return res.json({
        reply: `${requestedCategory} spending this month: ${formatCurrency(found ? found.amount : 0)}.`,
        intent: 'GET_CATEGORY_SPEND',
        expenseAdded: false,
        expenses: []
      });
    }

    if (extracted.intent === 'WHAT_IF') {
      const amount = extracted.amount || extractAmountFromText(message);
      const recurring = isRecurringScenario(message);

      if (!amount) {
        return res.json({
          reply: 'Please specify an amount. Example: "What happens if I spend ₹500 today?"',
          intent: 'WHAT_IF',
          expenseAdded: false,
          expenses: []
        });
      }

      return res.json({
        reply: buildWhatIfReply({
          amount,
          stats,
          budget: user.budget,
          recurring
        }),
        intent: 'WHAT_IF',
        expenseAdded: false,
        expenses: []
      });
    }

    return res.json({
      reply: 'I can help with expense logging, UPI/SMS parsing, budget status, daily limit, spending tips, recent expenses, and what-if calculations based on your actual data.',
      intent: 'UNKNOWN',
      expenseAdded: false,
      expenses: []
    });
  } catch (err) {
    console.error('AI chat error:', err);
    return res.status(500).json({
      reply: 'Something went wrong. Please try again.'
    });
  }
});

module.exports = router;