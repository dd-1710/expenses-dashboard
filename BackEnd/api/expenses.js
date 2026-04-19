const express = require('express');
const router = express.Router();
const expense = require('../schemas/expenseSchema')
const User = require('../schemas/userSchema')
const authMiddleware = require('../middleware/authmiddleware')

router.post('/add-expense',authMiddleware,async(req,res)=>{
    try{
        const {amount,category,description,date} = req.body;
        const userId = req.user.userId;
        if(!category || !amount || !date){
            return res.status(400).json({message:"Category and Amt and Date are required"})
        }

        // Validate date range — not future, not before Jan 2026
        const expDate = new Date(date);
        const now = new Date();
        const minDate = new Date(2026, 0, 1);
        if(isNaN(expDate.getTime()) || expDate > now || expDate < minDate){
            return res.status(400).json({message:"Date must be between January 2026 and today"})
        }
        
        // Check if user has set a budget
        const user = await User.findById(userId);
        if(!user || !user.budget || user.budget <= 0) {
            return res.status(403).json({message:"Budget not set! Please set your monthly budget before adding expenses."})
        }
        
        await expense.create({userId,amount,category,description,date});
        return res.status(201).json({message:"Expenses Added!!"})
    }
    catch(err){
       return res.status(500).json({message:"Unable to Add",error:err.message})
    }
})

router.get('/get-all-expenses', authMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page-1)*limit;
        const userId = req.user.userId
        const foundExpense = await expense.find({ userId }).skip(skip).limit(limit);
        const totalCount = await expense.countDocuments({userId})
        const totalSpent = await expense.aggregate([
            { $match: { userId: new (require('mongoose').Types.ObjectId)(userId) } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ])
        const categoryData = await expense.aggregate([
            { $match: { userId: new (require('mongoose').Types.ObjectId)(userId) } },
            { $group: { _id: "$category", total: { $sum: "$amount" } } }
        ])
        const dailyData = await expense.aggregate([
            { $match: { userId: new (require('mongoose').Types.ObjectId)(userId) } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, total: { $sum: "$amount" } } },
            { $sort: { _id: 1 } }
        ])
        const monthlyData = await expense.aggregate([
            { $match: { userId: new (require('mongoose').Types.ObjectId)(userId) } },
            { $group: { _id: { year: { $year: "$date" }, month: { $month: "$date" } }, total: { $sum: "$amount" } } },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ])
        return res.status(200).json({
            expenseData: foundExpense,
            totalCount,
            totalSpent: totalSpent[0]?.total || 0,
            categoryData,
            dailyData,
            monthlyData
        });
    }
    catch (err) {
        return res.status(500).json({ message: 'Unable to fetch the expenses', error: err.message })
    }

})

router.delete('/delete-expense/:id',authMiddleware,async(req,res)=>{
  try{
    const id = req.params.id;
    const fetchUserId = await expense.findById(id);
    if(!fetchUserId){
     return res.status(404).json({message:"No expense available to delete"});
    }
    if(fetchUserId.userId.toString() !== req.user.userId){
      return res.status(403).json({message:"You don't have access to delete this expense"})
    }
    await expense.findByIdAndDelete(id);
    return res.status(200).json({message:"Expense Delete Successfully"});

  }
  catch(err){
    return res.status(500).json({message:'Unable to delete the expense',error:err.message})
  }
})

router.put('/update-expense/:id',authMiddleware,async(req,res)=>{
    try{
        const {amount,category,description,date} = req.body;
        const id = req.params.id;
        const fetchUserId = await expense.findById(id);
        if(!fetchUserId){
            return res.status(404).json({message:'No expense available to update.'})
        }
        if(fetchUserId.userId.toString() !== req.user.userId){
            return res.status(403).json({message:"You don't have access to update this expense."})
        }
        const updateExpense = await expense.findByIdAndUpdate(id,{amount,category,description,date})
        return res.status(200).json({updateExpense,message:'Updated Successfully'});
    }
    catch(err){
       return res.status(500).json({message:'Unable to update expense',error:err.message})
       
    }
})
module.exports = router;