const express = require('express');
const cors = require('cors');
const mgdb = require('mongoose');
require('dotenv').config();
const userAPI = require('./api_list/user')
const addexpenseAPI = require('./api_list/expenses');

const app = express();
const PORT = process.env.PORT 
app.use(cors());
app.use(express.json());

app.use('/api',userAPI)
app.use('/api',addexpenseAPI)

mgdb.connect(process.env.MONGO_URI).then(()=>{console.log("MONGO Connected")}).catch((err)=>{console.log("There is issue while connecting DB",err)})


app.listen(PORT,()=>{
    console.log(`APP Started On ${PORT}`)
})