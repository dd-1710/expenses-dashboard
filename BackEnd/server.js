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
const PORT = process.env.PORT || 3000;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:4200').split(',');
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json({ limit: '100kb' }));

const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {message: 'Too many attempts, try again after 15 minutes'}
})
app.use('/api/signIn', authRateLimiter);
app.use('/api/signUp', authRateLimiter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api', userAPI);
app.use('/api', expenseAPI);
app.use('/api', chatAPI);

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

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