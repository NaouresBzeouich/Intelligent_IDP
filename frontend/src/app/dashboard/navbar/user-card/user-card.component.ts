import { Component, OnInit, Input, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule for ngClass

@Component({
  selector: 'app-user-card',
  templateUrl: './user-card.component.html',
  styleUrl: './user-card.component.css', 
  standalone: false
})
export class UserCardComponent implements OnInit {
  userName: string = "naoures";
  userInitials: string = '';
  avatarColor: string = '';
  showSettings: boolean = false;

  constructor(private elementRef: ElementRef) { }

  ngOnInit(): void {
    this.setAvatarDetails();
  }

  private setAvatarDetails(): void {
    this.userInitials = this.getInitials(this.userName);
    this.avatarColor = this.getRandomColor();
  }

  private getInitials(name: string): string {
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

  private getRandomColor(): string {
    // Generate a random HSL color for good contrast
    const hue = Math.floor(Math.random() * 360);
    return `hsl(${hue}, 70%, 50%)`;
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
}