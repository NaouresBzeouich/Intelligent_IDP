import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Deployment {
  projectId: string;
  projectName: string;
  deployedAt: Date;
  status: 'failed' | 'in_progress' | 'completed';
  publicIp?: string;
}

@Component({
  selector: 'app-deployment-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './deployment-dashboard.component.html',
  styleUrls: ['./deployment-dashboard.component.css']
})
export class DeploymentDashboardComponent {
  deployments: Deployment[] = [
    {
      projectId: '683c73ad6b8629fceb510c1d',
      projectName: 'E-commerce Platform',
      deployedAt: new Date('2024-03-20T14:30:00'),
      status: 'completed',
      publicIp: '52.45.123.45'
    },
    {
      projectId: '683c73d66b8629fceb510c1e',
      projectName: 'Blog API Service',
      deployedAt: new Date('2024-03-20T15:45:00'),
      status: 'in_progress',
      publicIp: 'Pending...'
    },
    {
      projectId: '683c9c2803ce7d2f45cd8cd7',
      projectName: 'Authentication Service',
      deployedAt: new Date('2024-03-20T13:15:00'),
      status: 'failed'
    }
  ];

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      failed: 'Failed',
      in_progress: 'In Progress',
      completed: 'Completed'
    };
    return statusMap[status] || status;
  }

  getStatusIcon(status: string): string {
    return 'fas fa-circle';
  }
} 