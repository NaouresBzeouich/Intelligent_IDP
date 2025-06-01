import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { GitHubAuthService } from '../services/github-auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private authService: GitHubAuthService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getAuthToken();
    
    // Only add the token for requests to our backend
    if (request.url.startsWith('http://localhost:5000')) {
      request = request.clone({
        withCredentials: true,  // Enable credentials for backend requests
        setHeaders: token ? {
          Authorization: `Bearer ${token}`
        } : {}
      });
    }

    return next.handle(request);
  }
} 