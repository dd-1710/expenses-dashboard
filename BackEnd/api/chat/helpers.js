const { VALID_CATEGORIES } = require('./constants');

function safeJSONParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

function normalizeCategory(category) {
  if (!category || typeof category !== 'string') return 'Others';
  const found = VALID_CATEGORIES.find(
    (c) => c.toLowerCase() === category.trim().toLowerCase()
  );
  return found || 'Others';
}

function extractAmountFromText(message) {
  const match = String(message || '').match(/(\d[\d,]*)/);
  if (!match) return null;
  const amount = parseInt(match[1].replace(/,/g, ''), 10);
  if (!amount || amount <= 0 || amount > 10000000) return null;
  return amount;
}

function resolveCategory(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim().toLowerCase();
  return VALID_CATEGORIES.find((c) => trimmed.includes(c.toLowerCase())) || null;
}

function looksLikeUPIOrSMS(message) {
  const msg = String(message || '').toLowerCase();
  const patterns = [
    /(?:paid|sent|debited).*(?:upi|gpay|phonepe|paytm|bhim)/i,
    /(?:upi|gpay|phonepe|paytm|bhim).*(?:paid|sent|debited)/i,
    /inr\s*[\d,]+.*debited/i,
    /debited.*inr\s*[\d,]+/i,
    /rs\.?\s*[\d,]+.*(?:debited|transferred|paid)/i,
    /(?:txn|transaction).*(?:id|ref|no)/i,
    /upi\s*ref/i,
    /vpa[:\s]/i,
    /a\/c\s*(?:xx|\*)/i
  ];
  return patterns.some((p) => p.test(msg));
}

function getMonthEnd(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getMonthRange(date = new Date()) {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1)
  };
}

function getDaysLeftInMonth(date = new Date()) {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const monthEnd = getMonthEnd(date);
  const diffMs = monthEnd - today;
  return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

function parseExplicitDate(value) {
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseRelativeDate(text) {
  if (!text || typeof text !== 'string') return null;
  const msg = text.trim().toLowerCase();
  const now = new Date();
  if (msg === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (msg === 'yesterday') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - 1);
    return d;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  }
  return null;
}

function isValidExpenseDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const minDate = new Date(2026, 0, 1);
  return date <= today && date >= minDate;
}

function isRecurringScenario(message) {
  const msg = String(message || '').toLowerCase();
  return (
    msg.includes('every day') ||
    msg.includes('daily') ||
    msg.includes('each day')
  );
}

module.exports = {
  safeJSONParse,
  formatCurrency,
  normalizeCategory,
  extractAmountFromText,
  resolveCategory,
  looksLikeUPIOrSMS,
  getMonthEnd,
  getMonthRange,
  getDaysLeftInMonth,
  parseExplicitDate,
  parseRelativeDate,
  isValidExpenseDate,
  isRecurringScenario
};
