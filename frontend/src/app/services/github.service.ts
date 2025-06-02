import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

interface ReposResponse {
  repositories: any[];
  total: number;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  default_branch: string;
  // Add other properties as needed
}

@Injectable({
  providedIn: 'root'
})
export class GitHubService {
  private readonly backendUrl = environment.backendUrl;

  constructor(private http: HttpClient) {}

  // Get user's repositories
  getUserRepos(params: { sort?: string; per_page?: number; visibility?: string } = {}): Observable<ReposResponse> {
    return this.http.get<ReposResponse>(`${this.backendUrl}/api/repos`, {
      params,
      withCredentials: true
    });
  }

  // Get a single repository
  getRepo(owner: string, repo: string): Observable<Repository> {
    return this.http.get<Repository>(`${this.backendUrl}/api/repos/${owner}/${repo}`, {
      withCredentials: true
    });
  }

  // Branches
  getBranches(owner: string, repo: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.backendUrl}/api/repos/${owner}/${repo}/branches`, {
      withCredentials: true
    });
  }

  // Contents
  getContent(owner: string, repo: string, path: string, ref?: string): Observable<any> {
    const params = new HttpParams().set('ref', ref || '');
    return this.http.get<any>(`${this.backendUrl}/api/repos/${owner}/${repo}/contents/${path}`, {
      params: ref ? params : undefined,
      withCredentials: true
    });
  }

  // Commits
  getCommits(owner: string, repo: string, params: any = {}): Observable<any[]> {
    return this.http.get<any[]>(`${this.backendUrl}/api/repos/${owner}/${repo}/commits`, {
      params,
      withCredentials: true
    });
  }

  // Pull Requests
  getPullRequests(owner: string, repo: string, params: any = {}): Observable<any[]> {
    return this.http.get<any[]>(`${this.backendUrl}/api/repos/${owner}/${repo}/pulls`, {
      params,
      withCredentials: true
    });
  }

  createPullRequest(owner: string, repo: string, data: any): Observable<any> {
    return this.http.post<any>(`${this.backendUrl}/api/repos/${owner}/${repo}/pulls`, data, {
      withCredentials: true
    });
  }

  // Issues
  getIssues(owner: string, repo: string, params: any = {}): Observable<any[]> {
    return this.http.get<any[]>(`${this.backendUrl}/api/repos/${owner}/${repo}/issues`, {
      params,
      withCredentials: true
    });
  }

  createIssue(owner: string, repo: string, data: any): Observable<any> {
    return this.http.post<any>(`${this.backendUrl}/api/repos/${owner}/${repo}/issues`, data, {
      withCredentials: true
    });
  }

  // Collaborators
  getCollaborators(owner: string, repo: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.backendUrl}/api/repos/${owner}/${repo}/collaborators`, {
      withCredentials: true
    });
  }

  // Generic request method for other GitHub API endpoints
  request(method: string, path: string, data?: any, params?: any): Observable<any> {
    return this.http.request(method, `${this.backendUrl}/api/github/${path}`, {
      body: data,
      params,
      withCredentials: true
    });
  }
} 