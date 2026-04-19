import { Component, DestroyRef, EventEmitter, inject, Input, OnInit, Output } from '@angular/core';
import { FormGroup, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FaIconComponent, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faIndianRupeeSign, faTag, faPen, faCalendar, faXmark, faPlus, faChevronDown, faUtensils, faCartShopping, faPlane, faHeartPulse, faShieldHalved, faCar, faFilm, faFileInvoice, faGraduationCap, faEllipsis, faCheck, faStickyNote, faArrowsRotate, faChartLine } from '@fortawesome/free-solid-svg-icons';
import { ExpensesService } from '../../services/expensesService';
import { Expense } from '../../interfaces/addExpense.model';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
@Component({
  selector: 'app-add-expense',
  imports: [CommonModule, ReactiveFormsModule, FaIconComponent],
  templateUrl: './add-expense.html',
  styleUrl: './add-expense.css',
  standalone: true,
})
export class AddExpense{
   private destroyRef = inject(DestroyRef);
   @Output() close = new EventEmitter<void>();
   @Output() fetchExpData = new EventEmitter<void>();
   @Input() editedData!:Expense;
  constructor(private fb: FormBuilder, library: FaIconLibrary,private expenseSer:ExpensesService) {
    library.addIcons(faIndianRupeeSign, faTag, faPen, faCalendar, faXmark, faPlus, faChevronDown, faUtensils, faCartShopping, faPlane, faHeartPulse, faShieldHalved, faCar, faFilm, faFileInvoice, faGraduationCap, faEllipsis, faCheck,faStickyNote,faArrowsRotate,faChartLine);
    this.buildForm();
  }

  ngOnInit(){
    if(this.editedData){
      this.isEdit = true;
      this.addExpenseForm.patchValue({
      ...this.editedData,
      date: this.editedData.date.split('T')[0]
    })
    }
  }

  
  addExpenseForm!: FormGroup;
  today = new Date().toISOString().split('T')[0];
  dropdownOpen = false;
  success = '';
  error = '';
  isEdit = false;

  categories: {value: string, label: string, icon: [string, string]}[] = [
    { value: 'Food', label: 'Food', icon: ['fas', 'utensils'] },
    { value: 'Shopping', label: 'Shopping', icon: ['fas', 'cart-shopping'] },
    { value: 'Vacation', label: 'Vacation', icon: ['fas', 'plane'] },
    { value: 'Health', label: 'Health', icon: ['fas', 'heart-pulse'] },
    { value: 'Insurance', label: 'Insurance', icon: ['fas', 'shield-halved'] },
    { value: 'Transportation', label: 'Transportation', icon: ['fas', 'car'] },
    { value: 'Entertainment', label: 'Entertainment', icon: ['fas', 'film'] },
    { value: 'Bills', label: 'Bills', icon: ['fas', 'file-invoice'] },
    { value: 'Education', label: 'Education', icon: ['fas', 'graduation-cap'] },
    { value: 'Investment', label: 'Investment', icon: ['fas', 'chart-line'] },
    { value: 'Others', label: 'Others', icon: ['fas', 'ellipsis'] },
  ];

  minDate: string = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

  futureDate(control:AbstractControl):ValidationErrors | null{
     const inputDate = control.value;
     const today = new Date().toISOString().split('T')[0];
     if(inputDate>today){
      return {futureDate:true}
     }
     return null;
  }

  tooOldDate(control:AbstractControl):ValidationErrors | null{
     const inputDate = control.value;
     const oneYearAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];
     if(inputDate && inputDate < oneYearAgo){
      return {tooOldDate:true}
     }
     return null;
  }

  buildForm(){
    this.addExpenseForm = this.fb.group({
        amount: ['',[Validators.required,Validators.min(1)]],
        category: ['',Validators.required],
        description: ['',[Validators.minLength(0),Validators.maxLength(300)]],
        date: ['',[Validators.required,this.futureDate,this.tooOldDate]],
      })

  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  selectCategory(cat: {value: string, label: string, icon: [string, string]}) {
    this.addExpenseForm.get('category')?.setValue(cat.value);
    this.addExpenseForm.get('category')?.markAsTouched();
    this.dropdownOpen = false;
  }

  selectedCategory() {
    const val = this.category?.value;
    return this.categories.find(c => c.value === val) || null;
  }

  onClose() {
      this.close.emit();
  }

  addExpense() {
    // Check if budget is set before adding expense
    if(this.addExpenseForm.value.amount && !this.isEdit) {
      this.expenseSer.getBudget().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (budgetRes) => {
          if(budgetRes.budget === 0 || budgetRes.budget === undefined) {
            this.error = '⚠️  Budget not set! Please set your monthly budget before adding expenses.';
            setTimeout(() => {
              this.error = '';
            }, 4000);
            return;
          }
          // Proceed with adding expense
          this.submitExpense();
        },
        error: () => {
          this.error = '⚠️  Could not verify budget. Please set your budget first.';
          setTimeout(() => {
            this.error = '';
          }, 4000);
        }
      });
    } else {
      this.submitExpense();
    }
  }

  submitExpense() {
    if(this.isEdit){
      this.expenseSer.updateExpense(this.editedData._id,this.addExpenseForm.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res=>{
          this.success = res.message;
          setTimeout(()=>{
            this.success = '';
            this.close.emit();
          },500)
          this.fetchExpData.emit();
        },error: err=>{
          this.error = err.error?.message || 'Unable to update the expense';
          setTimeout(()=>{
            this.error = ''
            this.close.emit();
          },500);
        }
      })

    }else{
    this.expenseSer.addExpense(this.addExpenseForm.value).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.success = res.message;
        setTimeout(() => {
            this.success = '';
        }, 3000);
        this.fetchExpData.emit();
        this.addExpenseForm.reset();
      },
      error: (err) => {
        this.error = err.error?.message || 'Unable to add the expense';
        setTimeout(() => {
          this.error = '';
        }, 3000);

      }
    })
  }
  }

  reset(){
    this.addExpenseForm.reset();
  }


  get amount() {return this.addExpenseForm.get('amount')}
  get category() {return this.addExpenseForm.get('category')}
  get description() { return this.addExpenseForm.get('description')}
  get date() {return this.addExpenseForm.get('date')}
}
