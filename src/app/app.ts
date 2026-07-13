import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './shared/components/header';
import { StorageService } from './core/services/storage.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly storage = inject(StorageService);

  ngOnInit(): void {
    // StorageService se inicializa en su constructor (carga localStorage).
    // Aquí solo verificamos que tengamos datos cargados.
  }

  /** ¿Hay una sesión en progreso que se pueda retomar? */
  get hasSessionInProgress(): boolean {
    return this.storage.currentSession() !== null;
  }
}
