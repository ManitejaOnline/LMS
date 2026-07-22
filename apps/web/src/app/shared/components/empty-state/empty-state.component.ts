import { Component, input } from '@angular/core';
import { Message } from 'primeng/message';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [Message],
  template: `
    <p-message
      severity="info"
      [text]="message()"
      styleClass="w-full"
    />
  `,
})
export class EmptyStateComponent {
  readonly message = input('Nothing to display yet.');
}
