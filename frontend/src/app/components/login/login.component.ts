import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GitHubAuthService } from 'src/app/services/github-auth.service';
import { HttpClient } from '@angular/common/http';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  constructor(
    private github: GitHubAuthService, 
    public user: UserService, 
    private http: HttpClient
  ) {}

  async login() {
    if (this.user.isLoggedIn()) {
      // make button disabled
      return;
    }

    try {
      console.log('[LoginComponent] Starting GitHub login process...');
      const response = await this.github.startLogin();
      console.log('[LoginComponent] Login successful, refreshing user profile...');
      await this.user.refreshUserProfile();
    } catch (error) {
      console.error('[LoginComponent] Login failed:', error);
      // Handle login error (show message to user, etc.)
    }
  }
}
