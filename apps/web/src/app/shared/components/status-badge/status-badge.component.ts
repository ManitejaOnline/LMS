import { Component, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="ctp-badge" [class]="badgeClass()">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();

  label(): string {
    return this.status().replaceAll('_', ' ');
  }

  badgeClass(): string {
    const value = this.status().toUpperCase();
    if (value === 'PUBLISHED' || value === 'COMPLETED' || value === 'ACTIVE') {
      return 'ctp-badge--success';
    }
    if (value === 'DRAFT' || value === 'NOT_STARTED' || value === 'INACTIVE') {
      return 'ctp-badge--neutral';
    }
    if (value === 'IN_PROGRESS' || value === 'LOCKED') {
      return 'ctp-badge--info';
    }
    if (value === 'ARCHIVED' || value === 'OVERDUE') {
      return value === 'OVERDUE' ? 'ctp-badge--danger' : 'ctp-badge--warning';
    }
    return 'ctp-badge--neutral';
  }
}
