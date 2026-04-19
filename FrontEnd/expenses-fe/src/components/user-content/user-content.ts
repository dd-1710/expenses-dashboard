import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExpensesService } from '../../services/expensesService';
import { Expense } from '../../interfaces/addExpense.model';
import { FaIconLibrary,FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faHandshake, faWallet, faChevronUp, faChevronDown, faChevronLeft, faChevronRight, faTriangleExclamation, faCircleExclamation, faArrowTrendUp, faCoins, faSackDollar, faGauge, faReceipt, faChartPie, faRobot, faUtensils, faCartShopping, faCar, faFilm, faFileInvoice, faPen, faTrash, faFloppyDisk, faPlane, faHeartPulse, faShieldHalved, faGraduationCap, faEllipsis, faChartLine, faCircleCheck, faReceipt as faReceiptAlt } from '@fortawesome/free-solid-svg-icons';
import { AddExpense } from '../add-expense/add-expense';
import { AiChat } from '../ai-chat/ai-chat';
import { BaseChartDirective } from 'ng2-charts';
import { ArcElement, BarController, BarElement, CategoryScale, Chart, ChartData, DoughnutController, Filler, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';

Chart.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, BarController, DoughnutController, LineController, LineElement, PointElement, Filler);

@Component({
  selector: 'app-user-content',
  imports: [FaIconComponent, CommonModule, FormsModule, AddExpense, AiChat, BaseChartDirective],
  templateUrl: './user-content.html',
  styleUrls: ['./user-content.css'],
  standalone:true,
})
export class UserContent implements OnInit {
  private destroyRef = inject(DestroyRef);

  selectExp!: Expense;
  greet:string = '';
  today = new Date();
  userName = sessionStorage.getItem('userName')?.toUpperCase();
  expenses: Expense[] = [];
  budget: number = 0;
  totalSpent: number = 0;
  remaining: number = 0;
  spentPercentage: number = 0;
  isAccordionOpen: boolean = true;
  isEditingBudget: boolean = false;
  activeTab: string = 'expenses';
  isEditingForm = false;
  selectedFilter: string = 'All';
  success!: string;
  error!: string;
  doughnutData: ChartData<'doughnut'> = {labels:[],datasets:[]};
  barData: ChartData<'bar'> = {labels:[],datasets:[]};
  monthlyData: ChartData<'line'> = {labels:[],datasets:[]};
  categoryColors: Record<string, string> = {
  'Food': '#FF6384',
  'Shopping': '#9966FF',
  'Vacation': '#36A2EB',
  'Health': '#FF9F40',
  'Insurance': '#4BC0C0',
  'Transportation': '#5B8FF9',
  'Entertainment': '#FF6B6B',
  'Bills': '#FFCD56',
  'Education': '#2DD4BF',
  'Investment': '#34D399',
  'Others': '#C9CBCF'
};
  page: number = 1;
  limit: number = 3;
  totalCount : number = 0;
  totalPages:number = 0;
  chartCategoryData: { _id: string, total: number }[] = [];

  constructor(private expenseSer:ExpensesService, library:FaIconLibrary){
   library.addIcons(faHandshake, faWallet, faChevronUp,faChevronLeft, faChevronRight, faChevronDown, faTriangleExclamation, faCircleExclamation, faArrowTrendUp, faCoins, faSackDollar, faGauge, faReceipt, faChartPie, faRobot, faUtensils, faCartShopping, faCar, faFilm, faFileInvoice, faPen, faTrash, faFloppyDisk, faPlane, faHeartPulse, faShieldHalved, faGraduationCap, faEllipsis, faChartLine, faCircleCheck)
  }
  ngOnInit(){
   this.userMessage();
   this.fetchBudget();
   this.fetchAllExpenses();
   this.totalCalculation()
  }

  userMessage() {
    let hour = new Date().getHours();
    if (hour >= 0 && hour < 12 ) {
      this.greet = "Good Morning";
    }
    else if (hour >= 12 && hour < 17) {
      this.greet = "Good Afternoon";
    } 
    else
      {
      this.greet = "Good Evening";
    }
  }

  fetchBudget(){
    this.expenseSer.getBudget().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: res=>{
          this.budget = res.budget;
        },
        error: err=>{
          this.error = err.error?.message || 'Failed to load budget';
        }
      })

  }
  
  saveBudget(){
    this.expenseSer.updateBudget(this.budget).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res=>{
        this.budget = res.budget;
        this.totalCalculation();
        this.isEditingBudget = false
      },
      error: err=>{
        this.error = err.error?.message || 'Failed to update budget';
      }
    })
  }

   fetchAllExpenses(){
    this.expenseSer.getAllExpenses(this.page,this.limit).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res=>{
        this.expenses = res.expenseData;
        this.totalCount = res.totalCount; 
        this.totalSpent = res.totalSpent;
        this.chartCategoryData = res.categoryData;
        this.totalPages = Math.ceil(this.totalCount/this.limit)
        this.expenseSer.updateExpenseCount(res.totalCount);
        this.totalCalculation();
        this.buildCharts(res.categoryData, res.dailyData, res.monthlyData);
      },
      error: err=>{
        this.error = err.error?.message || 'Failed to load expenses';
      }
    })
  }

 nextPage(){
  if(this.page < this.totalPages){ 
   this.page++;
   this.fetchAllExpenses();
  }
  }

  previousPage(){
    if(this.page > 1){
      this.page--;
      this.fetchAllExpenses();
    }
  }


 editExpForm(exp:Expense){
  this.selectExp = exp;
  this.isEditingForm = true;
 }

 deleteExp(exp:Expense){
  this.expenseSer.deleteExpense(exp._id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
    next: res=>{
      this.success = res.message;
      this.fetchAllExpenses();
      setTimeout(() => { this.success = ''}, 3000);
    },
    error: err=>{
      this.error = err.error?.message || 'Failed to delete expense';
      setTimeout(() => { this.error = ''}, 3000);
    }
  })
  }

  totalCalculation() {
    this.remaining = this.budget - this.totalSpent;
    this.spentPercentage = this.budget > 0 ? (this.totalSpent/this.budget)*100 : 0;
  }

  toggleAccordion() {
    this.isAccordionOpen = !this.isAccordionOpen;
  }

  get filteredExpenses(): Expense[] {
    if (this.selectedFilter === 'All') return this.expenses;
    return this.expenses.filter(exp => exp.category === this.selectedFilter);
  }

  get activeCategories(): string[] {
    return [...new Set(this.expenses.map(exp => exp.category))];
  }

  get categoryBreakdown(): { category: string; amount: number; color: string; percent: number }[] {
    return this.chartCategoryData.map(c => ({
      category: c._id,
      amount: c.total,
      color: this.categoryColors[c._id] || '#94a3b8',
      percent: this.totalSpent > 0 ? Math.round((c.total / this.totalSpent) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);
  }

  get breakdownLeft() {
    return this.categoryBreakdown.filter((_, i) => i % 2 === 0);
  }

  get breakdownRight() {
    return this.categoryBreakdown.filter((_, i) => i % 2 === 1);
  }
 
  buildCharts(
    categoryData: { _id: string, total: number }[],
    dailyData: { _id: string, total: number }[],
    monthlyDataRaw: { _id: { year: number, month: number }, total: number }[]
  ){
    const categories = categoryData.map(c => c._id);
    const amounts = categoryData.map(c => c.total);
    const colors = categories.map(cat => this.categoryColors[cat] || '#94a3b8');
    this.doughnutData = {
      labels: categories, datasets: [{
        data: amounts,
        backgroundColor: colors,
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverBorderColor: '#ffffff',
        hoverBorderWidth: 3,
        hoverOffset: 8
      }]
    }

    this.barData = {
      labels: dailyData.map(d => d._id),
      datasets: [{
        data: dailyData.map(d => d.total),
        backgroundColor: '#5B8FF9',
        hoverBackgroundColor: '#3B7BF7',
        borderRadius: 8,
        borderSkipped: false
      }]
    };

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    this.monthlyData = {
      labels: monthlyDataRaw.map(m => monthNames[m._id.month - 1] + ' ' + m._id.year),
      datasets: [{
        data: monthlyDataRaw.map(m => m.total),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.1)',
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.4,
        fill: true
      }]
    };
  }
                                                                     

  onChatExpenseAdded() {
    this.page = 1;
    this.fetchAllExpenses();
    this.fetchBudget();
  }
  
}
