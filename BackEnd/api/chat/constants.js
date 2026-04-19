const VALID_CATEGORIES = [
  'Food',
  'Shopping',
  'Vacation',
  'Health',
  'Insurance',
  'Transportation',
  'Entertainment',
  'Bills',
  'Education',
  'Investment',
  'Others'
];

const SUPPORTED_INTENTS = [
  'ADD_EXPENSE',
  'GET_STATUS',
  'GET_REMAINING',
  'GET_BURNDOWN',
  'GET_ADVICE',
  'GET_RECENT_EXPENSES',
  'GET_TOP_CATEGORY',
  'GET_CATEGORY_SPEND',
  'WHAT_IF',
  'HELP',
  'UNKNOWN'
];

const EXTRACTION_MODEL = 'llama-3.3-70b-versatile';

module.exports = { VALID_CATEGORIES, SUPPORTED_INTENTS, EXTRACTION_MODEL };
