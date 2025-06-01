import { Component, OnInit, Input, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule for ngClass
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-user-card',
  templateUrl: './user-card.component.html',
  styleUrl: './user-card.component.css', 
  standalone: false
})
export class UserCardComponent implements OnInit {
  showSettings: boolean = false;

  constructor(
    private elementRef: ElementRef,
    public userService: UserService
  ) { }

  ngOnInit(): void {}

  getInitials(name: string | null): string {
    if (!name) return '';
    const parts = name.split(' ');
    let initials = '';
    if (parts.length > 0) {
      initials += parts[0].charAt(0);
      if (parts.length > 1) {
        initials += parts[parts.length - 1].charAt(0);
      }
    }
    return initials.toUpperCase();
  }

  toggleSettings(): void {
    this.showSettings = !this.showSettings;
  }

  // HostListener to close the settings card when clicking outside
  @HostListener('document:click', ['$event'])
  onClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target) && this.showSettings) {
      this.showSettings = false;
    }
  }

  logout(): void {
    this.userService.logout();
    this.showSettings = false;
  }
}