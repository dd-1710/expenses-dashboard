const mgdb = require('mongoose');

const userSchema = new mgdb.Schema({
    userName: {type:String,required:true,unique:true},
    password: {type:String,required:true}
})

const UserModel = mgdb.model('User',userSchema);
module.exports = UserModel;