const router = require('express').Router();
const authMiddleware = require('../middleware/authmiddleware');
const expense = require('../schemas/expenseSchema');

// Ollama runs locally at http://localhost:11434
const OLLAMA_API_URL = 'http://localhost:11434/api/generate';

router.post('/aichat', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    const userExpense = await expense.find({ userId: req.user.userId });

    const prompt = `You are a smart finance assistant named ExpBot. 
    Here is the user's expense data: ${JSON.stringify(userExpense)}.
    User question: ${message}. Provide a helpful answer.`;

    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gemma:2b",
        prompt: prompt,
        stream: false
      })
    });

    const data = await response.json();

    // Ollama returns streaming chunks by default, but if you use fetch like this,
    // you’ll get the final JSON object with "response" field.
    const reply = data.response || "No reply generated.";
    res.json({ reply });

  } catch (err) {
    res.status(500).json({ message: 'AI Request Failed', error: err.message });
  }
});

module.exports = router;
