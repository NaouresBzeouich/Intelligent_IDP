import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { GitHubAuthService } from './github-auth.service';

interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
  id: number;
}

interface UserState {
  isLoggedIn: boolean;
  user: GitHubUser | null;
  loading: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly githubApiUrl = 'https://api.github.com';
  private userStateSubject = new BehaviorSubject<UserState>({
    isLoggedIn: false,
    user: null,
    loading: true
  });

  userState$ = this.userStateSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: GitHubAuthService
  ) {
    // Check auth state on service initialization
    this.checkAuthState();
  }

  private async checkAuthState() {
    console.log('[UserService] Checking authentication state...');
    
    if (this.authService.isAuthenticated()) {
      const user = this.authService.getCurrentUser();
      if (user) {
        console.log('[UserService] User is authenticated, updating state...');
        this.userStateSubject.next({
          isLoggedIn: true,
          user: user,
          loading: false
        });
      } else {
        console.log('[UserService] No user data found');
        this.setLoggedOut();
      }
    } else {
      console.log('[UserService] Not authenticated');
      this.setLoggedOut();
    }
  }

  private setLoggedOut() {
    console.log('[UserService] Setting logged out state');
    this.userStateSubject.next({
      isLoggedIn: false,
      user: null,
      loading: false
    });
  }

  async refreshUserProfile(): Promise<void> {
    console.log('[UserService] Refreshing user profile...');
    
    if (!this.authService.isAuthenticated()) {
      console.log('[UserService] Not authenticated for refresh');
      this.setLoggedOut();
      return;
    }

    const user = this.authService.getCurrentUser();
    if (user) {
      this.userStateSubject.next({
        isLoggedIn: true,
        user: user,
        loading: false
      });
    } else {
      this.setLoggedOut();
    }
  }

  logout() {
    console.log('[UserService] Logging out user...');
    this.authService.clearTokens();
    this.setLoggedOut();
  }

  isLoggedIn(): boolean {
    return this.userStateSubject.value.isLoggedIn;
  }

  getCurrentUser(): GitHubUser | null {
    return this.userStateSubject.value.user;
  }
} 