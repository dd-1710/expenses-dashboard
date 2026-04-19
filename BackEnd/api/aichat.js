const router = require('express').Router();
const authMiddleware = require('../middleware/authmiddleware');
const Expense = require('../schemas/expenseSchema');
const User = require('../schemas/userSchema');
const Groq = require('groq-sdk');

const { VALID_CATEGORIES } = require('./chat/constants');
const {
  formatCurrency,
  normalizeCategory,
  resolveCategory,
  extractAmountFromText,
  parseExplicitDate,
  parseRelativeDate,
  isValidExpenseDate,
  isRecurringScenario
} = require('./chat/helpers');
const { extractIntent } = require('./chat/intentParser');
const { loadExpenseStats } = require('./chat/expenseStats');
const { buildAdviceReply, formatRecentExpenses, buildWhatIfReply } = require('./chat/responseBuilders');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

let groq;
if (GROQ_API_KEY) {
  groq = new Groq({ apiKey: GROQ_API_KEY });
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
    // Pending draft flow (category / date)
    // ----------------------------
    if (draftExpense && typeof draftExpense === 'object') {

      // Step 1: Resolve category if still missing
      if (!draftExpense.category) {
        const resolvedCategory = resolveCategory(message.trim());
        if (!resolvedCategory) {
          return res.json({
            reply: `I didn't recognise that category. Please pick one: ${VALID_CATEGORIES.join(', ')}.`,
            needsCategory: true,
            draftExpense
          });
        }
        draftExpense.category = resolvedCategory;

        // Category resolved — now check if date is also missing
        if (!draftExpense.date) {
          return res.json({
            reply: 'What date should I record this expense for? Reply with today, yesterday, or YYYY-MM-DD.',
            needsDate: true,
            draftExpense
          });
        }
      }

      // Step 2: Resolve date
      const resolvedDate =
        parseRelativeDate(message.trim()) ||
        parseExplicitDate(message.trim());

      if (!isValidExpenseDate(resolvedDate)) {
        return res.json({
          reply: resolvedDate && resolvedDate < new Date(2026, 0, 1)
            ? 'That date is too old. I can only log expenses from January 2026 onwards. Please provide a date between Jan 1, 2026 and today.'
            : resolvedDate && resolvedDate > new Date()
              ? 'That date is in the future. Please provide a date up to today.'
              : 'Please provide a valid date like today, yesterday, or YYYY-MM-DD (from Jan 2026 onwards).',
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
    const extracted = await extractIntent(message.trim(), groq);

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
        .map((item) => {
          const rawCat = item.category && typeof item.category === 'string' ? item.category.trim() : null;
          const normalized = rawCat ? normalizeCategory(rawCat) : null;
          const category = normalized === 'Others' ? null : normalized;
          return {
            amount: parseInt(item.amount, 10),
            category,
            description:
              typeof item.description === 'string'
                ? item.description.trim().slice(0, 120)
                : '',
            date: item.date || null
          };
        })
        .filter((item) => item.amount > 0 && item.amount <= 10000000);

      if (!validExpenses.length) {
        return res.json({
          reply: 'I could not detect a valid expense. Try: "Spent 250 on Food".',
          intent: 'ADD_EXPENSE',
          expenseAdded: false,
          expenses: []
        });
      }

      if (validExpenses.length === 1) {
        const draft = validExpenses[0];
        const missingCategory = !draft.category;
        const missingDateField = !draft.date;

        if (missingCategory && missingDateField) {
          return res.json({
            reply: `What category does this belong to? Pick one: ${VALID_CATEGORIES.join(', ')}.`,
            intent: 'ADD_EXPENSE',
            expenseAdded: false,
            expenses: [],
            needsCategory: true,
            draftExpense: { amount: draft.amount, category: null, description: draft.description }
          });
        }

        if (missingCategory) {
          return res.json({
            reply: `What category does this belong to? Pick one: ${VALID_CATEGORIES.join(', ')}.`,
            intent: 'ADD_EXPENSE',
            expenseAdded: false,
            expenses: [],
            needsCategory: true,
            draftExpense: { amount: draft.amount, category: null, description: draft.description, date: draft.date }
          });
        }

        if (missingDateField) {
          return res.json({
            reply: 'What date should I record this expense for? Reply with today, yesterday, or YYYY-MM-DD.',
            intent: 'ADD_EXPENSE',
            expenseAdded: false,
            expenses: [],
            needsDate: true,
            draftExpense: draft
          });
        }
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
            category: normalizeCategory(item.category),
            description: item.description,
            date: parsedDate
          };
        })
        .filter(Boolean);

      if (!docsToInsert.length) {
        return res.json({
          reply: 'The date provided is not valid. Only dates from January 2026 to today are accepted. Try again with a valid date.',
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
