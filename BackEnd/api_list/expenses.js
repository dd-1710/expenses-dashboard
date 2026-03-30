const express = require('express');
const router = express.Router();
const expense = require('../schemas/expenseSchema')
const authMiddleware = require('../middleware/authmiddleware')

router.post('/add-expense',authMiddleware,async(req,res)=>{
    try{
        const {amount,category,description,date} = req.body;
        const userId = req.user.userId;
        if(!category || !amount || !date){
            return res.status(400).json({message:"Category and Amt and Date are required"})
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
        const userId = req.user.userId
        const foundExpense = await expense.find({ userId })
        return res.status(200).json(foundExpense)
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