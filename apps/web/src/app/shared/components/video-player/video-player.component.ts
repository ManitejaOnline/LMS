import {
  Component,
  ElementRef,
  HostListener,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FullscreenLearningToolbarComponent } from '../fullscreen-learning-toolbar/fullscreen-learning-toolbar.component';
import { ContentWatermarkComponent } from '../content-watermark/content-watermark.component';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [FullscreenLearningToolbarComponent, ContentWatermarkComponent],
  template: `
    <div class="video-shell" #shell [class.is-fullscreen]="isFullscreen()">
      <app-fullscreen-learning-toolbar
        #fsToolbar
        [active]="isFullscreen()"
        mode="video"
        [pageLabel]="learningPageLabel()"
        [timerLabel]="learningTimerLabel()"
        [paused]="learningPaused()"
        [complete]="learningComplete()"
        (exitFullscreen)="exitFullscreen()"
        (toggleFullscreen)="toggleFullscreen()"
      />
      <app-content-watermark tone="light" />

      <video
        #video
        controls
        playsinline
        controlslist="nodownload noremoteplayback"
        disablepictureinpicture
        [attr.controlsList]="'nodownload noremoteplayback'"
        [src]="src()"
        (play)="onPlay()"
        (pause)="onPause()"
        (seeking)="onSeek()"
        (ratechange)="onRate()"
        (timeupdate)="onTime()"
        (contextmenu)="$event.preventDefault()"
      ></video>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        min-height: 0;
      }
      .video-shell {
        height: 100%;
        display: grid;
        place-items: center;
        background: #0b181d;
        min-height: 0;
        position: relative;
      }
      .video-shell.is-fullscreen {
        background: #000;
      }
      video {
        width: min(100%, 1100px);
        max-height: 100%;
        background: #000;
      }
      .video-shell.is-fullscreen video {
        width: 100%;
        max-height: 100%;
        height: 100%;
        object-fit: contain;
      }
    `,
  ],
})
export class VideoPlayerComponent implements OnChanges, OnDestroy {
  readonly src = input.required<string>();
  readonly startAt = input(0);
  readonly learningPageLabel = input<string | null>(null);
  readonly learningTimerLabel = input('0%');
  readonly learningPaused = input(false);
  readonly learningComplete = input(false);

  readonly play = output<{ currentTime: number; playbackSpeed: number }>();
  readonly pause = output<{
    currentTime: number;
    watchPercentage: number;
    playbackSpeed: number;
  }>();
  readonly seek = output<{ currentTime: number; watchPercentage: number }>();
  readonly speed = output<{ playbackSpeed: number }>();
  readonly progress = output<{
    currentTime: number;
    watchPercentage: number;
    playbackSpeed: number;
  }>();
  readonly fullscreenChange = output<boolean>();

  readonly videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  readonly shell = viewChild.required<ElementRef<HTMLElement>>('shell');
  readonly fsToolbar =
    viewChild<FullscreenLearningToolbarComponent>('fsToolbar');

  readonly isFullscreen = signal(false);
  private lastEmit = 0;

  constructor() {
    effect(() => {
      if (this.isFullscreen()) {
        queueMicrotask(() => this.fsToolbar()?.onFullscreenEntered());
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src'] || changes['startAt']) {
      queueMicrotask(() => {
        const video = this.videoRef().nativeElement;
        if (this.startAt() > 0) {
          video.currentTime = this.startAt();
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.videoRef().nativeElement.pause();
    if (document.fullscreenElement === this.shell()?.nativeElement) {
      void document.exitFullscreen();
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    const shell = this.shell()?.nativeElement;
    const active = !!shell && document.fullscreenElement === shell;
    this.isFullscreen.set(active);
    this.fullscreenChange.emit(active);
    if (active) {
      queueMicrotask(() => this.fsToolbar()?.onFullscreenEntered());
    }
  }

  async toggleFullscreen(): Promise<void> {
    const el = this.shell().nativeElement;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await document.exitFullscreen();
        await el.requestFullscreen();
      }
    } catch {
      /* ignore */
    }
  }

  async exitFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
  }

  onPlay(): void {
    const video = this.videoRef().nativeElement;
    this.play.emit({
      currentTime: video.currentTime,
      playbackSpeed: video.playbackRate,
    });
  }

  onPause(): void {
    const video = this.videoRef().nativeElement;
    this.pause.emit({
      currentTime: video.currentTime,
      watchPercentage: this.pct(),
      playbackSpeed: video.playbackRate,
    });
  }

  onSeek(): void {
    const video = this.videoRef().nativeElement;
    this.seek.emit({
      currentTime: video.currentTime,
      watchPercentage: this.pct(),
    });
  }

  onRate(): void {
    this.speed.emit({
      playbackSpeed: this.videoRef().nativeElement.playbackRate,
    });
  }

  onTime(): void {
    const now = Date.now();
    if (now - this.lastEmit < 2000) return;
    this.lastEmit = now;
    const video = this.videoRef().nativeElement;
    this.progress.emit({
      currentTime: video.currentTime,
      watchPercentage: this.pct(),
      playbackSpeed: video.playbackRate,
    });
  }

  private pct(): number {
    const video = this.videoRef().nativeElement;
    if (!video.duration || !Number.isFinite(video.duration)) return 0;
    return Math.min(100, Math.round((video.currentTime / video.duration) * 100));
  }
}
