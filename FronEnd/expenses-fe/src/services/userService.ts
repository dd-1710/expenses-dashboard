import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { catchError, Observable, tap } from "rxjs";
import {environment} from '../../environment'

@Injectable({
    providedIn:'root',
})

export class UserService{
    constructor(private http:HttpClient){

    }

    private apiURL = environment.backendUrl;

    signIn(userName:string,password:string):Observable<any>{
     return this.http.post(`${this.apiURL}/api/signIn`,{userName,password})
    //  .pipe(
    //     tap({error:(err)=>console.log("Login Failed !",err)})
    //  )
    }


    signUp(userName:string,password:string):Observable<any>{
      return this.http.post(`${this.apiURL}/api/signUp`,{userName,password})
    // .pipe(
    //     tap({error:(err)=>console.log("SignUp Failed",err)})
    //  )
    }
}