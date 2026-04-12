import { Injectable } from "@angular/core";
import { catchError, Observable, throwError } from "rxjs";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environment";
import { Expense } from "../interfaces/addExpense.model";
import { BehaviorSubject } from "rxjs";
@Injectable({
    providedIn: 'root'
})

export class expensesService {

    constructor(private http: HttpClient) {

    }

    private expenseCount = new BehaviorSubject<number>(0);
    expenseCount$ = this.expenseCount.asObservable();


    updateExpenseCount(count:number){
        this.expenseCount.next(count)
    }


    apiURL = environment.apiUrl;

    private handleError(err: any): Observable<never> {
        return throwError(() => err);
    }

    addExpense(expense: Expense): Observable<any> {
        return this.http.post(`${this.apiURL}/api/add-expense`, expense).pipe(catchError(err => this.handleError(err)));
    }

    getAllExpenses(): Observable<any> {
        return this.http.get(`${this.apiURL}/api/get-all-expenses`).pipe(catchError(err => this.handleError(err)));
    }

    updateExpense(id: string, expense: Expense): Observable<any> {
        return this.http.put(`${this.apiURL}/api/update-expense/${id}`, expense).pipe(catchError(err => this.handleError(err)));
    }

    deleteExpense(id: string): Observable<any> {
        return this.http.delete(`${this.apiURL}/api/delete-expense/${id}`).pipe(catchError(err => this.handleError(err)));
    }

    getBudget(): Observable<any> {
        return this.http.get(`${this.apiURL}/api/get-user-budget`).pipe(catchError(err => this.handleError(err)));
    }

    updateBudget(budget: number): Observable<any> {
        return this.http.put(`${this.apiURL}/api/update-user-budget`, { budget }).pipe(catchError(err => this.handleError(err)));
    }

    aiChat(message: string): Observable<any> {
        return this.http.post(`${this.apiURL}/api/aichat`,{message}).pipe(catchError(err => this.handleError(err)));
    }
}