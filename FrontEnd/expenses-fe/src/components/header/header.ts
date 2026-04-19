import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FaIconLibrary,FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faIndianRupeeSign,faPlus,faCircleHalfStroke,faMoon, faSignOut, faBars, faXmark, faReceipt } from '@fortawesome/free-solid-svg-icons';
import { AddExpense } from "../add-expense/add-expense";
import { UserContent } from '../user-content/user-content';
import { Router } from '@angular/router';
import { ExpensesService } from '../../services/expensesService';
import { Expense } from '../../interfaces/addExpense.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
@Component({
  selector: 'app-header',
  imports: [FaIconComponent, AddExpense, UserContent],
  templateUrl: './header.html',
  styleUrl: './header.css',
  standalone: true
})
export class Header implements OnInit {
  private destroyRef = inject(DestroyRef);

  constructor(library: FaIconLibrary, private router: Router,private expenseSer:ExpensesService){
    library.addIcons(faIndianRupeeSign,faPlus,faCircleHalfStroke,faMoon, faSignOut, faBars, faXmark, faReceipt)

  }

  isDarkMode:boolean = localStorage.getItem('darkMode') === 'true';
  isMenuOpen:boolean = false;
  showExpense = signal(false);
  expenses:Expense[]=[];
  expensesCount:number = 0;

  ngOnInit(){
   document.documentElement.classList.toggle('dark', this.isDarkMode);
   this.expenseSer.expenseCount$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((count:number)=>{
    this.expensesCount = count
   })
  }

  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    document.documentElement.classList.toggle('dark', this.isDarkMode);
    localStorage.setItem('darkMode', String(this.isDarkMode));
  }


  signOut(){
    sessionStorage.clear();
    localStorage.removeItem('darkMode');
    document.documentElement.classList.remove('dark');
    this.router.navigate(['/']);
  }

  
}
