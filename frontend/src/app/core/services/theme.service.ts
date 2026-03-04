import { Injectable, signal, effect } from '@angular/core';

const STORAGE_KEY = 'happ-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly isDark = signal<boolean>(this.loadSavedTheme());

  constructor() {
    // Apply theme on every change and persist to localStorage
    effect(() => {
      const dark = this.isDark();
      document.body.classList.toggle('dark', dark);
      localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.isDark.update(v => !v);
  }

  private loadSavedTheme(): boolean {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return saved === 'dark';
    // Respect system preference if no saved choice
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
