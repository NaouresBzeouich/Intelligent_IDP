import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectsService, Project } from '../../services/projects.service';
import { Subscription } from 'rxjs';
import { HighlightModule, HIGHLIGHT_OPTIONS } from 'ngx-highlightjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MarkdownModule, MarkdownService } from 'ngx-markdown';

interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-project-details',
  templateUrl: './project-details.component.html',
  styleUrls: ['./project-details.component.css'],
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    HighlightModule, 
    MarkdownModule
  ],
  providers: [
    MarkdownService,
    {
      provide: HIGHLIGHT_OPTIONS,
      useValue: {
        coreLibraryLoader: () => import('highlight.js/lib/core'),
        languages: {
          dockerfile: () => import('highlight.js/lib/languages/dockerfile')
        }
      }
    }
  ]
})
export class ProjectDetailsComponent implements OnInit, OnDestroy {
  project: Project | null = null;
  userInput: string = '';
  chatHistory: ChatMessage[] = [];
  private projectId: string | null = null;
  private subscriptions: Subscription[] = [];
  isLoading: boolean = false;

  techStacks: { name: string, dockerfile: string }[] = [
    { name: 'Node.js', dockerfile: `FROM node:18\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nCMD ["node", "index.js"]` },
    { name: 'Python', dockerfile: `FROM python:3.11\nWORKDIR /app\nCOPY requirements.txt ./\nRUN pip install -r requirements.txt\nCOPY . .\nCMD ["python", "app.py"]` },
    { name: 'Java', dockerfile: `FROM openjdk:17\nWORKDIR /app\nCOPY target/app.jar ./\nCMD ["java", "-jar", "app.jar"]` },
    { name: 'Go', dockerfile: `FROM golang:1.20\nWORKDIR /app\nCOPY . .\nRUN go build -o app\nCMD ["./app"]` },
    { name: 'PHP', dockerfile: `FROM php:8.2-apache\nCOPY src/ /var/www/html/\nEXPOSE 80` },
  ];
  selectedTech: { name: string, dockerfile: string };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectsService: ProjectsService,
    private http: HttpClient
  ) {
    this.selectedTech = { ...this.techStacks[0] };
  }

  ngOnInit() {
    // Subscribe to route params to get project ID
    this.subscriptions.push(
      this.route.params.subscribe(params => {
        this.projectId = params['id'];
        this.loadProjectDetails();
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private async loadProjectDetails() {
    if (!this.projectId) return;
    
    // Get project from current projects
    const projects = this.projectsService.getCurrentProjects();
    const foundProject = projects.find(p => p._id === this.projectId) || null;
    
    // Extract description from metadata if not available at root level
    if (foundProject && !foundProject.description && foundProject.metadata?.description) {
      foundProject.description = foundProject.metadata.description;
    }
    
    this.project = foundProject;
  }

  onTechChange(name: string) {
    const found = this.techStacks.find((t) => t.name === name) ?? this.techStacks[0];
    this.selectedTech = { ...found };
  }

  async sendMessage() {
    if (!this.userInput.trim() || !this.project) return;

    const userMessage: ChatMessage = {
      type: 'user',
      content: this.userInput,
      timestamp: new Date()
    };
    this.chatHistory.push(userMessage);

    this.isLoading = true;
    const params = new HttpParams()
      .set('message', this.userInput)
      .set('project_id', this.project._id)
      .set('repo_name', this.project.repo_name)
      .set('repo_full_name', this.project.repo_full_name);

    try {
      const result = await this.http.get<{response: string}>('http://localhost:5000/chat', { params }).toPromise();
      
      const assistantMessage: ChatMessage = {
        type: 'assistant',
        content: result?.response || 'No response received',
        timestamp: new Date()
      };
      this.chatHistory.push(assistantMessage);
      
      this.userInput = ''; // Clear input after successful send
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        type: 'assistant',
        content: 'Error: ' + (error.message || 'Failed to send message'),
        timestamp: new Date()
      };
      this.chatHistory.push(errorMessage);
    } finally {
      this.isLoading = false;
    }
  }

  async destroyProject() {
    if (!this.project || !confirm('Are you sure you want to destroy this project? This action cannot be undone.')) {
      return;
    }

    try {
      await this.projectsService.deleteProject(this.project._id);
      // Navigate back to home page after successful deletion
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error destroying project:', error);
      alert('Failed to destroy project. Please try again.');
    }
  }
} 