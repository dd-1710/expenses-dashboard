const express = require('express');
const router = express.Router();
const expense = require('../schemas/expenseSchema')
const authMiddleware = require('../middleware/authmiddleware')

router.post('/add-expense',authMiddleware,async(req,res)=>{
    try{
        const {amount,category,description,date} = req.body;
        const userId = req.user.userId;
        await expense.create({userId,amount,category,description,date});
        return res.status(201).json({message:"Expenses Added!!"})
    }
    catch(err){
       return res.status(500).json({message:"Unable to Add",error:err.message})
    }
})
module.exports = router;