import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FaIconLibrary, FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faEye, faEyeSlash, faUser, faLock, faSignInAlt, faUserPlus, faWallet, faChartPie, faPlus, faList, faChartLine, faHeart ,faIndianRupeeSign } from '@fortawesome/free-solid-svg-icons';
import { UserService } from '../../services/userService';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FaIconComponent],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private destroyRef = inject(DestroyRef);
  loginForm!: FormGroup;
  isSignUp = false;
  showPassword = false;
  showConfirmPassword = false;
  loading = false;
  success = '';
  error = '';
  

  constructor(private fb: FormBuilder, library: FaIconLibrary,private userService:UserService,private router:Router) {
    library.addIcons(faEye, faEyeSlash, faUser, faLock, faSignInAlt, faUserPlus, faWallet, faChartPie, faPlus, faList, faChartLine, faHeart, faIndianRupeeSign);
  }

  ngOnInit() {
    this.buildForm();
  }

  buildForm() {
    this.loginForm = this.fb.group({
      userName: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

 
  setMode(mode: boolean) {
    this.isSignUp = mode;
    this.error = '';
    this.success = '';
    this.loginForm.reset();
  }

  toggleMode() {
    this.setMode(!this.isSignUp);
  }

  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }

  submit() {
    this.success = '';
    this.error = '';
    this.loading = true;
    const {userName,password} = this.loginForm.value;
    if (this.isSignUp) {
      this.userService.signUp(userName, password).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res) => {
          this.loading = false;
          this.success = res.message;
          setTimeout(()=>{
             this.success = '';
             this.setMode(false);
          },3000)
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.message || "Server is Down";
          setTimeout(()=>{
          this.error = '';
          },3000)
        }
      })

    } else {
      this.userService.signIn(userName,password).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (res)=>{
          this.success = res.message;
          this.success = '';
          sessionStorage.setItem('token',res.token);
          sessionStorage.setItem('userName',userName);
          this.router.navigate(['/dashboard'])   
          this.loading = false;    
        },
        error: (err)=>{
          this.error = err.error?.message || "Server is Down";
          setTimeout(() => {
             this.error = '';
             this.loading = false;
          }, 3000);
        }
      })

    }

  }

  get userName() { return this.loginForm.get('userName'); }
  get password() { return this.loginForm.get('password'); }
}