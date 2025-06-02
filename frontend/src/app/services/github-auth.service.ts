import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface AuthResponse {
  token: string;
  user: {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
  };
}

interface OAuthCallbackData {
  code: string;
  installation_id: string;
}

@Injectable({ providedIn: 'root' })
export class GitHubAuthService {
  private readonly backendUrl = 'http://localhost:5000';
  clientId = 'YOUR_CLIENT_ID';
  redirectUri = 'https://tidy-definitely-sailfish.ngrok-free.app/authorize';
  state = crypto.randomUUID();
  private popup: Window | null = null;
  private messageListener: ((event: MessageEvent) => void) | null = null;
  private currentUser: AuthResponse['user'] | null = null;
  private authToken: string | null = null;

  constructor(private http: HttpClient) {
    console.log('[GitHubAuthService] Initialized with redirect URI:', this.redirectUri);
    // Try to get the token and user info from storage on initialization
    this.authToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      this.currentUser = JSON.parse(storedUser);
    }
  }

  private cleanup() {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
      console.log('[GitHubAuthService] Removed message listener');
    }
    if (this.popup && !this.popup.closed) {
      this.popup.close();
      this.popup = null;
      console.log('[GitHubAuthService] Closed popup window');
    }
  }

  async startLogin(): Promise<AuthResponse> {
    // Clean up any existing login attempt
    this.cleanup();

    console.log('[GitHubAuthService] Starting GitHub login process...');
    console.log('[GitHubAuthService] Generated state:', this.state);
    
    const url = `https://github.com/apps/idp-x/installations/new?redirect_uri=${encodeURI(this.redirectUri)}&state=${this.state}`;
    console.log('[GitHubAuthService] Opening GitHub OAuth popup with URL:', url);

    this.popup = window.open(url, '_blank', 'width=600,height=700');
    if (!this.popup) {
      console.error('[GitHubAuthService] Failed to open popup window - it may have been blocked by the browser');
      throw new Error('Popup window was blocked');
    }

    try {
      const callbackData = await new Promise<OAuthCallbackData>((resolve, reject) => {
        console.log('[GitHubAuthService] Setting up message listener for OAuth callback...');
        
        // Set a timeout to reject if no response is received
        const timeoutId = setTimeout(() => {
          this.cleanup();
          reject(new Error('Authorization timed out after 5 minutes'));
        }, 5 * 60 * 1000);

        // Check if popup is closed every second
        const popupCheckInterval = setInterval(() => {
          if (this.popup?.closed) {
            clearInterval(popupCheckInterval);
            clearTimeout(timeoutId);
            this.cleanup();
            reject(new Error('Authorization window was closed'));
          }
        }, 1000);

        this.messageListener = (event: MessageEvent) => {
          if (this.popup?.closed) {
            clearInterval(popupCheckInterval);
            clearTimeout(timeoutId);
            this.cleanup();
            reject(new Error('Authorization window was closed'));
            return;
          }

          if (!event.data || typeof event.data !== 'object') {
            return;
          }

          const { code, installation_id } = event.data;
          if (!code || !installation_id) {
            return;
          }

          clearInterval(popupCheckInterval);
          clearTimeout(timeoutId);
          this.cleanup();
          
          console.log('[GitHubAuthService] Received valid OAuth callback data:', {
            code: code,
            installation_id: installation_id
          });

          resolve({ code, installation_id });
        };

        window.addEventListener('message', this.messageListener);
      });

      console.log('[GitHubAuthService] Exchanging code for auth response with backend...');
      const authResponse = await this.exchangeCodeForTokens(callbackData.code, callbackData.installation_id);
      console.log('[GitHubAuthService] Successfully received auth response from backend');
      
      // Store the token and user information
      this.authToken = authResponse.token;
      this.currentUser = authResponse.user;
      
      // Store in localStorage for persistence
      localStorage.setItem('auth_token', authResponse.token);
      localStorage.setItem('user', JSON.stringify(authResponse.user));
      
      return authResponse;
    } catch (error) {
      this.cleanup();
      console.error('[GitHubAuthService] Error during login process:', error);
      throw error;
    }
  }

  private async exchangeCodeForTokens(code: string, installation_id: string): Promise<AuthResponse> {
    console.log('[GitHubAuthService] Making request to backend:', {
      url: `${this.backendUrl}/api/authorize`,
      params: { code, installation_id }
    });

    try {
      const response = await firstValueFrom(
        this.http.get<AuthResponse>(`${this.backendUrl}/api/authorize`, {
          params: { code, installation_id },
          withCredentials: true  // Enable sending and receiving cookies
        })
      );

      console.log('[GitHubAuthService] Backend response received with JWT and user info');
      return response;
    } catch (error) {
      console.error('[GitHubAuthService] Backend request failed:', error);
      throw error;
    }
  }

  getCurrentUser(): AuthResponse['user'] | null {
    return this.currentUser;
  }

  getAuthToken(): string | null {
    return this.authToken;
  }

  clearTokens() {
    this.authToken = null;
    this.currentUser = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    // Clear the auth cookie
    document.cookie = 'Authorization=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;';
  }

  isAuthenticated(): boolean {
    return !!this.authToken && !!this.currentUser;
  }

  async refreshUserProfile(): Promise<void> {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await firstValueFrom(
        this.http.get<{ user: AuthResponse['user'] }>(`${this.backendUrl}/api/user/profile`, {
          withCredentials: true  // Enable sending and receiving cookies
        })
      );
      
      this.currentUser = response.user;
      localStorage.setItem('user', JSON.stringify(response.user));
    } catch (error) {
      console.error('[GitHubAuthService] Failed to refresh user profile:', error);
      throw error;
    }
  }
}
