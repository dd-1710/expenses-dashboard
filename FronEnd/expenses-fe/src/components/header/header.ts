import { Component, signal } from '@angular/core';
import { FaIconLibrary,FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faIndianRupeeSign,faPlus,faSun,faMoon, faSignOut } from '@fortawesome/free-solid-svg-icons';
import { AddExpense } from "../add-expense/add-expense";
import { UserContent } from '../user-content/user-content';
import { Router } from '@angular/router';
@Component({
  selector: 'app-header',
  imports: [FaIconComponent, AddExpense, UserContent],
  templateUrl: './header.html',
  styleUrl: './header.css',
  standalone: true
})
export class Header {
  constructor(library: FaIconLibrary, private router: Router){
    library.addIcons(faIndianRupeeSign,faPlus,faSun,faMoon, faSignOut)

  }

  isDarkMode:boolean = false;
  showExpense = signal(false);

  signOut(){
    sessionStorage.clear();
    this.router.navigate(['/']);
  }
}
