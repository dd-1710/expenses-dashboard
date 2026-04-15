const express = require('express');
const cors = require('cors');
const mgdb = require('mongoose');
require('dotenv').config();
const userAPI = require('./api/user')
const addexpenseAPI = require('./api/expenses');
const chatAPI = require('./api/aichat');
const helmet = require('helmet');
const rateLimit1 = require('express-rate-limit')

const app = express();
const PORT = process.env.PORT 
app.use(cors());
app.use(express.json());
app.use(helmet());

const rateLimiter = rateLimit1({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {message: 'Too many attempts, try again after 15 minutes'}
})
app.use('/api/signIn',rateLimiter);
app.use('/api/signUp',rateLimiter)
app.use('/api',userAPI);
app.use('/api',addexpenseAPI);
app.use('/api',chatAPI);

if(process.env.NODE_ENV !== 'test'){
 mgdb.connect(process.env.MONGO_URI).then(()=>{console.log("MONGO Connected")}).catch((err)=>{console.log("There is issue while connecting DB",err)})
 app.listen(PORT,()=>{
    console.log(`APP Started On ${PORT}`)
 })
}

module.exports = app;