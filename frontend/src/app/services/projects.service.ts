import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { GitHubAuthService } from './github-auth.service';
import { GitHubRepo } from './github-repos.service';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface OnPremConfig {
  ipAddress: string;
  publicKey: string;
  username: string;
}

export type DeploymentPlan = 'aws' | 'azure' | 'on-prem';

interface BaseProjectConfig {
  stack: string;
  envs: Record<string, string>;
}

interface AwsProjectConfig extends BaseProjectConfig {
  deploymentPlan: 'aws';
  onPremConfig?: never;
}

interface AzureProjectConfig extends BaseProjectConfig {
  deploymentPlan: 'azure';
  onPremConfig?: never;
}

interface OnPremProjectConfig extends BaseProjectConfig {
  deploymentPlan: 'on-prem';
  onPremConfig: OnPremConfig;
}

export type ProjectConfig = AwsProjectConfig | AzureProjectConfig | OnPremProjectConfig;

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
  config?: ProjectConfig;
}

@Injectable({
  providedIn: 'root'
})
export class ProjectsService {
  private readonly backendUrl = environment.backendUrl;
  private projectsSubject = new BehaviorSubject<Project[]>([]);
  projects$ = this.projectsSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: GitHubAuthService
  ) {
    // Initial load
    this.loadProjects().subscribe({
      next: (projects) => {
        console.log('[ProjectsService] Initial projects loaded:', projects);
      },
      error: (error) => {
        console.error('[ProjectsService] Error loading initial projects:', error);
      }
    });
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  getCurrentProjects(): Project[] {
    return this.projectsSubject.value;
  }

  loadProjects(): Observable<Project[]> {
    console.log('[ProjectsService] Loading projects...');
    return this.http.get<any>(`${this.backendUrl}/api/projects/sidebar`, {
      headers: this.getHeaders(),
      withCredentials: true
    }).pipe(
      map(response => {
        const projects = response.projects || [];
        console.log('[ProjectsService] Projects loaded:', projects);
        this.projectsSubject.next(projects);
        return projects;
      })
    );
  }

/*   deleteProject(id: string): Observable<void> {
    return this.http.delete<void>(`${this.backendUrl}/api/projects/${id}`, {
      headers: this.getHeaders()
    }).pipe(
      map(() => {
        const currentProjects = this.projectsSubject.value;
        const updatedProjects = currentProjects.filter(p => p._id !== id);
        this.projectsSubject.next(updatedProjects);
      })
    );
  } */

  saveProjectConfig(projectId: string, config: ProjectConfig): Observable<Project> {
    return this.http.post<Project>(
      `${this.backendUrl}/api/projects/${projectId}/config`, 
      config,
      { headers: this.getHeaders() }
    ).pipe(
      map(updatedProject => {
        const currentProjects = this.projectsSubject.value;
        const updatedProjects = currentProjects.map(p => 
          p._id === projectId ? { ...p, config } : p
        );
        this.projectsSubject.next(updatedProjects);
        return updatedProject;
      })
    );
  }

  launchBuild(projectId: string): Observable<any> {
    return this.http.post<any>(
      `${this.backendUrl}/api/projects/${projectId}/launch`,
      {},
      { headers: this.getHeaders() }
    );
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

  async refreshProjects(): Promise<Project[]> {
    return await this.loadProjects().toPromise() ??[];
  }
} 