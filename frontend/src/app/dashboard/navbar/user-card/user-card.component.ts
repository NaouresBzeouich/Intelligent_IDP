import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from 'src/app/services/user.service';
import { ThemeToggleComponent } from 'src/app/theme-toggle/theme-toggle.component';

@Component({
  selector: 'app-user-card',
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.css'],
  standalone: true,
  imports: [CommonModule, ThemeToggleComponent]
})
export class UserCardComponent {
  showSettings = false;

  constructor(public userService: UserService) {}

  toggleSettings() {
    this.showSettings = !this.showSettings;
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  logout() {
    this.userService.logout();
    this.showSettings = false;
  }
}