const mgdb = require('mongoose');

const expensesSchema = new mgdb.Schema({
    userId: { type: mgdb.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true },
    description: { type: String },
    date: { type: Date, required: true }
})

module.exports = mgdb.model('Expenses', expensesSchema)