const router = require('express').Router();
const authMiddleware = require('../middleware/authmiddleware');
const expense = require('../schemas/expenseSchema')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
router.post('/aichat', authMiddleware, async (req, res) => {
    try {
        const { message } = req.body;
        const userExpense = await expense.find({ userId: req.user.userId })

        const prompt = `You are a smart finance assistance your name is expbot , Here is the user expense response ${JSON.stringify(userExpense)}.
        User question: ${message} , provide a helpful answer.`
        const model = genAI.getGenerativeModel({model:'gemini-2.0-flash'})
        const result = await model.generateContent(prompt)
        const reply = result.response.text();
        res.json({reply})
    } catch (err) {
      res.status(500).json({message:'AI Request Failed',error:err.message})
    }
})

module.exports = router;