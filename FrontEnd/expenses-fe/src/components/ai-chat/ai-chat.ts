import { Component, DestroyRef, EventEmitter, inject, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExpensesService } from '../../services/expensesService';
import { FaIconLibrary, FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faRobot, faPaperPlane, faUser, faTriangleExclamation, faClock, faChartLine, faLightbulb, faMobileScreen } from '@fortawesome/free-solid-svg-icons';

export interface ChatMsg {
  text: string;
  isUser: boolean;
}

@Component({
  selector: 'app-ai-chat',
  standalone: true,
  imports: [FaIconComponent, CommonModule, FormsModule],
  templateUrl: './ai-chat.html',
  styleUrls: ['./ai-chat.css']
})
export class AiChat {
  private destroyRef = inject(DestroyRef);

  @Input() budget: number = 0;
  @Input() totalSpent: number = 0;
  @Input() spentPercentage: number = 0;
  @Output() expenseAdded = new EventEmitter<void>();

  userText = '';
  messages: ChatMsg[] = [];
  isLoading = false;
  pendingDraftExpense: { amount: number; category: string | null; description?: string; date?: string | null } | null = null;
  error = '';
  success = '';

  constructor(
    private expenseSer: ExpensesService,
    private sanitizer: DomSanitizer,
    library: FaIconLibrary
  ) {
    library.addIcons(faRobot, faPaperPlane, faUser, faTriangleExclamation, faClock, faChartLine, faLightbulb, faMobileScreen);
  }

  get smartSuggestions(): { label: string; icon: string; message: string }[] {
    const suggestions: { label: string; icon: string; message: string }[] = [];

    if (this.spentPercentage >= 80) {
      suggestions.push({ label: 'Am I overspending?', icon: 'triangle-exclamation', message: 'Am I overspending? How can I stay within budget?' });
    }

    if (this.totalSpent > 0) {
      suggestions.push({ label: 'How much can I spend today?', icon: 'clock', message: 'How much can I spend per day to stay within budget?' });
      suggestions.push({ label: 'Will my budget last?', icon: 'chart-line', message: 'At my current spending rate, when will I run out of budget?' });
      suggestions.push({ label: 'Tips to save money', icon: 'lightbulb', message: 'Give me personalized tips to reduce my spending' });
    }

    if (suggestions.length < 4) {
      suggestions.push({ label: 'Paste UPI/SMS to add', icon: 'mobile-screen', message: 'How do I add expenses from UPI or bank SMS?' });
    }

    if (suggestions.length === 0) {
      suggestions.push({ label: 'What can you do?', icon: 'robot', message: 'What can you do?' });
      suggestions.push({ label: 'Paste a UPI message', icon: 'mobile-screen', message: 'How do I add expenses from UPI or bank SMS?' });
    }

    return suggestions.slice(0, 4);
  }

  useAIChat(userText: string) {
    if (!userText.trim()) return;

    if (this.budget === 0 || this.budget === undefined) {
      this.error = '⚠️  Budget not set! Please set your monthly budget before adding expenses via chat.';
      setTimeout(() => { this.error = ''; }, 4000);
      return;
    }

    this.messages.push({ text: userText, isUser: true });
    this.userText = '';
    this.isLoading = true;

    const draft = this.pendingDraftExpense;
    this.pendingDraftExpense = null;

    this.expenseSer.aiChat(userText, draft ?? undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.messages.push({ text: res.reply, isUser: false });

        if ((res.needsDate || res.needsCategory) && res.draftExpense) {
          this.pendingDraftExpense = res.draftExpense;
        }

        if (res.expenseAdded && res.expenses && res.expenses.length > 0) {
          this.expenseAdded.emit();
          const total = res.expenses.reduce((s, e) => s + e.amount, 0);
          const categories = res.expenses.map(e => e.category).join(', ');
          this.success = `✓ ${res.expenses.length} expense(s) added: ₹${total} (${categories})`;
          setTimeout(() => { this.success = ''; }, 4000);
        }
      },
      error: () => {
        this.isLoading = false;
        this.messages.push({ text: 'Something went wrong. Try again.', isUser: false });
      }
    });
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
