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
import { clampVideoStartAt, videoWatchPercentage } from '../../utils/video-resume.util';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [FullscreenLearningToolbarComponent],
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

      <div class="video-stage">
        <video
          #video
          controls
          playsinline
          preload="metadata"
          controlslist="nodownload noremoteplayback"
          disablepictureinpicture
          [attr.controlsList]="'nodownload noremoteplayback'"
          [src]="src()"
          (loadedmetadata)="onLoadedMetadata()"
          (error)="onError()"
          (play)="onPlay()"
          (pause)="onPause()"
          (ended)="onEnded()"
          (seeking)="onSeek()"
          (ratechange)="onRate()"
          (timeupdate)="onTime()"
          (contextmenu)="$event.preventDefault()"
        ></video>
        @if (loadError()) {
          <p class="video-error">This video could not be loaded. Refresh the page and try again.</p>
        }
        <div class="video-watermark" aria-hidden="true">Zebl India</div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        min-height: 0;
      }
      .video-shell {
        flex: 1;
        width: 100%;
        height: 100%;
        min-height: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #0b181d;
        position: relative;
        overflow: hidden;
      }
      .video-shell.is-fullscreen {
        background: #000;
      }
      .video-stage {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      video {
        display: block;
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        object-position: center center;
        background: #000;
      }
      .video-error {
        position: absolute;
        left: 16px;
        right: 16px;
        bottom: 56px;
        z-index: 3;
        margin: 0;
        padding: 8px 12px;
        border-radius: 8px;
        background: color-mix(in srgb, #7f1d1d 88%, transparent);
        color: #fff;
        font-size: 13px;
        text-align: center;
        pointer-events: none;
      }
      .video-watermark {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) rotate(-20deg);
        pointer-events: none;
        user-select: none;
        -webkit-user-select: none;
        z-index: 2;
        color: #ffffff;
        opacity: 0.22;
        font-size: clamp(16px, 2.6vw, 22px);
        font-weight: 500;
        letter-spacing: 0.02em;
        white-space: nowrap;
        line-height: 1.2;
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
  readonly loadError = signal(false);
  private lastEmit = 0;
  private resumeApplied = false;

  constructor() {
    effect(() => {
      if (this.isFullscreen()) {
        queueMicrotask(() => this.fsToolbar()?.onFullscreenEntered());
      }
    });
    effect(() => {
      if (!this.learningPaused()) return;
      queueMicrotask(() => {
        try {
          this.videoRef().nativeElement.pause();
        } catch {
          /* view not ready */
        }
      });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src']) {
      this.resumeApplied = false;
      this.loadError.set(false);
    }
  }

  onLoadedMetadata(): void {
    this.applyResume();
  }

  onError(): void {
    this.loadError.set(true);
  }

  private applyResume(): void {
    if (this.resumeApplied) return;
    const video = this.videoRef().nativeElement;
    const start = clampVideoStartAt(this.startAt(), video.duration);
    this.resumeApplied = true;
    if (start > 0) {
      try {
        video.currentTime = start;
      } catch {
        /* some browsers reject seek until canplay */
      }
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
    const percent = this.pct();
    const now = Date.now();
    if (percent < 100 && now - this.lastEmit < 2000) return;
    this.lastEmit = now;
    this.emitProgress();
  }

  onEnded(): void {
    this.lastEmit = Date.now();
    this.emitProgress(true);
  }

  private emitProgress(ended = false): void {
    const video = this.videoRef().nativeElement;
    this.progress.emit({
      currentTime: ended && Number.isFinite(video.duration) ? video.duration : video.currentTime,
      watchPercentage: this.pct(ended),
      playbackSpeed: video.playbackRate,
    });
  }

  private pct(ended = false): number {
    const video = this.videoRef().nativeElement;
    return videoWatchPercentage({
      currentTime: video.currentTime,
      duration: video.duration,
      ended: ended || video.ended,
    });
  }
}
