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

const VebPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef3f9',
      100: '#d9e4f1',
      200: '#b3c9e3',
      300: '#7fa3cc',
      400: '#4f7db3',
      500: '#335f96',
      600: '#2a4f7d',
      700: '#224066',
      800: '#1b334f',
      900: '#15283d',
      950: '#0d1826',
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
        preset: VebPreset,
        options: {
          darkModeSelector: '.dark',
        },
      },
    }),
  ],
};
