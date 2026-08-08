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

  readonly isHome = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url === '/'),
    ),
    { initialValue: true },
  );

  readonly title = computed(() => {
    const url = this.router.url;
    if (url === '/') return 'Gym Tracker';
    if (url.startsWith('/workout')) return 'Workout';
    if (url.startsWith('/routines/new')) return 'New routine';
    if (url.startsWith('/routines') && url.endsWith('/edit')) return 'Edit routine';
    if (url.startsWith('/routines')) return 'Routines';
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
