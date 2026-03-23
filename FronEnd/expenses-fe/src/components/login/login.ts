import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FaIconLibrary, FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faEye, faEyeSlash, faUser, faLock, faSignInAlt, faUserPlus } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FaIconComponent],
  templateUrl: './login.html',
})
export class Login implements OnInit {
  loginForm!: FormGroup;
  isSignUp = false;
  showPassword = false;
  showConfirmPassword = false;
  loading = false;
  error = '';

  constructor(private fb: FormBuilder, library: FaIconLibrary) {
    library.addIcons(faEye, faEyeSlash, faUser, faLock, faSignInAlt, faUserPlus);
  }

  ngOnInit() {
    this.buildForm();
  }

  buildForm() {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }

 
  setMode(mode: boolean) {
    this.isSignUp = mode;
    this.error = '';
    this.loginForm.reset();
  }

  toggleMode() {
    this.setMode(!this.isSignUp);
  }

  toggleShowPassword() {
    this.showPassword = !this.showPassword;
  }

  submit() {
    this.error = '';
    if (this.loginForm.invalid) {
      this.error = 'Please complete all required fields.';
      return;
    }

    this.loading = true;
    setTimeout(() => {
      alert(this.isSignUp ? 'Account created successfully!' : 'Signed in successfully!');
      this.loading = false;
      this.loginForm.reset();
    }, 1000);
  }

  get username() { return this.loginForm.get('username'); }
  get password() { return this.loginForm.get('password'); }
}