const Expense = require('../../schemas/expenseSchema');
const { normalizeCategory, getMonthEnd, getMonthRange, getDaysLeftInMonth } = require('./helpers');

async function loadExpenseStats(userId, budget) {
  const allExpenses = await Expense.find({ userId }).sort({ date: -1 });

  const totalSpent = allExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const remaining = Number(budget || 0) - totalSpent;
  const spentPercent = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

  const { start: monthStart, end: monthEndExclusive } = getMonthRange(new Date());

  const monthExpenses = allExpenses.filter((e) => {
    const d = new Date(e.date);
    return d >= monthStart && d < monthEndExclusive;
  });

  const thisMonthSpent = monthExpenses.reduce(
    (sum, e) => sum + Number(e.amount || 0),
    0
  );

  const daysLeft = getDaysLeftInMonth(new Date());
  const dailyLimit = remaining > 0 ? Math.floor(remaining / daysLeft) : 0;

  const today = new Date();
  const elapsedDays = Math.max(today.getDate(), 1);
  const currentDailyBurnRate =
    elapsedDays > 0 ? Math.round(thisMonthSpent / elapsedDays) : 0;

  let projectedMonthTotal = null;
  if (currentDailyBurnRate > 0) {
    projectedMonthTotal = currentDailyBurnRate * getMonthEnd(today).getDate();
  }

  const categoryTotals = {};
  for (const expense of monthExpenses) {
    const category = normalizeCategory(expense.category);
    categoryTotals[category] =
      (categoryTotals[category] || 0) + Number(expense.amount || 0);
  }

  const sortedCategories = Object.entries(categoryTotals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const topCategory = sortedCategories[0] || null;

  return {
    allExpenses,
    totalSpent,
    remaining,
    spentPercent,
    monthExpenses,
    thisMonthSpent,
    daysLeft,
    dailyLimit,
    currentDailyBurnRate,
    projectedMonthTotal,
    sortedCategories,
    topCategory
  };
}

module.exports = { loadExpenseStats };
