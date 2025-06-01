import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectsService, Project, ProjectConfig } from '../../services/projects.service';
import { StacksService, Stack } from '../../services/stacks.service';
import { Subscription, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { HighlightModule, HIGHLIGHT_OPTIONS } from 'ngx-highlightjs';
import { HttpClient } from '@angular/common/http';
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
          dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
          yaml: () => import('highlight.js/lib/languages/yaml'),
          bash: () => import('highlight.js/lib/languages/bash')
        },
        themePath: 'assets/highlight.js/styles/github.css'
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
  isDockerfileVisible: boolean = true;

  // Dictionary to store configurations per project
  private projectConfigs: Record<string, ProjectConfig> = {};

  techStacks: Stack[] = [];
  selectedTech: Stack;
  envVars: Record<string, string> = {};
  private envVarsUpdate = new Subject<Record<string, string>>();

  deploymentConfig: ProjectConfig = {
    stack: '',
    envs: {},
    deploymentPlan: 'aws'
  };

  deploymentPlans: { value: 'aws' | 'azure' | 'on-prem'; label: string }[] = [
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
          if (stacks.length > 0 && !this.deploymentConfig.stack) {
            this.selectedTech = { ...stacks[0] };
            this.deploymentConfig.stack = stacks[0].name;
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
        this.deploymentConfig.envs = envVars;
        if (this.selectedTech.file_path.endsWith('.j2')) {
          this.renderTemplate();
        }
      })
    );
  }

  private loadProjectDetails() {
    if (!this.projectId) return;
    
    // Subscribe to projects updates
    this.subscriptions.push(
      this.projectsService.projects$.subscribe(projects => {
        const foundProject = projects.find(p => p._id === this.projectId) || null;
        
        if (foundProject) {
          this.project = foundProject;
          
          // Load existing configuration if available
          if (this.projectId) {
            // Check if we have a cached config
            if (this.projectConfigs[this.projectId]) {
              this.deploymentConfig = { ...this.projectConfigs[this.projectId] };
              this.envVars = { ...this.projectConfigs[this.projectId].envs };
            } else if (foundProject.config) {
              // If no cached config, use the one from the project
              this.deploymentConfig = { ...foundProject.config };
              this.envVars = { ...foundProject.config.envs };
              // Cache the config
              this.projectConfigs[this.projectId] = { ...foundProject.config };
            }

            // Find and select the tech stack
            const foundStack = this.techStacks.find(t => t.name === this.deploymentConfig.stack);
            if (foundStack) {
              this.selectedTech = { ...foundStack };
              this.onTechChange(foundStack.name);
            }
          }
        }
      })
    );
  }

  onTechChange(name: string) {
    const found = this.techStacks.find((t) => t.name === name) ?? this.techStacks[0];
    this.selectedTech = { ...found };
    this.deploymentConfig.stack = name;
    
    if (this.projectId) {
      // Update the cached config
      this.projectConfigs[this.projectId] = { ...this.deploymentConfig };
    }
    
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
    
    if (this.projectId) {
      // Update the cached config
      this.projectConfigs[this.projectId] = { ...this.deploymentConfig };
    }
    
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

  onDeploymentPlanChange(plan: 'aws' | 'azure' | 'on-prem') {
    this.deploymentConfig.deploymentPlan = plan;
    if (plan !== 'on-prem') {
      delete this.deploymentConfig.onPremConfig;
    } else {
      this.deploymentConfig.onPremConfig = {
        ipAddress: '',
        publicKey: '',
        username: 'root'
      };
    }
    
    if (this.projectId) {
      // Update the cached config
      this.projectConfigs[this.projectId] = { ...this.deploymentConfig };
    }
    
    this.validateDeployment();
  }

  updateOnPremConfig(field: 'ipAddress' | 'publicKey' | 'username', value: string) {
    if (this.deploymentConfig.deploymentPlan === 'on-prem' && this.deploymentConfig.onPremConfig) {
      this.deploymentConfig.onPremConfig[field] = value;
      
      if (this.projectId) {
        // Update the cached config
        this.projectConfigs[this.projectId] = { ...this.deploymentConfig };
      }
      
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
    if (!this.isDeploymentValid || !this.project?._id) return;

    try {
      const updatedProject = await this.projectsService
        .saveProjectConfig(this.project._id, this.deploymentConfig)
        .toPromise();

      console.log('Configuration saved successfully:', updatedProject);
      
      // Update the cached config after successful save
      if (this.projectId) {
        this.projectConfigs[this.projectId] = { ...this.deploymentConfig };
      }
    } catch (error) {
      console.error('Error saving configuration:', error);
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

  async sendMessage() {
    if (!this.userInput.trim() || !this.project) return;

    const userMessage: ChatMessage = {
      type: 'user',
      content: this.userInput,
      timestamp: new Date()
    };
    this.chatHistory.push(userMessage);

    this.isLoading = true;
    try {
      const params = {
        message: this.userInput,
        project_id: this.project._id,
        repo_name: this.project.repo_name,
        repo_full_name: this.project.repo_full_name
      };

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

  toggleDockerfile() {
    this.isDockerfileVisible = !this.isDockerfileVisible;
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
} 