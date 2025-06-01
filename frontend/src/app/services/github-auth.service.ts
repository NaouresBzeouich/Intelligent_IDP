import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface AuthTokens {
  oauth_token: string;
  installation_token: string;
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

  constructor(private http: HttpClient) {
    console.log('[GitHubAuthService] Initialized with redirect URI:', this.redirectUri);
  }

  private setCookie(name: string, value: string, expirationDays: number = 7) {
    const date = new Date();
    date.setTime(date.getTime() + (expirationDays * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/;Secure;SameSite=Strict`;
    console.log(`[GitHubAuthService] Cookie set: ${name} (expires: ${date.toUTCString()})`);
  }

  private getCookie(name: string): string | null {
    const cookieName = `${name}=`;
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.startsWith(cookieName)) {
        const value = cookie.substring(cookieName.length);
        console.log(`[GitHubAuthService] Retrieved cookie: ${name}`);
        return value;
      }
    }
    console.log(`[GitHubAuthService] Cookie not found: ${name}`);
    return null;
  }

  private deleteCookie(name: string) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    console.log(`[GitHubAuthService] Deleted cookie: ${name}`);
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

  async startLogin(): Promise<AuthTokens> {
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
          // console.log('[GitHubAuthService] Received message event data:', event.data);

          // Check if the popup is still open
          if (this.popup?.closed) {
            clearInterval(popupCheckInterval);
            clearTimeout(timeoutId);
            this.cleanup();
            reject(new Error('Authorization window was closed'));
            return;
          }

          // Validate that we have the required data
          if (!event.data || typeof event.data !== 'object') {
            // console.log('[GitHubAuthService] Ignored invalid message format');
            return;
          }

          const { code, installation_id } = event.data;
          if (!code || !installation_id) {
            // console.log('[GitHubAuthService] Ignored message missing required fields');
            return;
          }

          // Clear intervals and timeouts
          clearInterval(popupCheckInterval);
          clearTimeout(timeoutId);
          
          // Clean up
          this.cleanup();
          
          console.log('[GitHubAuthService] Received valid OAuth callback data:', {
            code:code,
            installation_id: installation_id
          });

          resolve({ code, installation_id });
        };

        window.addEventListener('message', this.messageListener);
      });

      console.log('[GitHubAuthService] Exchanging code for tokens with backend...');
      const tokens = await this.exchangeCodeForTokens(callbackData.code, callbackData.installation_id);
      console.log('[GitHubAuthService] Successfully received tokens from backend:', {
        oauth_token: tokens.oauth_token,
        installation_token: tokens.installation_token
      });
      
      console.log('[GitHubAuthService] Storing tokens in cookies...');
      this.setCookie('oauth_token', tokens.oauth_token);
      this.setCookie('installation_token', tokens.installation_token);
      
      return tokens;
    } catch (error) {
      this.cleanup();
      console.error('[GitHubAuthService] Error during login process:', error);
      throw error;
    }
  }

  private async exchangeCodeForTokens(code: string, installation_id: string): Promise<AuthTokens> {
    console.log('[GitHubAuthService] Making request to backend:', {
      url: `${this.backendUrl}/authorize`,
      params: { 
        code: code , 
        installation_id: installation_id 
      }
    });

    try {
      const response = await firstValueFrom(
        this.http.get<AuthTokens>(`${this.backendUrl}/authorize`, {
          params: { code, installation_id }
        })
      );

      console.log('[GitHubAuthService] Backend response received:', {
        oauth_token: response.oauth_token ,
        installation_token: response.installation_token 
      });

      return response;
    } catch (error) {
      console.error('[GitHubAuthService] Backend request failed:', error);
      throw error;
    }
  }

  getStoredTokens(): AuthTokens | { oauth_token: string | null; installation_token: string | null } {
    console.log('[GitHubAuthService] Retrieving stored tokens from cookies...');
    const tokens = {
      oauth_token: this.getCookie('oauth_token'),
      installation_token: this.getCookie('installation_token')
    };
    
    console.log('[GitHubAuthService] Retrieved tokens:', {
      oauth_token: tokens.oauth_token ,
      installation_token: tokens.installation_token 
    });
    
    return tokens;
  }

  clearTokens() {
    console.log('[GitHubAuthService] Clearing all stored tokens...');
    this.deleteCookie('oauth_token');
    this.deleteCookie('installation_token');
    console.log('[GitHubAuthService] All tokens cleared');
  }
}
