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

// -------- Improved intent detection ----------
function detectIntent(message) {
  const msg = message.toLowerCase();

  if (msg.includes('help') || msg.includes('what can you do')) {
    return 'HELP';
  }

  if (/\d/.test(msg) && (msg.includes('spent') || msg.includes('paid') || msg.includes('bought'))) {
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
        reply: `I can track expenses from messages.

Examples:
• "Spent ₹500 on food"
• "Paid ₹1200 rent"
• "Bought shoes for ₹2000"

You can even add multiple:
"Spent ₹500 food and ₹1000 shopping"`
      });
    }

    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user || !user.budget) {
      return res.status(403).json({
        reply: 'Please set your monthly budget first.'
      });
    }

    const userExpenses = await Expense.find({ userId }).sort({ date: -1 }).limit(50);

    const totalSpent = userExpenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = user.budget - totalSpent;

    const expenseContext = `Budget: ₹${user.budget}, Spent: ₹${totalSpent}, Remaining: ₹${remaining}`;

    let addedExpenses = [];

    // -------- MULTI EXPENSE EXTRACTION ----------
    if (intent === 'EXPENSE') {
      try {
        const extraction = await groq.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `Extract ALL expenses.

Return ONLY JSON:
{
  "expenses": [
    { "amount": number, "category": string, "description": string }
  ]
}

Rules:
- Ignore invalid or zero amounts
- Categories must be from: ${VALID_CATEGORIES.join(', ')}
- If none → { "expenses": [] }`
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

            const newExpense = await Expense.create({
              userId,
              amount,
              category: VALID_CATEGORIES.includes(item.category)
                ? item.category
                : 'Others',
              description: item.description || '',
              date: new Date()
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

    // -------- CHAT RESPONSE ----------
    const chat = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a concise expense assistant.

${expenseContext}

Rules:
• Max 50 words
• Use ₹
• Be direct
${addedExpenses.length > 0 ? `Confirm total expenses added.` : ''}`
        },
        { role: 'user', content: message }
      ],
      model: CHAT_MODEL,
      temperature: 0.5
    });

    return res.json({
      reply: chat.choices[0].message.content,
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