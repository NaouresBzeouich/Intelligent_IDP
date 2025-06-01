import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectsService, Project } from '../../services/projects.service';
import { StacksService, Stack } from '../../services/stacks.service';
import { Subscription, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { HighlightModule, HIGHLIGHT_OPTIONS } from 'ngx-highlightjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MarkdownModule, MarkdownService } from 'ngx-markdown';

interface ChatMessage {
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type DeploymentPlan = 'azure' | 'aws' | 'on-prem';

interface DeploymentConfig {
  stack: string;
  envs: Record<string, string>;
  deploymentPlan: DeploymentPlan;
  onPremConfig?: {
    ipAddress: string;
    publicKey: string;
    username: string;
  };
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

  techStacks: Stack[] = [];
  selectedTech: Stack;
  envVars: Record<string, string> = {};
  private envVarsUpdate = new Subject<Record<string, string>>();

  // New properties for deployment configuration
  deploymentConfig: DeploymentConfig = {
    stack: '',
    envs: {},
    deploymentPlan: 'aws'
  };
  deploymentPlans: { value: DeploymentPlan; label: string }[] = [
    { value: 'aws', label: 'AWS' },
    { value: 'azure', label: 'Azure' },
    { value: 'on-prem', label: 'On-Premises' }
  ];
  isDeploymentValid = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private projectsService: ProjectsService,
    private stacksService: StacksService,
    private http: HttpClient
  ) {
    this.selectedTech = { name: '', content: '', file_path: '' };
  }

  ngOnInit() {
    // Subscribe to route params to get project ID
    this.subscriptions.push(
      this.route.params.subscribe(params => {
        this.projectId = params['id'];
        this.loadProjectDetails();
      })
    );

    // Load tech stacks
    this.subscriptions.push(
      this.stacksService.getStacks().subscribe({
        next: (stacks) => {
          this.techStacks = stacks;
          if (stacks.length > 0) {
            this.selectedTech = { ...stacks[0] };
          }
        },
        error: (error) => {
          console.error('Error loading tech stacks:', error);
        }
      })
    );

    // Subscribe to environment variables updates with debounce
    this.subscriptions.push(
      this.envVarsUpdate.pipe(
        debounceTime(100)  // 100ms debounce
      ).subscribe(envVars => {
        if (this.selectedTech.file_path.endsWith('.j2')) {
          this.renderTemplate();
        }
      })
    );

    // Initialize deployment config with first stack
    if (this.techStacks.length > 0) {
      this.deploymentConfig.stack = this.techStacks[0].name;
    }
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
    this.deploymentConfig.stack = name;
    
    // If it's a Jinja2 template, render it
    if (this.selectedTech.file_path.endsWith('.j2')) {
      this.renderTemplate();
    }
    this.validateDeployment();
  }

  renderTemplate() {
    this.stacksService.renderTemplate(this.selectedTech.file_path, this.envVars)
      .subscribe({
        next: (content) => {
          this.selectedTech.content = content;
        },
        error: (error) => {
          console.error('Error rendering template:', error);
        }
      });
  }

  updateEnvVars(envVars: Record<string, string>) {
    this.envVars = envVars;
    this.deploymentConfig.envs = envVars;
    this.envVarsUpdate.next(envVars);
    this.validateDeployment();
  }

  addEnvVar() {
    const newKey = `ENV_VAR_${Object.keys(this.envVars).length + 1}`;
    this.envVars[newKey] = '';
    this.updateEnvVars(this.envVars);
  }

  removeEnvVar(key: string) {
    const { [key]: removed, ...rest } = this.envVars;
    this.envVars = rest;
    this.updateEnvVars(this.envVars);
  }

  updateEnvVarKey(oldKey: string, newKey?: any) {
    newKey = newKey?.target?.value;
    if (newKey && newKey !== oldKey) {
      const value = this.envVars[oldKey];
      const { [oldKey]: removed, ...rest } = this.envVars;
      this.envVars = { ...rest, [newKey]: value };
      this.updateEnvVars(this.envVars);
    }
  }

  onDeploymentPlanChange(plan: DeploymentPlan) {
    this.deploymentConfig.deploymentPlan = plan;
    if (plan !== 'on-prem') {
      delete this.deploymentConfig.onPremConfig;
    } else {
      this.deploymentConfig.onPremConfig = {
        ipAddress: '',
        publicKey: '',
        username: 'root'  // Default username
      };
    }
    this.validateDeployment();
  }

  updateOnPremConfig(field: 'ipAddress' | 'publicKey' | 'username', value: string) {
    if (this.deploymentConfig.deploymentPlan === 'on-prem' && this.deploymentConfig.onPremConfig) {
      this.deploymentConfig.onPremConfig[field] = value;
      this.validateDeployment();
    }
  }

  validateDeployment() {
    if (!this.deploymentConfig.stack || !this.selectedTech) {
      this.isDeploymentValid = false;
      return;
    }

    if (this.deploymentConfig.deploymentPlan === 'on-prem') {
      const config = this.deploymentConfig.onPremConfig;
      this.isDeploymentValid = !!(
        config?.ipAddress &&
        config.publicKey &&
        config.username &&
        this.validateIPAddress(config.ipAddress)
      );
    } else {
      this.isDeploymentValid = true;
    }
  }

  validateIPAddress(ipAddress: string): boolean {
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipPattern.test(ipAddress)) return false;
    
    const parts = ipAddress.split('.');
    return parts.every(part => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  async deployConfiguration() {
    if (!this.isDeploymentValid || !this.project) return;

    try {
      const response = await this.http.post('http://localhost:5000/api/deploy', {
        projectId: this.project._id,
        config: this.deploymentConfig
      }).toPromise();

      // Handle successful deployment
      console.log('Deployment configuration sent successfully:', response);
      // You might want to show a success message or redirect
    } catch (error) {
      console.error('Error deploying configuration:', error);
      // Handle error (show error message, etc.)
    }
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