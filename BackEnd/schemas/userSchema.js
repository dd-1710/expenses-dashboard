const mgdb = require('mongoose');

const userSchema = new mgdb.Schema({
    userName: {type:String,required:true,unique:true},
    password: {type:String,required:true},
    budget: {type:Number,default:0}
})

const UserModel = mgdb.model('User',userSchema);
module.exports = UserModel;