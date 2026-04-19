const { formatCurrency, normalizeCategory } = require('./helpers');

function buildAdviceReply({
  budget,
  totalSpent,
  remaining,
  daysLeft,
  dailyLimit,
  monthExpenses,
  topCategory
}) {
  if (monthExpenses.length < 3) {
    return `You've spent ${formatCurrency(totalSpent)} out of ${formatCurrency(budget)} (${budget > 0 ? Math.round((totalSpent / budget) * 100) : 0}%), with ${formatCurrency(remaining)} remaining. There isn't enough data yet for strong personalized tips. Keep tracking your expenses, and I'll identify spending patterns as more data builds up.`;
  }

  const parts = [];

  parts.push(
    `You've spent ${formatCurrency(totalSpent)} out of ${formatCurrency(budget)}, with ${formatCurrency(remaining)} remaining.`
  );

  if (daysLeft > 0) {
    parts.push(
      `You have ${daysLeft} day${daysLeft > 1 ? 's' : ''} left in the month, so keeping daily spending around ${formatCurrency(dailyLimit)} can help you stay within budget.`
    );
  }

  if (topCategory) {
    parts.push(
      `Your top spending category this month is ${topCategory.category} at ${formatCurrency(topCategory.amount)}.`
    );
  }

  if (budget > 0) {
    const usage = Math.round((totalSpent / budget) * 100);

    if (usage >= 90) {
      parts.push(
        `You've already used most of your budget, so cut non-essential spending for the rest of the month.`
      );
    } else if (usage >= 75) {
      parts.push(
        `Your budget usage is getting high, so be careful with discretionary expenses.`
      );
    } else {
      parts.push(
        `You're still within budget, so the main focus is staying consistent and avoiding sudden spikes.`
      );
    }
  }

  return parts.join(' ');
}

function formatRecentExpenses(expenses, limit = 5) {
  const recent = expenses.slice(0, Math.min(limit, 10));

  if (!recent.length) {
    return 'No expenses found yet.';
  }

  return recent
    .map((e, index) => {
      const category = normalizeCategory(e.category);
      const date = new Date(e.date).toLocaleDateString('en-IN');
      return `${index + 1}. ${category} — ${formatCurrency(e.amount)} on ${date}`;
    })
    .join('\n');
}

function buildWhatIfReply({ amount, stats, budget, recurring }) {
  if (!amount || amount <= 0) {
    return 'Please specify a valid amount.';
  }

  if (recurring) {
    const totalFutureSpend = amount * stats.daysLeft;
    const newRemaining = stats.remaining - totalFutureSpend;

    if (newRemaining < 0) {
      return `If you spend ${formatCurrency(amount)} every day for the next ${stats.daysLeft} day${stats.daysLeft > 1 ? 's' : ''}, you will spend ${formatCurrency(totalFutureSpend)} in total. This exceeds your remaining budget of ${formatCurrency(stats.remaining)} by ${formatCurrency(Math.abs(newRemaining))}.`;
    }

    if (newRemaining === 0) {
      return `If you spend ${formatCurrency(amount)} every day for the next ${stats.daysLeft} day${stats.daysLeft > 1 ? 's' : ''}, you will exactly use up your remaining budget of ${formatCurrency(stats.remaining)}.`;
    }

    return `If you spend ${formatCurrency(amount)} every day for the next ${stats.daysLeft} day${stats.daysLeft > 1 ? 's' : ''}, you will have ${formatCurrency(newRemaining)} left by the end of the month.`;
  }

  const newSpent = stats.totalSpent + amount;
  const newRemaining = budget - newSpent;

  if (newRemaining < 0) {
    return `If you spend ${formatCurrency(amount)}, your total spending will become ${formatCurrency(newSpent)}, which exceeds your budget by ${formatCurrency(Math.abs(newRemaining))}.`;
  }

  if (newRemaining === 0) {
    return `If you spend ${formatCurrency(amount)}, you will use your entire budget (${formatCurrency(budget)}), leaving ₹0 for the rest of the month. That would leave you ${stats.daysLeft} day${stats.daysLeft > 1 ? 's' : ''} with no budget remaining.`;
  }

  return `If you spend ${formatCurrency(amount)}, you will have ${formatCurrency(newRemaining)} left for the rest of the month. That would leave you ${stats.daysLeft} day${stats.daysLeft > 1 ? 's' : ''} to manage the remaining budget.`;
}

module.exports = { buildAdviceReply, formatRecentExpenses, buildWhatIfReply };
