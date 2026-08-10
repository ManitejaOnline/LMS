import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Message } from 'primeng/message';
import { ProgramsApiService } from '../../core/http/programs-api.service';
import type { ProgramCertificate } from '../../core/models/program.models';
import { LoadingStateComponent } from '../../shared/components/loading-state/loading-state.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-certificate-page',
  standalone: true,
  imports: [PageHeaderComponent, LoadingStateComponent, RouterLink, Button, Message, DatePipe],
  template: `
    <app-page-header title="Certificate" subtitle="Issued only after program completion." />
    <a routerLink="/app/my-learning" class="back">Back to My Learning</a>
    @if (error()) {
      <p-message severity="error" [text]="error()!" styleClass="w-full mb-3" />
    }
    @if (loading()) {
      <app-loading-state message="Loading certificate…" />
    } @else if (cert(); as c) {
      <article class="sheet">
        <p class="eyebrow">CERTIFICATE OF COMPLETION</p>
        <p>This certifies that</p>
        <h1>{{ c.employeeName }}</h1>
        <p>has successfully completed</p>
        <h2>{{ c.programName }}</h2>
        <p>Completed on {{ c.issuedAt | date: 'd MMMM y' }}</p>
        <p>{{ c.organizationName }}</p>
        <p class="code">Certificate ID: {{ c.certificateCode }}</p>
      </article>
      <p-button label="Download Certificate" icon="pi pi-download" (onClick)="download()" />
    }
  `,
  styles: [
    `
      .back { display: inline-block; margin-bottom: var(--s3); min-height: 44px; color: var(--ctp-primary); }
      .sheet {
        max-width: 720px;
        margin: 0 0 var(--s4);
        padding: 48px 32px;
        text-align: center;
        border: 10px solid #0f4c5c;
        background: #fff;
      }
      .eyebrow { letter-spacing: 0.18em; font-size: 12px; color: #0f4c5c; }
      h1, h2 { margin: 8px 0; }
      .code { margin-top: 24px; color: #64748b; font-family: ui-monospace, monospace; }
    `,
  ],
})
export class CertificatePageComponent implements OnInit {
  private readonly api = inject(ProgramsApiService);
  private readonly route = inject(ActivatedRoute);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly cert = signal<ProgramCertificate | null>(null);
  programId = '';

  ngOnInit(): void {
    this.programId = this.route.snapshot.paramMap.get('programId') ?? '';
    this.api.certificate(this.programId).subscribe({
      next: (cert) => {
        this.cert.set(cert);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error?.message ?? 'Certificate is available only after program completion.');
      },
    });
  }

  download(): void {
    this.api.certificateHtml(this.programId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.cert()?.certificateCode ?? 'certificate'}.html`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.error.set('Could not download certificate.'),
    });
  }
}
