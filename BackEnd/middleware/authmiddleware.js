const jwt = require('jsonwebtoken');

const authMiddleware = (req,res,next)=>{
   const authToken = req.headers.authorization;
   if(!authToken){
      return res.status(401).json({message:'No auth token is present'});
   }

   const token = authToken.split(' ')[1];
   try{
      const verify = jwt.verify(token,process.env.jwt_secret_key);
      req.user = verify;
      return next();
   }
   catch(err){
      return res.status(401).json({message:"Invalid Credentials"});
   }
}

module.exports = authMiddleware