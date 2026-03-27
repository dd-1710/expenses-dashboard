const express = require('express');
const bcrypt = require('bcrypt');
const jwtToken = require('jsonwebtoken');
const router = express.Router();


const user = require('../schemas/userSchema')

router.post('/signUp',async(req,res)=>{
    try{
        const {userName,password} = req.body;
        const existingUser = await user.findOne({userName})
        if(existingUser){
            return res.status(400).json({message:"User Already Exists"});
        }
        const hashedPassword = await bcrypt.hash(password,10);
        await user.create({userName,password: hashedPassword}) ;
        res.status(201).json({message:"User Created Successfully!"});
    }
    catch(err){
        res.status(500).json({message:'Server Error',error:err.message});
    }
});

router.post('/signIn',async(req,res)=>{
    try{
        const {userName,password} = req.body;
        const checkUser = await user.findOne({userName});
        if(!checkUser){
           return res.status(401).json({message:"User Doesn't Exist, Please SignUp"});
        }
        const isMatch = await bcrypt.compare(password,checkUser.password);
        if(!isMatch){
            return res.status(401).json({message:'Invalid Credentials'})
        }
        const token = jwtToken.sign({userId:checkUser._id,userName},process.env.jwt_secret_key,{expiresIn:'1d'})
        res.status(200).json({message:"Logged In Successfully!",token});
    }
    catch(err){
        res.status(500).json({message:"Server Error",error:err.message})
    }
})

module.exports = router;