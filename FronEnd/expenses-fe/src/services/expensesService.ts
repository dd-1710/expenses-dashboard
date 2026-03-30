import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environment";
import { Expense } from "../interfaces/addExpense.model";
@Injectable({
    providedIn: 'root'
})

export class expensesService {

    constructor(private http: HttpClient) {

    }

    apiURL = environment.backendURL;

    addExpense(expense: Expense): Observable<any> {
        return this.http.post(`${this.apiURL}/api/add-expense`, expense)
    }

    getAllExpenses(): Observable<any> {
        return this.http.get(`${this.apiURL}/api/get-all-expenses`);
    }

    updateExpense(id: string, expense: Expense): Observable<any> {
        return this.http.put(`${this.apiURL}/api/update-expense/${id}`, expense);
    }

    deleteExpense(id: string): Observable<any> {
        return this.http.delete(`${this.apiURL}/api/delete-expense/${id}`);
    }

    getBudget(): Observable<any> {
        return this.http.get(`${this.apiURL}/api/get-user-budget`);
    }

    updateBudget(budget: number): Observable<any> {
        return this.http.put(`${this.apiURL}/api/update-user-budget`, { budget });
    }

    aiChat(message: string): Observable<any> {
        return this.http.post(`${this.apiURL}/api/aichat`,{message});
    }
}