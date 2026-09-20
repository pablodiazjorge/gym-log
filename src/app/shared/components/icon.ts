import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICON_PATHS, IconName } from './icon-paths';

/**
 * The app's single icon system — replaces the per-template inline SVGs and
 * the category emojis. Size and color come from the host's utility classes
 * (`class="w-5 h-5 text-ink-3"`): the svg fills the host and inherits
 * currentColor, exactly like the old inline markup did.
 */
@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', style: 'display: inline-flex' },
  template: `<svg
    viewBox="0 0 24 24"
    width="100%"
    height="100%"
    fill="none"
    stroke="currentColor"
    [attr.stroke-width]="strokeWidth()"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path [attr.d]="d()" />
  </svg>`,
})
export class Icon {
  readonly name = input.required<IconName>();
  /** Coach default is a light 1.75; checks/x at tiny sizes read better at 2.25+ */
  readonly strokeWidth = input(1.75);

  protected readonly d = computed(() => ICON_PATHS[this.name()]);
}
