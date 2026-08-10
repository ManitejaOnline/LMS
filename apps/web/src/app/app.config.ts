import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

const ZeblPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f4f2fb',
      100: '#e8e4f6',
      200: '#d1c9ed',
      300: '#b3a6e0',
      400: '#8b7ac9',
      500: '#6b5bb3',
      600: '#51459e',
      700: '#433884',
      800: '#362d6b',
      900: '#2c2656',
      950: '#1a1733',
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: ZeblPreset,
        options: {
          darkModeSelector: '.dark',
        },
      },
    }),
  ],
};
