import { Directive } from '@angular/core';

/**
 * Marker for documentation / future host bindings.
 * Prefer wrapping learning content with `<app-content-protection-layer>`.
 */
@Directive({
  selector: '[appContentProtection]',
  standalone: true,
})
export class ContentProtectionDirective {}
