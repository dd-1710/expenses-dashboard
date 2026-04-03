import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { expensesService } from '../../services/expensesService';
import { Expense } from '../../interfaces/addExpense.model';
import { FaIconLibrary,FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faHandshake, faWallet, faChevronUp, faChevronDown, faTriangleExclamation, faCircleExclamation, faArrowTrendUp, faCoins, faSackDollar, faGauge, faReceipt, faChartPie, faRobot, faUtensils, faCartShopping, faCar, faFilm, faFileInvoice, faPen, faTrash, faFloppyDisk, faPlane, faHeartPulse, faShieldHalved, faGraduationCap, faEllipsis, faChartLine, faCircleCheck, faReceipt as faReceiptAlt, faPaperPlane, faUser } from '@fortawesome/free-solid-svg-icons';
import { AddExpense } from '../add-expense/add-expense';
import { BaseChartDirective } from 'ng2-charts';
import { ArcElement, BarController, BarElement, CategoryScale, Chart, ChartData, DoughnutController, Filler, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip } from 'chart.js';

Chart.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale, BarController, DoughnutController, LineController, LineElement, PointElement, Filler);

export interface ChatMsg{
  text: string,
  isUser: boolean
}
@Component({
  selector: 'app-user-content',
  imports: [FaIconComponent, CommonModule, FormsModule, AddExpense, BaseChartDirective],
  templateUrl: './user-content.html',
  styleUrl: './user-content.css',
  standalone:true,
})
export class UserContent {
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
   userText: string = '';
   messages:ChatMsg[] = []

  constructor(private expenseSer:expensesService, private sanitizer:DomSanitizer, library:FaIconLibrary){
   library.addIcons(faHandshake, faWallet, faChevronUp, faChevronDown, faTriangleExclamation, faCircleExclamation, faArrowTrendUp, faCoins, faSackDollar, faGauge, faReceipt, faChartPie, faRobot, faUtensils, faCartShopping, faCar, faFilm, faFileInvoice, faPen, faTrash, faFloppyDisk, faPlane, faHeartPulse, faShieldHalved, faGraduationCap, faEllipsis, faChartLine, faCircleCheck, faPaperPlane, faUser)
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
    this.expenseSer.getBudget().subscribe({
        next: res=>{
          this.budget = res.budget;
        },
        error: err=>{
          return err.error.message;
        }
      })

  }
  
  saveBudget(){
    this.expenseSer.updateBudget(this.budget).subscribe({
      next: res=>{
        this.budget = res.budget;
        this.totalCalculation();
        this.isEditingBudget = false
      },
      error: err=>{
        return err.error.message;
      }
    })
  }

   fetchAllExpenses(){
    console.log("called")
    this.expenseSer.getAllExpenses().subscribe({
      next: res=>{
        this.expenses = res;
        this.expenseSer.updateExpenseCount(res.length);
        console.log(this.expenses)
        this.totalCalculation()
      },
      error: err=>{
        return err.error.message;
      }
    })
  }

 editExpForm(exp:Expense){
  this.selectExp = exp;
  this.isEditingForm = true;
 }

 deleteExp(exp:Expense){
  this.expenseSer.deleteExpense(exp._id).subscribe({
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
    this.totalSpent = this.expenses.reduce((x, y) => x + y.amount, 0
    )
    this.remaining = this.budget - this.totalSpent;
    this.spentPercentage = this.budget > 0 ? (this.totalSpent/this.budget)*100 : 0;
    this.buildCharts()
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
    const map: Record<string, number> = {};
    this.expenses.forEach(exp => {
      map[exp.category] = (map[exp.category] || 0) + exp.amount;
    });
    return Object.keys(map).map(cat => ({
      category: cat,
      amount: map[cat],
      color: this.categoryColors[cat] || '#94a3b8',
      percent: this.totalSpent > 0 ? Math.round((map[cat] / this.totalSpent) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);
  }

  get breakdownLeft() {
    return this.categoryBreakdown.filter((_, i) => i % 2 === 0);
  }

  get breakdownRight() {
    return this.categoryBreakdown.filter((_, i) => i % 2 === 1);
  }
 
  buildCharts(){
    const categoryData: Record<string,number> = {};
    this.expenses.forEach((exp)=>{
      categoryData[exp.category] = (categoryData[exp.category] || 0) + exp.amount 
    })
    console.log(categoryData)
    const categories = Object.keys(categoryData);
    const amount = Object.values(categoryData);
    const colors = categories.map((color)=>
      this.categoryColors[color] || '#94a3b8'
    )
    console.log(categories,colors)
    this.doughnutData = {
      labels:categories , datasets: [{
        data:amount,
        backgroundColor:colors,
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverBorderColor: '#ffffff',
        hoverBorderWidth: 3,
        hoverOffset: 8
      }]
    }

  const dateData : Record<string,number> = {}
  this.expenses.forEach((expDate)=>{
    const label = expDate.date.split('T')[0]
    dateData[label] = (dateData[label] || 0 ) + expDate.amount
  })
   this.barData = {
   labels: Object.keys(dateData),
   datasets: [{
    data: Object.values(dateData),
    backgroundColor: '#5B8FF9',
    hoverBackgroundColor: '#3B7BF7',
    borderRadius: 8,
    borderSkipped: false
  }]
};

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthData: Record<string, number> = {};
  this.expenses.forEach((exp) => {
    const d = new Date(exp.date);
    const label = monthNames[d.getMonth()] + ' ' + d.getFullYear();
    monthData[label] = (monthData[label] || 0) + exp.amount;
  });
  this.monthlyData = {
    labels: Object.keys(monthData),
    datasets: [{
      data: Object.values(monthData),
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
                                                                     

  isLoading = false;

  useAIChat(userText:string){
    if(!userText.trim())return;
    this.messages.push({text:userText,isUser:true});
    this.userText = '';
    this.isLoading = true;
    this.expenseSer.aiChat(userText).subscribe({
      next: res=>{
        this.isLoading = false;
        this.messages.push({text:res.reply,isUser:false});        
      },
      error: err=>{
          this.isLoading = false;
          this.messages.push({text:'Something went wrong. Try again.', isUser: false })
      }
    })
  }

  formatBotReply(text: string): SafeHtml {
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^[\u2022\-\*]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/<\/ul>\s*<ul>/g, '')
      .replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
  
}
