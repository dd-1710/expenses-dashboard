import { Routes } from '@angular/router';
import { Login } from '../components/login/login';
import { Header } from '../components/header/header';

export const routes: Routes = [
    {
     path:'',
     loadComponent:()=>import('../components/login/login').then((m)=>m.Login)
    },
    {
      path:'dashboard',
      loadComponent:()=>import("../components/header/header").then((m)=>m.Header)
    }
];
