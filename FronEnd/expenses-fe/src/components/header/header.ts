import { Component, signal } from '@angular/core';
import { FaIconLibrary,FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faIndianRupeeSign,faPlus,faCircleHalfStroke,faMoon, faSignOut, faBars, faXmark } from '@fortawesome/free-solid-svg-icons';
import { AddExpense } from "../add-expense/add-expense";
import { UserContent } from '../user-content/user-content';
import { Router } from '@angular/router';
import { expensesService } from '../../services/expensesService';
import { Expense } from '../../interfaces/addExpense.model';
@Component({
  selector: 'app-header',
  imports: [FaIconComponent, AddExpense, UserContent],
  templateUrl: './header.html',
  styleUrl: './header.css',
  standalone: true
})
export class Header {
  constructor(library: FaIconLibrary, private router: Router,private expenseSer:expensesService){
    library.addIcons(faIndianRupeeSign,faPlus,faCircleHalfStroke,faMoon, faSignOut, faBars, faXmark)

  }

  isDarkMode:boolean = false;
  isMenuOpen:boolean = false;
  showExpense = signal(false);
  expenses:Expense[]=[];

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    document.documentElement.classList.toggle('dark', this.isDarkMode);
  }


  signOut(){
    sessionStorage.clear();
    this.router.navigate(['/']);
  }

  
}
