import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from '../environments/environment';
import { AuthResponse, MessageResponse } from '../interfaces/addExpense.model';

@Injectable({
    providedIn: 'root',
})
export class UserService {
    private apiURL = environment.apiUrl;

    constructor(private http: HttpClient) {}

    signIn(userName: string, password: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.apiURL}/api/signIn`, { userName, password });
    }

    signUp(userName: string, password: string): Observable<MessageResponse> {
        return this.http.post<MessageResponse>(`${this.apiURL}/api/signUp`, { userName, password });
    }
}