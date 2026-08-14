import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Location } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /**
   * The current URL as a signal. `router.url` is a plain property, so a computed
   * reading it directly has no reactive producer: it memoises on first read and
   * never updates. That froze the title on 'Gym Tracker' for the whole session.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly isHome = computed(() => this.url() === '/');

  readonly title = computed(() => {
    const url = this.url();
    if (url === '/') return 'Gym Tracker';
    if (url.startsWith('/workout')) return 'Workout';
    if (url.startsWith('/routines/new')) return 'New routine';
    if (url.startsWith('/routines') && url.endsWith('/edit')) return 'Edit routine';
    if (url.startsWith('/routines')) return 'Routines';
    if (url.startsWith('/exercises')) return 'Exercise Library';
    if (url.startsWith('/history') && url.split('/').length > 2) return 'Detail';
    if (url.startsWith('/history')) return 'History';
    if (url.startsWith('/analysis')) return 'Analysis';
    if (url.startsWith('/additional')) return 'Additional exercise';
    if (url.startsWith('/profile')) return 'Profile';
    return 'Gym Tracker';
  });

  goBack(): void {
    this.location.back();
  }
}
