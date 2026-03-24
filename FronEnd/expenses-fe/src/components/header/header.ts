import { Component } from '@angular/core';
import { FaIconLibrary,FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faIndianRupeeSign,faPlus,faSun,faMoon } from '@fortawesome/free-solid-svg-icons';
@Component({
  selector: 'app-header',
  imports: [FaIconComponent],
  templateUrl: './header.html',
  styleUrl: './header.css',
  standalone: true
})
export class Header {
  constructor(library: FaIconLibrary){
    library.addIcons(faIndianRupeeSign,faPlus,faSun,faMoon)

  }

  isDarkMode:boolean = false;
}
