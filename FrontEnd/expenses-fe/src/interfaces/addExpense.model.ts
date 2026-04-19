export interface Expense {
    _id: string;
    amount: number;
    category: string;
    description?: string;
    date: string;
}

export interface AuthResponse {
    message: string;
    token: string;
}

export interface MessageResponse {
    message: string;
}

export interface BudgetResponse {
    budget: number;
}

export interface AiChatResponse {
    reply: string;
    intent?: string;
    expenseAdded?: boolean;
    expenses?: Expense[];
    needsDate?: boolean;
    needsCategory?: boolean;
    draftExpense?: { amount: number; category: string | null; description?: string; date?: string | null };
}