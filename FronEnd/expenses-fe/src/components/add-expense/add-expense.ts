import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormGroup, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FaIconComponent, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faIndianRupeeSign, faTag, faPen, faCalendar, faXmark, faPlus, faChevronDown, faUtensils, faCartShopping, faPlane, faHeartPulse, faShieldHalved, faCar, faFilm, faFileInvoice, faGraduationCap, faEllipsis, faCheck, faStickyNote, faArrowsRotate, faChartLine } from '@fortawesome/free-solid-svg-icons';
import { expensesService } from '../../services/expensesService';
import { Expense } from '../../interfaces/addExpense.model';
@Component({
  selector: 'app-add-expense',
  imports: [CommonModule, ReactiveFormsModule, FaIconComponent],
  templateUrl: './add-expense.html',
  styleUrl: './add-expense.css',
  standalone: true,
})
export class AddExpense{
   @Output() close = new EventEmitter<void>();
   @Output() fetchExpData = new EventEmitter<void>();
   @Input() editedData!:Expense;
  constructor(private fb: FormBuilder, library: FaIconLibrary,private expenseSer:expensesService) {
    library.addIcons(faIndianRupeeSign, faTag, faPen, faCalendar, faXmark, faPlus, faChevronDown, faUtensils, faCartShopping, faPlane, faHeartPulse, faShieldHalved, faCar, faFilm, faFileInvoice, faGraduationCap, faEllipsis, faCheck,faStickyNote,faArrowsRotate,faChartLine);
    this.buildForm();
  }

  ngOnInit(){
    if(this.editedData){
      console.log(this.editedData)
      this.isEdit = true;
      this.addExpenseForm.patchValue({
      amount: this.editedData.amount,
      category: this.editedData.category,
      description: this.editedData.description,
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

  futureDate(control:AbstractControl):ValidationErrors | null{
     const inputDate = control.value;
     const today = new Date().toISOString().split('T')[0];
     if(inputDate>today){
      return {futureDate:true}
     }
     return null;
  }

  buildForm(){
    this.addExpenseForm = this.fb.group({
        amount: ['',[Validators.required,Validators.min(1)]],
        category: ['',Validators.required],
        description: ['',[Validators.minLength(0),Validators.maxLength(300)]],
        date: ['',[Validators.required,this.futureDate]],
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
    if(this.isEdit){
      this.expenseSer.updateExpense(this.editedData._id,this.addExpenseForm.value).subscribe({
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
    this.expenseSer.addExpense(this.addExpenseForm.value).subscribe({
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
