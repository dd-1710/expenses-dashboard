import { Injectable } from "@angular/core";
import { Observable, BehaviorSubject } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "../environments/environment";
import { Expense, MessageResponse, BudgetResponse, AiChatResponse } from "../interfaces/addExpense.model";

@Injectable({
    providedIn: 'root'
})
export class ExpensesService {
    private apiURL = environment.apiUrl;
    private expenseCount = new BehaviorSubject<number>(0);
    expenseCount$ = this.expenseCount.asObservable();

    constructor(private http: HttpClient) {}

    updateExpenseCount(count: number) {
        this.expenseCount.next(count);
    }

    addExpense(expense: Expense): Observable<MessageResponse> {
        return this.http.post<MessageResponse>(`${this.apiURL}/api/add-expense`, expense);
    }

    getAllExpenses(): Observable<Expense[]> {
        return this.http.get<Expense[]>(`${this.apiURL}/api/get-all-expenses`);
    }

    updateExpense(id: string, expense: Expense): Observable<MessageResponse> {
        return this.http.put<MessageResponse>(`${this.apiURL}/api/update-expense/${id}`, expense);
    }

    deleteExpense(id: string): Observable<MessageResponse> {
        return this.http.delete<MessageResponse>(`${this.apiURL}/api/delete-expense/${id}`);
    }

    getBudget(): Observable<BudgetResponse> {
        return this.http.get<BudgetResponse>(`${this.apiURL}/api/get-user-budget`);
    }

    updateBudget(budget: number): Observable<BudgetResponse> {
        return this.http.put<BudgetResponse>(`${this.apiURL}/api/update-user-budget`, { budget });
    }

    aiChat(message: string): Observable<AiChatResponse> {
        return this.http.post<AiChatResponse>(`${this.apiURL}/api/aichat`, { message });
    }
}