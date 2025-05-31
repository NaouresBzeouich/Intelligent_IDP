import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private _darkMode = new BehaviorSubject<boolean>(this.getInitialThemePreference());
  public darkMode$: Observable<boolean> = this._darkMode.asObservable();

  private renderer: Renderer2;
  private readonly THEME_KEY = 'darkModePreference';

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.applyThemeOnLoad();
  }

  // Get initial theme preference from localStorage or system preference
  private getInitialThemePreference(): boolean {
    if (typeof localStorage !== 'undefined') { // Check if localStorage is available (for SSR compatibility)
      const storedPreference = localStorage.getItem(this.THEME_KEY);
      if (storedPreference !== null) {
        return storedPreference === 'dark';
      }
    }
    // Fallback to system preference if no stored preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  // Apply the theme immediately when the service is initialized
  private applyThemeOnLoad(): void {
    const isDarkMode = this._darkMode.value;
    this.updateBodyClass(isDarkMode);
  }

  // Toggles the theme
  toggleTheme(): void {
    const currentMode = this._darkMode.value;
    this._darkMode.next(!currentMode); // Toggle the value
    this.updateBodyClass(!currentMode); // Update the body class
    this.saveThemePreference(!currentMode); // Save to localStorage
  }

  // Update the class on the <body> element
  private updateBodyClass(isDark: boolean): void {
    if (isDark) {
      this.renderer.addClass(document.body, 'dark-mode');
      this.renderer.removeClass(document.body, 'light-mode');
    } else {
      this.renderer.addClass(document.body, 'light-mode');
      this.renderer.removeClass(document.body, 'dark-mode');
    }
  }

  // Save theme preference to localStorage
  private saveThemePreference(isDark: boolean): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.THEME_KEY, isDark ? 'dark' : 'light');
    }
  }
}