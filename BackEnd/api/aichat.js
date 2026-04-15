const router = require('express').Router();
const authMiddleware = require('../middleware/authmiddleware');
const expense = require('../schemas/expenseSchema');
const Groq = require('groq-sdk');

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY && process.env.NODE_ENV !== 'test') {
  console.warn('⚠️  GROQ_API_KEY not set in environment variables. AI chat will not work.');
}

let groq;
if (GROQ_API_KEY) {
  groq = new Groq({ apiKey: GROQ_API_KEY });
}

router.post('/aichat', authMiddleware, async (req, res) => {
  try {
    console.log('AI Chat Request:', { 
      userId: req.user?.userId, 
      message: req.body.message?.substring(0, 50),
      hasGroqKey: !!GROQ_API_KEY
    });

    if (!GROQ_API_KEY) {
      return res.status(503).json({ 
        message: 'AI service not configured',
        reply: 'AI assistant is temporarily unavailable. Please try again later.'
      });
    }

    const { message } = req.body;
    const userId = req.user.userId;
    
    // Check if user has set a budget
    const User = require('../schemas/userSchema');
    const user = await User.findById(userId);
    if(!user || user.budget === 0 || user.budget === undefined) {
      return res.status(403).json({ 
        message: '⚠️  Budget not set! Please set your monthly budget before adding expenses via chat.',
        reply: 'I noticed you haven\'t set a budget yet. Please set your monthly budget first, then I can help track your expenses!' 
      });
    }
    
    const userExpenses = await expense.find({ userId });

    const expenseContext = userExpenses.length > 0 
      ? `User has ${userExpenses.length} expenses. Total: ₹${userExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}. Categories: ${[...new Set(userExpenses.map(e => e.category))].join(', ')}.`
      : 'No expenses recorded yet.';

    // System prompt - English only, accepting Indian Rupees
    const systemPrompt = `You are ExpBot, a personal finance AI assistant for Indian users. Help track spending in Indian Rupees (₹), analyze patterns, and provide smart financial advice.

IMPORTANT: All amounts are in Indian Rupees (₹). Always show amounts with ₹ symbol.

CURRENT USER CONTEXT:
${expenseContext}

YOUR CAPABILITIES:
1. Answer questions about spending patterns and financial advice
2. Provide budget recommendations in rupees
3. Suggest ways to save money based on their expense data
4. When user mentions an expense (e.g., "spent 500 on food", "500 kharch kiya"), acknowledge it
5. Accept all amounts as Indian Rupees

RESPONSE GUIDELINES:
- Respond ONLY in English, clear and simple
- Use bullet points (•) for lists
- Always display amounts with ₹ symbol (e.g., ₹500, ₹1,000)
- If they mention an expense, say "Got it! I've noted that ₹X on [category]."
- Keep responses under 100 words
- Provide practical, actionable advice`;

    const extractionPrompt = `You MUST respond with ONLY valid JSON. Nothing else. No markdown, no extra text.

TASK: Extract expense if user mentioned spending money. All amounts in Indian Rupees (₹).

RESPOND WITH ONE OF THESE EXACT FORMATS:
1. If NO expense: {"hasExpense": false}
2. If expense found: {"hasExpense": true, "amount": 500, "category": "Food", "description": "lunch", "date": "2026-04-12"}

CATEGORIES ONLY: Food, Shopping, Vacation, Health, Insurance, Transportation, Entertainment, Bills, Education, Investment, Others

KEYWORD MAPPING:
- food, eating, lunch, dinner, breakfast, khana, khareedari → Food
- shopping, clothes, dress, buying, apparel → Shopping
- vacation, travel, trip, flight, hotel → Vacation
- health, medicine, doctor, pharmacy → Health
- insurance, policy → Insurance
- petrol, gas, fuel, car, bike, auto, taxi → Transportation
- movie, cinema, game, entertainment → Entertainment
- bill, electricity, water, rent, phone → Bills
- education, school, course, tuition → Education
- investment, stock, crypto → Investment

DETECT PATTERNS:
- "spent 8000" + context word → extract amount and map category
- "8000 on vacation" → amount: 8000, category: Vacation
- "500 for food" → amount: 500, category: Food
- "8000 kharch kiya vacation" → amount: 8000, category: Vacation

User said: "${message}"

Extract and return ONLY JSON, no other text:`;

    // Step 1: Try to detect and extract expense from user message
    let expenseAdded = false;
    let expenseData = null;

    try {
      const extractionResult = await groq.chat.completions.create({
        messages: [{ role: 'user', content: extractionPrompt }],
        model: 'openai/gpt-oss-120b',
        max_tokens: 80,
        temperature: 0
      });

      const extractedText = extractionResult.choices[0].message.content.trim();
      console.log('🔍 Extraction output:', extractedText);
      
      // Try to find JSON
      const jsonMatch = extractedText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ Parsed JSON:', parsed);
          
          if (parsed.hasExpense === true && parsed.amount && parsed.category) {
            // Validate amount is a number
            const amount = parseInt(parsed.amount);
            if (!isNaN(amount) && amount > 0) {
              // Double-check budget before saving (defense in depth)
              const freshUser = await User.findById(userId);
              if(!freshUser || freshUser.budget === 0 || freshUser.budget === undefined) {
                console.log('❌ Budget validation failed on save attempt');
                expenseAdded = false;
              } else {
                // Add expense to database
                const newExpense = await expense.create({
                  userId,
                  amount: amount,
                  category: parsed.category.trim(),
                  description: parsed.description?.trim() || '',
                  date: parsed.date || new Date().toISOString()
                });
                expenseAdded = true;
                expenseData = newExpense;
                console.log('💾 EXPENSE SAVED TO DB:', newExpense);
              }
            } else {
              console.log('⚠️  Invalid amount:', parsed.amount);
            }
          } else {
            console.log('ℹ️  No expense detected. HasExpense:', parsed.hasExpense);
          }
        } catch (jsonErr) {
          console.log('❌ JSON parse error:', jsonErr.message);
          // FALLBACK: Try keyword extraction
          expenseAdded = await tryKeywordExtraction(message, userId);
        }
      } else {
        console.log('⚠️  No JSON found in response. Trying keyword extraction...');
        // FALLBACK: Try keyword extraction
        expenseAdded = await tryKeywordExtraction(message, userId);
      }
    } catch (parseErr) {
      console.error('💥 Extraction error:', parseErr.message);
      // FALLBACK: Try keyword extraction
      expenseAdded = await tryKeywordExtraction(message, userId);
    }

    // Fallback function to extract from keywords
    async function tryKeywordExtraction(userMsg, uid) {
      try {
        console.log('🔄 Using fallback keyword extraction...');
        
        // Extract amount - look for numbers
        const amountMatch = userMsg.match(/(\d+)/);
        if (!amountMatch) {
          console.log('❌ No amount found');
          return false;
        }
        
        const amount = parseInt(amountMatch[1]);
        
        // Extract category from keywords
        let category = 'Others';
        const text = userMsg.toLowerCase();
        
        const categoryKeywords = {
          'Food': ['food', 'khana', 'eat', 'lunch', 'dinner', 'breakfast'],
          'Shopping': ['shopping', 'buy', 'clothes', 'dress', 'khareedari'],
          'Vacation': ['vacation', 'travel', 'trip', 'flight', 'hotel'],
          'Transportation': ['petrol', 'gas', 'car', 'bike', 'taxi', 'auto'],
          'Entertainment': ['movie', 'cinema', 'game', 'entertainment'],
          'Health': ['health', 'medicine', 'doctor', 'pharmacy'],
          'Bills': ['bill', 'electricity', 'water', 'rent', 'phone'],
          'Education': ['education', 'school', 'course', 'tuition'],
          'Entertainment': ['entertainment', 'movie', 'game']
        };
        
        for (const [cat, keywords] of Object.entries(categoryKeywords)) {
          if (keywords.some(kw => text.includes(kw))) {
            category = cat;
            break;
          }
        }
        
        console.log(`🎯 Extracted - Amount: ₹${amount}, Category: ${category}`);
        
        // Double-check budget before saving (defense in depth)
        const User = require('../schemas/userSchema');
        const freshUser = await User.findById(uid);
        if(!freshUser || freshUser.budget === 0 || freshUser.budget === undefined) {
          console.log('❌ Budget validation failed on fallback save attempt');
          return false;
        }
        
        const newExpense = await expense.create({
          userId: uid,
          amount: amount,
          category: category,
          description: userMsg.substring(0, 100),
          date: new Date().toISOString()
        });
        
        console.log('💾 EXPENSE SAVED (FALLBACK):', newExpense);
        expenseData = newExpense;
        return true;
      } catch (err) {
        console.error('❌ Fallback extraction failed:', err.message);
        return false;
      }
    }

    // Step 2: Generate AI response
    const responsePrompt = `${systemPrompt}\n\nUser: ${message}\n\nProvide helpful financial advice and acknowledgment.`;

    const result = await groq.chat.completions.create({
      messages: [{ role: 'user', content: responsePrompt }],
      model: 'openai/gpt-oss-120b',
      max_tokens: 200,
      temperature: 0.7
    });

    const reply = result.choices[0].message.content;

    // Return response with expense confirmation if added
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
      reply: 'Sorry, I encountered an issue. Please try again.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

router.get('/aichat-test', authMiddleware, async (req, res) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(503).json({ 
        error: 'Groq API not initialized',
        key_exists: false
      });
    }

    const result = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Say "API is working" in one sentence.' }],
      model: 'openai/gpt-oss-120b',
      max_tokens: 50
    });

    res.json({ 
      status: 'OK', 
      reply: result.choices[0].message.content
    });
  } catch (err) {
    console.error('Test Error:', err.message);
    res.status(500).json({ 
      error: err.message,
      key_exists: !!GROQ_API_KEY
    });
  }
});

module.exports = router;