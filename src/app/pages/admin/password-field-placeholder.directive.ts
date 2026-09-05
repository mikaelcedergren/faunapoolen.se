import { AfterViewInit, Directive, ElementRef, Input, Renderer2, inject } from '@angular/core';

/**
 * Adds native placeholder support to the current cx-password-field release.
 * Remove this adapter once the framework exposes a placeholder input directly.
 */
@Directive({
  selector: 'cx-password-field[fpPasswordPlaceholder]',
})
export class PasswordFieldPlaceholderDirective implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  @Input() fpPasswordPlaceholder = '';

  public ngAfterViewInit(): void {
    const input = this.host.nativeElement.querySelector('input');
    const placeholder = this.fpPasswordPlaceholder.trim();

    if (input && placeholder) {
      this.renderer.setAttribute(input, 'placeholder', placeholder);
    }
  }
}
