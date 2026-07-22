import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { configurePdfJsWorker } from './app/shared/utils/pdfjs-setup';

configurePdfJsWorker();

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
