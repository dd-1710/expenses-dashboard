import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddExpense } from './add-expense';

describe('AddExpense', () => {
  let component: AddExpense;
  let fixture: ComponentFixture<AddExpense>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddExpense],
    }).compileComponents();

    fixture = TestBed.createComponent(AddExpense);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('is dropdown open',()=>{
    expect(component.dropdownOpen).toBeFalsy();
  })

  it('total categories',()=>{
    expect(component.categories.length).toBe(11)
  })

  it('future date is rejected',()=>{
    component.addExpenseForm.get('date')?.setValue('2030-01-01');
    expect(component.addExpenseForm.get('date')?.errors?.['futureDate']).toBeTruthy();
  })
});
