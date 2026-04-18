import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('has username password',()=>{
    expect(component.loginForm.contains('userName')).toBeTruthy();
    expect(component.loginForm.contains('password')).toBeTruthy()
  })

  it('is valid form',()=>{
    expect(component.loginForm.valid).toBeFalsy()
  })

  it('both fields filled',()=>{
    component.loginForm.setValue({userName:'testuser',password:'test@1234'})
    expect(component.loginForm.valid).toBeTruthy();
  })
});
