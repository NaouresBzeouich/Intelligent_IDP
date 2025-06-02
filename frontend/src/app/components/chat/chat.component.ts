import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarkdownModule } from 'ngx-markdown';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-chat',
  template: `
    <div class="chat-container">
      <div class="message-input">
        <textarea [(ngModel)]="message" rows="5" placeholder="Type your message here..."></textarea>
        <button (click)="sendMessage()">Send</button>
      </div>
      <div class="response" *ngIf="response">
        <markdown [data]="response"></markdown>
      </div>
    </div>
  `,
  styles: [`
    .chat-container {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }
    .message-input {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    textarea {
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      resize: vertical;
    }
    button {
      padding: 0.5rem 1rem;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background-color: #0056b3;
    }
    .response {
      padding: 1rem;
      background-color: #f8f9fa;
      border-radius: 4px;
      border: 1px solid #dee2e6;
    }
  `],
  standalone: true,
  imports: [CommonModule, FormsModule, MarkdownModule]
})
export class ChatComponent {
  private readonly backendUrl = environment.backendUrl;
  message = '';
  response = '';

  constructor(private http: HttpClient) {}

  sendMessage() {
    const params = { message: this.message };
    this.http.get<any>(`${this.backendUrl}/api/chat`, { params }).subscribe({
      next: (response) => {
        this.response = response.response;
      },
      error: (error) => {
        console.error('Error:', error);
        this.response = 'Error occurred while fetching response';
      }
    });
  }
}
