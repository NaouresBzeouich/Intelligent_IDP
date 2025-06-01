import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProjectsService, Project } from '../../../services/projects.service';
import { UserService } from '../../../services/user.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'sidebar-items',
  templateUrl: './sidebar-items.component.html',
  styleUrls: ['./sidebar-items.component.css'],
  standalone: true,
  imports: [CommonModule, RouterModule]
})
export class SidebarItemsComponent implements OnInit, OnDestroy {
  projects: Project[] = [];
  private subscriptions: Subscription[] = [];
  isLoading = false;

  constructor(
    public projectsService: ProjectsService,
    public userService: UserService
  ) {}

  ngOnInit() {
    console.log('[SidebarItems] Initializing component');
    
    // Subscribe to user state changes
    this.subscriptions.push(
      this.userService.userState$.subscribe(state => {
        console.log('[SidebarItems] User state changed:', state);
        if (state.isLoggedIn) {
          this.loadProjects();
        } else {
          this.projects = [];
        }
      })
    );

    // Subscribe to projects updates
    this.subscriptions.push(
      this.projectsService.projects$.subscribe(projects => {
        console.log('[SidebarItems] Projects updated:', projects);
        this.projects = projects;
        this.isLoading = false;
      })
    );

    // Initial load if user is already logged in
    if (this.userService.isLoggedIn()) {
      this.loadProjects();
    }
  }

  ngOnDestroy() {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private async loadProjects() {
    console.log('[SidebarItems] Loading projects...');
    this.isLoading = true;
    try {
      await this.projectsService.loadProjects().toPromise();
    } catch (error) {
      console.error('[SidebarItems] Error loading projects:', error);
      this.isLoading = false;
    }
  }
}
