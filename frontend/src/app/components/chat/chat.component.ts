import { MarkdownModule } from 'ngx-markdown';
import { Component } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
  imports: [CommonModule, FormsModule,MarkdownModule,
],
})
export class ChatComponent {
  userInput: string = '';
  response: string = '';

  constructor(private http: HttpClient) {}

  sendMessage() {
    if (!this.userInput.trim()) return;

    const params = new HttpParams().set('message', this.userInput);
    this.http.get<any>('http://localhost:5000/api/chat', { params }).subscribe({
      next: res => this.response = res.response,
      error: err => this.response = 'Error: ' + err.message
    });
  }
}
