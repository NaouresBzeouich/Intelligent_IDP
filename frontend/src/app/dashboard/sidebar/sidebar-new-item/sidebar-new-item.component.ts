import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RepoSelectorComponent } from '../../../components/repo-selector/repo-selector.component';
import { GithubReposService, GitHubRepo } from '../../../services/github-repos.service';
import { UserService } from '../../../services/user.service';
import { ProjectsService } from '../../../services/projects.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
    selector: 'app-sidebar-new-item',
    templateUrl: './sidebar-new-item.component.html',
    styleUrls: ['./sidebar-new-item.component.css'],
    standalone: true,
    imports: [CommonModule, RepoSelectorComponent]
})
export class SidebarNewItemComponent {
  showRepoSelector = false;
  isCreatingProject = false;
  error: string | null = null;

  constructor(
    private githubReposService: GithubReposService,
    private projectsService: ProjectsService,
    public userService: UserService
  ) {}

  onCreateNewChat(): void {
    if (!this.userService.isLoggedIn()) {
      this.error = 'Please login first';
      return;
    }
    this.showRepoSelector = true;
  }

  async onRepoSelected(repo: GitHubRepo): Promise<void> {
    this.isCreatingProject = true;
    this.error = null;

    try {
      console.log('[SidebarNewItem] Adding new project:', repo.name);
      await this.projectsService.addProject(repo);
      this.showRepoSelector = false;
    } catch (err: unknown) {
      console.error('[SidebarNewItem] Error creating project:', err);
      if (err instanceof HttpErrorResponse && err.status === 409) {
        this.error = 'This repository has already been added';
      } else {
        this.error = 'Failed to create project. Please try again.';
      }
    } finally {
      this.isCreatingProject = false;
    }
  }

  onRepoSelectorClose(): void {
    this.showRepoSelector = false;
    this.error = null;
  }
}
