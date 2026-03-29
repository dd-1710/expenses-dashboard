const router = require('express').Router();
const authMiddleware = require('../middleware/authmiddleware');
const expense = require('../schemas/expenseSchema')

const HF_API_URL = 'https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.3/v1/chat/completions';

router.post('/aichat', authMiddleware, async (req, res) => {
    try {
        const { message } = req.body;
        const userExpense = await expense.find({ userId: req.user.userId })

        const prompt = `You are a smart finance assistance your name is expbot , Here is the user expense response ${JSON.stringify(userExpense)}.
        User question: ${message} , provide a helpful answer.`

        const response = await fetch(HF_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.HF_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 512,
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Hugging Face API error');
        }
        const reply = data.choices[0].message.content;
        res.json({reply})
    } catch (err) {
      res.status(500).json({message:'AI Request Failed',error:err.message})
    }
})

module.exports = router;