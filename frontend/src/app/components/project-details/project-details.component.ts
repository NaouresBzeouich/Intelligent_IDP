import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProjectsService, Project, ProjectConfig, OnPremConfig, DeploymentPlan } from '../../services/projects.service';
import { StacksService, Stack } from '../../services/stacks.service';
import { Subscription, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { HighlightModule, HIGHLIGHT_OPTIONS } from 'ngx-highlightjs';
import { HttpClient } from '@angular/common/http';
import { MarkdownModule, MarkdownService } from 'ngx-markdown';
import { environment } from '../../../environments/environment';

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
  private subscriptions: Subscription[] = [];
  isLoading: boolean = false;
  isDockerfileVisible: boolean = true;
  techStacks: Stack[] = [];
  message: string = '';
  recommendation: string = '';
  private envVarsUpdate = new Subject<Record<string, string>>();
  private readonly backendUrl = environment.backendUrl;

  // Dictionary to store all project-specific state
  projectStates: Record<string, {
    project: Project | null;
    selectedTech: Stack;
    envVars: Record<string, string>;
    deploymentConfig: ProjectConfig;
    chatHistory: ChatMessage[];
    userInput: string;
  }> = {};

  // Current project ID
  private projectId: string | null = null;

  // Getters for current project state
  get currentState() {
    return this.projectId ? this.projectStates[this.projectId] : null;
  }

  get project() {
    return this.currentState?.project ?? null;
  }

  get selectedTech() {
    return this.currentState?.selectedTech ?? { name: '', content: '', file_path: '' };
  }

  get envVars() {
    return this.currentState?.envVars ?? {};
  }

  get deploymentConfig() {
    return this.currentState?.deploymentConfig ?? {
      stack: '',
      envs: {},
      deploymentPlan: 'aws'
    };
  }

  get chatHistory() {
    return this.currentState?.chatHistory ?? [];
  }

  get userInput() {
    return this.currentState?.userInput ?? '';
  }

  set userInput(value: string) {
    if (this.projectId && this.projectStates[this.projectId]) {
      this.projectStates[this.projectId].userInput = value;
    }
  }

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
  ) {}

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
          if (this.projectId && stacks.length > 0 && !this.deploymentConfig.stack) {
            this.initializeProjectState(this.projectId, stacks[0] || { name: '', content: '', file_path: '' });
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
        if (this.projectId) {
          this.updateProjectState(this.projectId, { envVars });
          if (this.selectedTech.file_path.endsWith('.j2')) {
            this.renderTemplate();
          }
        }
      })
    );
  }

  private initializeProjectState(projectId: string, defaultTech: Stack) {
    if (!this.projectStates[projectId]) {
      this.projectStates[projectId] = {
        project: null,
        selectedTech: { ...defaultTech },
        envVars: {},
        deploymentConfig: {
          stack: defaultTech.name,
          envs: {},
          deploymentPlan: 'aws'
        },
        chatHistory: [],
        userInput: ''
      };
    }
  }

  private updateProjectState(projectId: string, updates: Partial<typeof this.projectStates[string]>) {
    if (this.projectStates[projectId]) {
      this.projectStates[projectId] = {
        ...this.projectStates[projectId],
        ...updates
      };
      this.validateDeployment();
    }
  }

  private loadProjectDetails() {
    if (!this.projectId) return;
    
    // Subscribe to projects updates
    this.subscriptions.push(
      this.projectsService.projects$.subscribe(projects => {
        const foundProject = projects.find(p => p._id === this.projectId) || null;
        
        if (foundProject && this.projectId) {
          // Initialize state if it doesn't exist
          if (!this.projectStates[this.projectId]) {
            this.initializeProjectState(this.projectId, this.techStacks[0] || { name: '', content: '', file_path: '' });
          }

          // Update project in state
          this.updateProjectState(this.projectId, {
            project: foundProject
          });

          // Load existing configuration if available
          if (foundProject.config) {
            const config = foundProject.config;
            this.updateProjectState(this.projectId, {
              deploymentConfig: { ...config },
              envVars: { ...config.envs }
            });

            // Find and select the tech stack
            const foundStack = this.techStacks.find(t => t.name === config.stack);
            if (foundStack) {
              this.updateProjectState(this.projectId, {
                selectedTech: { ...foundStack }
              });
              this.onTechChange(foundStack.name);
            }
          }
        }
      })
    );
  }

  onTechChange(name: string) {
    if (!this.projectId) return;

    const found = this.techStacks.find((t) => t.name === name) ?? this.techStacks[0];
    
    this.updateProjectState(this.projectId, {
      selectedTech: { ...found },
      deploymentConfig: {
        ...this.deploymentConfig,
        stack: name
      }
    });
    
    if (found.file_path.endsWith('.j2')) {
      this.renderTemplate();
    }
  }

  updateEnvVars(envVars: Record<string, string>) {
    if (!this.projectId) return;

    this.updateProjectState(this.projectId, {
      envVars,
      deploymentConfig: {
        ...this.deploymentConfig,
        envs: envVars
      }
    });
    this.envVarsUpdate.next(envVars);
  }

  onDeploymentPlanChange(plan: DeploymentPlan) {
    if (!this.projectId) return;

    const baseConfig = {
      stack: this.deploymentConfig.stack,
      envs: this.deploymentConfig.envs,
    };

    let newConfig: ProjectConfig;

    if (plan === 'on-prem') {
      newConfig = {
        ...baseConfig,
        deploymentPlan: plan,
        onPremConfig: {
          ipAddress: '',
          publicKey: '',
          username: 'root'
        }
      };
    } else if (plan === 'aws') {
      newConfig = {
        ...baseConfig,
        deploymentPlan: plan
      };
    } else {
      newConfig = {
        ...baseConfig,
        deploymentPlan: plan
      };
    }

    this.updateProjectState(this.projectId, {
      deploymentConfig: newConfig
    });
  }

  updateOnPremConfig(field: 'ipAddress' | 'publicKey' | 'username', value: string) {
    if (!this.projectId || this.deploymentConfig.deploymentPlan !== 'on-prem') return;

    const newConfig = {
      ...this.deploymentConfig,
      onPremConfig: {
        ...this.deploymentConfig.onPremConfig,
        [field]: value
      }
    };

    this.updateProjectState(this.projectId, {
      deploymentConfig: newConfig
    });
  }

  async deployConfiguration() {
    if (!this.isDeploymentValid || !this.project?._id || !this.projectId) return;

    try {
      // Get the current project's configuration from the state
      const currentConfig = this.projectStates[this.projectId].deploymentConfig;
      
      // Save the project configuration
      const updatedProject = await this.projectsService
        .saveProjectConfig(this.project._id, currentConfig)
        .toPromise();

      console.log('Configuration saved successfully:', updatedProject);

      // Launch the Jenkins build
      await this.projectsService
        .launchBuild(this.project._id)
        .toPromise();

      console.log('Jenkins build launched successfully');

      // Refresh the projects list
    } catch (error) {
      console.error('Error during deployment:', error);
    }
  }

  async destroyProject() {
    if (!this.project || !confirm('Are you sure you want to destroy this project? This action cannot be undone.')) {
      return;
    }

    try {
      await this.projectsService.deleteProject(this.project._id);
      // Remove project state
      if (this.projectId) {
        delete this.projectStates[this.projectId];
      }
      // Navigate back to home page after successful deletion
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Error destroying project:', error);
    }
  }


  renderTemplate() {
    if (!this.projectId) return;

    this.stacksService.renderTemplate(this.selectedTech.file_path, this.envVars)
      .subscribe({
        next: (content) => {
          this.updateProjectState(this.projectId!, {
            selectedTech: {
              ...this.selectedTech,
              content
            }
          });
        },
        error: (error) => {
          console.error('Error rendering template:', error);
        }
      });
  }

  validateDeployment() {
    if (!this.projectId) {
      this.isDeploymentValid = false;
      return;
    }

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

  addEnvVar() {
    if (!this.projectId) return;
    const newKey = `ENV_VAR_${Object.keys(this.envVars).length + 1}`;
    const newEnvVars = { ...this.envVars, [newKey]: '' };
    this.updateEnvVars(newEnvVars);
  }

  removeEnvVar(key: string) {
    if (!this.projectId) return;
    const { [key]: removed, ...rest } = this.envVars;
    this.updateEnvVars(rest);
  }

  updateEnvVarKey(oldKey: string, event: any) {
    if (!this.projectId) return;
    const newKey = event?.target?.value;
    if (newKey && newKey !== oldKey) {
      const value = this.envVars[oldKey];
      const { [oldKey]: removed, ...rest } = this.envVars;
      this.updateEnvVars({ ...rest, [newKey]: value });
    }
  }

  toggleDockerfile() {
    this.isDockerfileVisible = !this.isDockerfileVisible;
  }

  async sendMessage() {
    if (!this.projectId || !this.userInput.trim() || !this.project) return;

    const userMessage: ChatMessage = {
      type: 'user',
      content: this.userInput,
      timestamp: new Date()
    };

    // Update chat history
    this.updateProjectState(this.projectId, {
      chatHistory: [...this.chatHistory, userMessage]
    });

    this.isLoading = true;
    try {
      const params = {
        message: this.userInput,
        project_id: this.project._id,
        repo_name: this.project.repo_name,
        repo_full_name: this.project.repo_full_name
      };

      const result = await this.http.get<{response: string}>(`${this.backendUrl}/api/chat`, { params }).toPromise();
      
      const assistantMessage: ChatMessage = {
        type: 'assistant',
        content: result?.response || 'No response received',
        timestamp: new Date()
      };

      // Update chat history and clear input
      this.updateProjectState(this.projectId, {
        chatHistory: [...this.chatHistory, assistantMessage],
        userInput: ''
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        type: 'assistant',
        content: 'Error: ' + (error.message || 'Failed to send message'),
        timestamp: new Date()
      };
      
      // Update chat history with error
      this.updateProjectState(this.projectId, {
        chatHistory: [...this.chatHistory, errorMessage]
      });
    } finally {
      this.isLoading = false;
    }
  }

  async getRecommendation() {
    try {
      const params = { message: this.message };
      const result = await this.http.get<{response: string}>(`${this.backendUrl}/api/chat`, { params }).toPromise();
      this.recommendation = result?.response || '';
    } catch (error) {
      console.error('Error getting recommendation:', error);
      this.recommendation = 'Failed to get recommendation';
    }
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
} 