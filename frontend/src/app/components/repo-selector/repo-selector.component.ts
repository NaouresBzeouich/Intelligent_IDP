import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GitHubReposService, GitHubRepo } from '../../services/github-repos.service';

@Component({
  selector: 'app-repo-selector',
  templateUrl: './repo-selector.component.html',
  styleUrls: ['./repo-selector.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class RepoSelectorComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() repoSelected = new EventEmitter<GitHubRepo>();
  
  repos: GitHubRepo[] = [];
  loading = false;
  error: string | null = null;

  constructor(private githubReposService: GitHubReposService) {}

  ngOnInit(): void {
    this.fetchRepos();
  }

  private async fetchRepos(): Promise<void> {
    this.loading = true;
    this.error = null;

    try {
      const response = await this.githubReposService.getUserRepos().toPromise();
      this.repos = response?.repositories || [];
    } catch (err) {
      this.error = 'Failed to fetch repositories. Please try again.';
      console.error('Error fetching repos:', err);
    } finally {
      this.loading = false;
    }
  }

  onRepoSelect(repo: GitHubRepo): void {
    this.repoSelected.emit(repo);
  }

  onClose(): void {
    this.close.emit();
  }
} 