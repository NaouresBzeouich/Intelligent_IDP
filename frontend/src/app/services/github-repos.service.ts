import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { GitHubAuthService } from './github-auth.service';
import { Observable } from 'rxjs';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
  default_branch: string;
}

@Injectable({
  providedIn: 'root'
})
export class GithubReposService {
  private readonly githubApiUrl = 'https://api.github.com';
  private readonly backendUrl = 'http://localhost:5000';

  constructor(
    private http: HttpClient,
    private authService: GitHubAuthService
  ) {}

  getUserRepos(): Observable<GitHubRepo[]> {
    const tokens = this.authService.getStoredTokens();
    if (!tokens.oauth_token) {
      throw new Error('No OAuth token available');
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${tokens.oauth_token}`,
      'Accept': 'application/vnd.github+json'
    });

    return this.http.get<GitHubRepo[]>(`${this.githubApiUrl}/user/repos`, { headers });
  }

  addNewProject(repo: GitHubRepo): Observable<any> {
    const tokens = this.authService.getStoredTokens();
    if (!tokens.oauth_token || !tokens.installation_token) {
      throw new Error('Required tokens not available');
    }

    return this.http.post(`${this.backendUrl}/api/projects`, {
      repo_name: repo.name,
      repo_full_name: repo.full_name,
      repo_url: repo.html_url,
      default_branch: repo.default_branch,
      installation_token: tokens.installation_token,
      oauth_token: tokens.oauth_token
    });
  }
} 