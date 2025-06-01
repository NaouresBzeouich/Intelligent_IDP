import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { GitHubAuthService } from './github-auth.service';
import { GitHubRepo } from './github-repos.service';

export interface Project {
  _id: string;
  repo_name: string;
  repo_full_name: string;
  repo_url: string;
  description?: string;
  created_at: string;
  updated_at: string;
  metadata?: {
    description?: string;
    [key: string]: any;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ProjectsService {
  private readonly backendUrl = 'http://localhost:5000';
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  projects$ = this.projectsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: GitHubAuthService
  ) {
    this.loadProjects();
  }

  private getHeaders(): HttpHeaders {
    // The JWT token is automatically included in cookies, but we still need the Accept header
    return new HttpHeaders({
      'Accept': 'application/json'
    });
  }

  async loadProjects(): Promise<void> {
    try {
      if (!this.authService.isAuthenticated()) {
        console.log('[ProjectsService] Not authenticated, skipping project load');
        this.projectsSubject.next([]);
        return;
      }

      console.log('[ProjectsService] Fetching projects from backend...');
      const response = await this.http.get<{ projects: Project[] }>(
        `${this.backendUrl}/api/projects/sidebar`,
        { headers: this.getHeaders() }
      ).toPromise();

      console.log('[ProjectsService] Received projects:', response?.projects);
      this.projectsSubject.next(response?.projects || []);
    } catch (error) {
      console.error('[ProjectsService] Error loading projects:', error);
      this.projectsSubject.next([]);
    }
  }

  async addProject(repo: GitHubRepo): Promise<void> {
    try {
      if (!this.authService.isAuthenticated()) {
        throw new Error('Not authenticated');
      }

      console.log('[ProjectsService] Adding new project:', repo.name);
      
      await this.http.post(`${this.backendUrl}/api/projects`, {
        repo_name: repo.name,
        repo_full_name: repo.full_name,
        repo_url: repo.html_url,
        default_branch: repo.default_branch
      }, { headers: this.getHeaders() }).toPromise();

      // Refresh the projects list
      await this.loadProjects();
    } catch (error) {
      console.error('[ProjectsService] Error adding project:', error);
      throw error;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      if (!this.authService.isAuthenticated()) {
        throw new Error('Not authenticated');
      }

      console.log('[ProjectsService] Deleting project:', projectId);
      
      await this.http.delete(`${this.backendUrl}/api/projects/${projectId}`, {
        headers: this.getHeaders()
      }).toPromise();

      // Refresh the projects list after deletion
      await this.loadProjects();
    } catch (error) {
      console.error('[ProjectsService] Error deleting project:', error);
      throw error;
    }
  }

  getCurrentProjects(): Project[] {
    return this.projectsSubject.value;
  }

  refreshProjects(): Promise<void> {
    return this.loadProjects();
  }
} 