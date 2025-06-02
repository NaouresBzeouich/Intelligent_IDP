import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface Stack {
  name: string;
  content: string;
  file_path: string;
}

export interface StacksResponse {
  stacks: Stack[];
  total: number;
}

export interface RenderResponse {
  content: string;
}

@Injectable({
  providedIn: 'root'
})
export class StacksService {
  private readonly backendUrl = environment.backendUrl;

  constructor(private http: HttpClient) {}

  getStacks(): Observable<Stack[]> {
    return this.http.get<StacksResponse>(`${this.backendUrl}/api/stacks`)
      .pipe(
        map(response => response.stacks.map(stack => ({
          name: stack.name,
          content: stack.content,
          file_path: stack.file_path
        })))
      );
  }

  renderTemplate(templateName: string, envVars: Record<string, string> = {}): Observable<string> {
    return this.http.post<RenderResponse>(`${this.backendUrl}/api/stacks/render`, {
      template_name: templateName,
      env_vars: envVars
    }).pipe(
      map(response => response.content)
    );
  }
} 