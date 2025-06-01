import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { GitHubAuthService } from './github-auth.service';

interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string;
  email: string;
  bio: string;
  id : number;
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
    const tokens = this.authService.getStoredTokens();

    if (tokens.oauth_token) {
      console.log('[UserService] Found OAuth token, fetching user profile...');
      try {
        await this.fetchAndUpdateUserProfile(tokens.oauth_token);
      } catch (error) {
        console.error('[UserService] Error fetching user profile:', error);
        this.setLoggedOut();
      }
    } else {
      console.log('[UserService] No OAuth token found');
      this.setLoggedOut();
    }
  }

  private async fetchAndUpdateUserProfile(oauthToken: string) {
    console.log('[UserService] Fetching GitHub user profile...');
    
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${oauthToken}`,
      'Accept': 'application/vnd.github+json'
    });

    try {
      const user = await this.http.get<GitHubUser>(`${this.githubApiUrl}/user`, { headers }).toPromise();
      
      if (!user) {
        throw new Error('No user data received');
      }

      console.log('[UserService] Successfully fetched user profile:', {
        login: user.login,
        name: user.name
      });

      this.userStateSubject.next({
        isLoggedIn: true,
        user: user,
        loading: false
      });
    } catch (error) {
      console.error('[UserService] Failed to fetch user profile:', error);
      throw error;
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
    const tokens = this.authService.getStoredTokens();
    
    if (!tokens.oauth_token) {
      console.log('[UserService] No OAuth token available for refresh');
      this.setLoggedOut();
      return;
    }

    try {
      await this.fetchAndUpdateUserProfile(tokens.oauth_token);
    } catch (error) {
      console.error('[UserService] Error refreshing user profile:', error);
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