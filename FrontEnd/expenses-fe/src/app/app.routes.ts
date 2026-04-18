import { Routes } from '@angular/router';
import { Login } from '../components/login/login';
import { Header } from '../components/header/header';
import { authGuard } from '../authguard/authguard';

export const routes: Routes = [
    {
     path:'',
    // loadComponent:()=>import("../components/header/header").then((m)=>m.Header)
      loadComponent:()=>import('../components/login/login').then((m)=>m.Login)
    },
    {
      path:'dashboard',
      canActivate : [authGuard],
      loadComponent:()=>import("../components/header/header").then((m)=>m.Header)
    }
];
