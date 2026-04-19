const express = require('express');
const bcrypt = require('bcrypt');
const jwtToken = require('jsonwebtoken');
const router = express.Router();


const user = require('../schemas/userSchema');
const authMiddleware = require('../middleware/authmiddleware');

router.post('/signUp',async(req,res)=>{
    try{
        const {userName,password} = req.body;
        if(!userName || !password || userName.length < 3 || password.length < 4){
            return res.status(400).json({message:"Username (min 3) and Password (min 4) are required"});
        }
        const existingUser = await user.findOne({userName})
        if(existingUser){
            return res.status(400).json({message:"User Already Exists"});
        }
        const hashedPassword = await bcrypt.hash(password,10);
        await user.create({userName,password: hashedPassword}) ;
        res.status(201).json({message:"User Created Successfully!"});
    }
    catch(err){
        console.error('SignUp error:', err);
        res.status(500).json({message:'Server Error'});
    }
});

router.post('/signIn',async(req,res)=>{
    try{
        const {userName,password} = req.body;
        if(!userName || !password){
            return res.status(400).json({message:"Username and Password are required"});
        }
        const checkUser = await user.findOne({userName});
        if(!checkUser){
           return res.status(401).json({message:"User Doesn't Exist, Please SignUp"});
        }
        const isMatch = await bcrypt.compare(password,checkUser.password);
        if(!isMatch){
            return res.status(401).json({message:'Invalid Credentials'});
        }
        const token = jwtToken.sign({userId:checkUser._id,userName},process.env.jwt_secret_key,{expiresIn:'1d'})
        res.status(200).json({message:"Logged In Successfully!",token});
    }
    catch(err){
        console.error('SignIn error:', err);
        res.status(500).json({message:"Server Error"});
    }
})

router.get('/get-user-budget',authMiddleware,async(req,res)=>{
    try{
        const currentUser = await user.findById(req.user.userId);
        if(!currentUser){
          return res.status(404).json({message:"User not found"});
        }
        return res.status(200).json({budget:currentUser.budget});

    }
    catch(err){
      console.error('Get budget error:', err);
      return res.status(500).json({message:"Unable to fetch budget"});
    }
})

router.put('/update-user-budget',authMiddleware,async(req,res)=>{
    try{
        const {budget} = req.body;
        if(typeof budget !== 'number' || budget < 500 || budget > 1000000){
          return res.status(400).json({message:"Budget must be between ₹500 and ₹10,00,000"});
        }
        const id = req.user.userId;
        const updateBudget = await user.findByIdAndUpdate(id,{budget},{new:true});
        if(!updateBudget){
          return res.status(404).json({message:"User not found"});
        }
        return res.status(200).json({budget:updateBudget.budget});

    }
    catch(err){
      console.error('Update budget error:', err);
      return res.status(500).json({message:"Unable to update the budget"})
    }
})

module.exports = router;