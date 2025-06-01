import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
  default_branch: string;
}

export interface ReposResponse {
  repositories: GitHubRepo[];
  total: number;
}

@Injectable({
  providedIn: 'root'
})
export class GithubReposService {
  private readonly backendUrl = 'http://localhost:5000';

  constructor(private http: HttpClient) {}

  getUserRepos(params: { sort?: string; per_page?: number; visibility?: string } = {}): Observable<ReposResponse> {
    return this.http.get<ReposResponse>(`${this.backendUrl}/api/repos`, {
      params,
      withCredentials: true
    });
  }

  addNewProject(repo: GitHubRepo): Observable<any> {
    return this.http.post(`${this.backendUrl}/api/projects`, {
      repo_name: repo.name,
      repo_full_name: repo.full_name,
      repo_url: repo.html_url,
      default_branch: repo.default_branch,
    }, {
      withCredentials: true
    });
  }
} 