import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Select } from 'primeng/select';
import { Message } from 'primeng/message';
import type { MediaAssetDto, MediaKind } from '../../../core/models/domain.models';
import { CoursesApiService } from '../../../core/http/courses-api.service';
import { mediaUploadErrorMessage } from '../../utils/media-upload-error.util';
import { inject } from '@angular/core';

@Component({
  selector: 'app-upload-dialog',
  standalone: true,
  imports: [FormsModule, Dialog, Button, Select, Message],
  template: `
    <p-dialog
      [header]="title()"
      [visible]="visible()"
      (visibleChange)="visibleChange.emit($event)"
      [modal]="true"
      [style]="{ width: 'min(520px, 94vw)' }"
    >
      <div class="stack">
        @if (error()) {
          <p-message severity="error" [text]="error()!" />
        }

        <label class="field">
          <span>Media type</span>
          <p-select
            [options]="kindOptions"
            [(ngModel)]="kind"
            optionLabel="label"
            optionValue="value"
            [disabled]="!!fixedKind()"
          />
        </label>

        <label class="dropzone" [class.active]="dragging()">
          <input type="file" [accept]="accept()" (change)="onFile($event)" />
          <div>
            <strong>Choose a file</strong>
            <p>{{ hint() }}</p>
            @if (fileName()) {
              <p class="file">{{ fileName() }}</p>
            }
          </div>
        </label>

        <div class="actions">
          <p-button
            label="Cancel"
            severity="secondary"
            [text]="true"
            (onClick)="visibleChange.emit(false)"
          />
          <p-button
            [label]="progressLabel()"
            [loading]="uploading()"
            [disabled]="!selectedFile || uploading()"
            (onClick)="upload()"
          />
        </div>
      </div>
    </p-dialog>
  `,
  styles: [
    `
      .stack {
        display: grid;
        gap: 1rem;
      }
      .field {
        display: grid;
        gap: 0.35rem;
      }
      .dropzone {
        position: relative;
        border: 1.5px dashed rgba(15, 76, 92, 0.28);
        border-radius: var(--ctp-radius);
        padding: var(--s4);
        background: rgba(15, 76, 92, 0.03);
        text-align: center;
        cursor: pointer;
      }
      .dropzone input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }
      .dropzone p {
        margin: 4px 0 0;
        color: var(--ctp-muted);
        font-size: var(--ctp-fs-small);
      }
      .file {
        color: var(--ctp-brand) !important;
        font-weight: 600;
      }
      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
    `,
  ],
})
export class UploadDialogComponent {
  private readonly api = inject(CoursesApiService);

  readonly visible = input(false);
  readonly title = input('Upload media');
  readonly fixedKind = input<MediaKind | null>(null);
  readonly visibleChange = output<boolean>();
  readonly uploaded = output<MediaAssetDto>();

  readonly uploading = signal(false);
  readonly uploadPercent = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly fileName = signal<string | null>(null);
  readonly dragging = signal(false);

  kind: MediaKind = 'DOCUMENT';
  selectedFile: File | null = null;

  readonly kindOptions = [
    { label: 'Thumbnail', value: 'THUMBNAIL' },
    { label: 'PDF Document', value: 'DOCUMENT' },
    { label: 'Video', value: 'VIDEO' },
  ];

  accept(): string {
    const kind = this.fixedKind() ?? this.kind;
    if (kind === 'THUMBNAIL') return 'image/png,image/jpeg,image/webp';
    if (kind === 'DOCUMENT') return 'application/pdf';
    return 'video/mp4,video/webm,video/quicktime';
  }

  hint(): string {
    const kind = this.fixedKind() ?? this.kind;
    if (kind === 'THUMBNAIL') return 'JPG, PNG, or WebP (max 5 MB)';
    if (kind === 'DOCUMENT') return 'PDF only (max 50 MB)';
    return 'MP4, WebM, or MOV (max 500 MB)';
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    this.fileName.set(this.selectedFile?.name ?? null);
  }

  progressLabel(): string {
    const pct = this.uploadPercent();
    if (this.uploading() && pct != null) return `Uploading ${pct}%`;
    return 'Upload';
  }

  upload(): void {
    if (!this.selectedFile) {
      return;
    }
    const kind = this.fixedKind() ?? this.kind;
    this.uploading.set(true);
    this.uploadPercent.set(0);
    this.error.set(null);
    this.api.uploadMedia(kind, this.selectedFile, (pct) => this.uploadPercent.set(pct)).subscribe({
      next: (media) => {
        this.uploading.set(false);
        this.uploadPercent.set(null);
        this.uploaded.emit(media);
        this.visibleChange.emit(false);
        this.selectedFile = null;
        this.fileName.set(null);
      },
      error: (err) => {
        this.uploading.set(false);
        this.uploadPercent.set(null);
        this.error.set(mediaUploadErrorMessage(kind, err));
      },
    });
  }
}
