import { inject } from "@angular/core";
import { CanActivateFn } from "@angular/router";
import { Router } from "@angular/router";
export const authGuard: CanActivateFn = ()=>{
    const route = inject(Router)
    const token = sessionStorage.getItem('token')
    
     if(token) {
        return true;
    }else{
         route.navigate(['/']);
         return false
    }
}