const router = require('express').Router();
const authMiddleware = require('../middleware/authmiddleware');
const expense = require('../schemas/expenseSchema');
const User = require('../schemas/userSchema');
const Groq = require('groq-sdk');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY && process.env.NODE_ENV !== 'test') {
  console.warn('GROQ_API_KEY not set. AI chat will not work.');
}

let groq;
if (GROQ_API_KEY) {
  groq = new Groq({ apiKey: GROQ_API_KEY });
}

// Model config — easy to swap
const CHAT_MODEL = 'llama-3.3-70b-versatile';
const EXTRACTION_MODEL = 'llama-3.3-70b-versatile';

const VALID_CATEGORIES = [
  'Food', 'Shopping', 'Vacation', 'Health', 'Insurance',
  'Transportation', 'Entertainment', 'Bills', 'Education', 'Investment', 'Others'
];

const CATEGORY_KEYWORDS = {
  'Food': ['food', 'khana', 'eat', 'lunch', 'dinner', 'breakfast', 'snack', 'biryani', 'pizza', 'burger', 'chai', 'coffee'],
  'Shopping': ['shopping', 'buy', 'bought', 'clothes', 'dress', 'khareedari', 'amazon', 'flipkart', 'shoes'],
  'Vacation': ['vacation', 'travel', 'trip', 'flight', 'hotel', 'holiday', 'outing'],
  'Transportation': ['petrol', 'gas', 'fuel', 'car', 'bike', 'taxi', 'auto', 'uber', 'ola', 'metro', 'bus', 'train'],
  'Entertainment': ['movie', 'cinema', 'game', 'entertainment', 'netflix', 'concert', 'party'],
  'Health': ['health', 'medicine', 'doctor', 'pharmacy', 'hospital', 'gym', 'medical'],
  'Insurance': ['insurance', 'policy', 'premium', 'lic'],
  'Bills': ['bill', 'electricity', 'water', 'rent', 'phone', 'recharge', 'wifi', 'broadband', 'emi'],
  'Education': ['education', 'school', 'course', 'tuition', 'book', 'udemy', 'college', 'fee'],
  'Investment': ['investment', 'stock', 'crypto', 'mutual fund', 'sip', 'fd', 'gold']
};

// Keyword-based fallback extraction (no API call needed)
function extractExpenseFromKeywords(userMsg) {
  const amountMatch = userMsg.match(/(\d[\d,]*)/);
  if (!amountMatch) return null;

  const amount = parseInt(amountMatch[1].replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0 || amount > 10000000) return null;

  let category = 'Others';
  const text = userMsg.toLowerCase();

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      category = cat;
      break;
    }
  }

  return { amount, category, description: userMsg.substring(0, 100) };
}

router.post('/aichat', authMiddleware, async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(503).json({
        message: 'AI service not configured',
        reply: 'AI assistant is temporarily unavailable. Please try again later.'
      });
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const userId = req.user.userId;

    const user = await User.findById(userId);
    if (!user || !user.budget || user.budget <= 0) {
      return res.status(403).json({
        message: 'Budget not set! Please set your monthly budget before using chat.',
        reply: 'Please set your monthly budget first, then I can help track your expenses!'
      });
    }

    const userExpenses = await expense.find({ userId }).sort({ date: -1 }).limit(50);

    const totalSpent = userExpenses.reduce((sum, e) => sum + e.amount, 0);
    const remaining = user.budget - totalSpent;
    const categories = [...new Set(userExpenses.map(e => e.category))].join(', ');

    const expenseContext = userExpenses.length > 0
      ? `Budget: ₹${user.budget}. Spent: ₹${totalSpent}. Remaining: ₹${remaining}. ${userExpenses.length} expenses across: ${categories}.`
      : `Budget: ₹${user.budget}. No expenses recorded yet.`;

    // Step 1: Extract expense using JSON mode (single API call with guaranteed JSON)
    let expenseAdded = false;
    let expenseData = null;

    try {
      const extractionResult = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `Extract expense info from user messages. Return JSON only.
If the user mentions spending money, return: {"hasExpense": true, "amount": <number>, "category": "<one of: ${VALID_CATEGORIES.join(', ')}>", "description": "<short description>"}
If no expense mentioned, return: {"hasExpense": false}
Today's date is ${new Date().toISOString().split('T')[0]}.`
          },
          { role: 'user', content: message }
        ],
        model: EXTRACTION_MODEL,
        max_tokens: 100,
        temperature: 0,
        response_format: { type: 'json_object' }
      });

      const parsed = JSON.parse(extractionResult.choices[0].message.content);

      if (parsed.hasExpense === true && parsed.amount && parsed.category) {
        const amount = parseInt(parsed.amount);
        if (!isNaN(amount) && amount > 0 && amount <= 10000000 && VALID_CATEGORIES.includes(parsed.category)) {
          const newExpense = await expense.create({
            userId,
            amount,
            category: parsed.category,
            description: parsed.description?.substring(0, 200) || '',
            date: parsed.date || new Date().toISOString()
          });
          expenseAdded = true;
          expenseData = newExpense;
        }
      }
    } catch (extractErr) {
      // Fallback to keyword extraction if AI extraction fails
      const extracted = extractExpenseFromKeywords(message);
      if (extracted) {
        try {
          const newExpense = await expense.create({
            userId,
            amount: extracted.amount,
            category: extracted.category,
            description: extracted.description,
            date: new Date().toISOString()
          });
          expenseAdded = true;
          expenseData = newExpense;
        } catch (dbErr) {
          // Expense save failed, continue to chat response
        }
      }
    }

    // Step 2: Generate chat response using system role properly
    const result = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are ExpBot, a concise personal finance assistant for Indian users.

USER CONTEXT: ${expenseContext}
${expenseAdded ? `JUST ADDED: ₹${expenseData.amount} on ${expenseData.category}. Acknowledge this.` : ''}

RULES:
• All amounts in Indian Rupees (₹)
• Use bullet points (•) for lists
• Keep responses under 80 words
• Be practical and actionable
• If user mentioned an expense that was saved, confirm: "Got it! Noted ₹X on [category]."
• Don't repeat the user's message back to them`
        },
        { role: 'user', content: message }
      ],
      model: CHAT_MODEL,
      max_tokens: 250,
      temperature: 0.6
    });

    const reply = result.choices[0].message.content;

    const response = {
      reply,
      ...(expenseAdded && {
        expenseAdded: true,
        expense: {
          _id: expenseData._id,
          amount: expenseData.amount,
          category: expenseData.category,
          description: expenseData.description,
          date: expenseData.date
        }
      })
    };

    res.json(response);

  } catch (err) {
    console.error('AI Chat Error:', err.message);
    res.status(500).json({
      message: 'AI Request Failed',
      reply: 'Sorry, I encountered an issue. Please try again.'
    });
  }
});

module.exports = router;