const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const userAPI = require('./api/user')
const expenseAPI = require('./api/expenses');
const chatAPI = require('./api/aichat');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit')

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());
app.use(helmet());

const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {message: 'Too many attempts, try again after 15 minutes'}
})
app.use('/api/signIn', authRateLimiter);
app.use('/api/signUp', authRateLimiter);
app.use('/api', userAPI);
app.use('/api', expenseAPI);
app.use('/api', chatAPI);

if(process.env.NODE_ENV !== 'test'){
 const requiredEnv = ['MONGO_URI', 'jwt_secret_key'];
 requiredEnv.forEach(key => {
   if(!process.env[key]) throw new Error(`Missing required env variable: ${key}`);
 });

 mongoose.connect(process.env.MONGO_URI).then(()=>{console.log("MONGO Connected")}).catch((err)=>{console.log("DB connection failed",err)})
 app.listen(PORT,()=>{
    console.log(`APP Started On ${PORT}`)
 })
}

module.exports = app;