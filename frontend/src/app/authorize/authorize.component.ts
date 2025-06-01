import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-authorize',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="authorize-container">
      <p>Processing authorization...</p>
    </div>
  `,
  styles: [`
    .authorize-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      font-size: 1.2rem;
    }
  `]
})
export class AuthorizeComponent implements OnInit {
  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
        // window.location.href = '/assets/authorize.html';

    console.log('[AuthorizeComponent] ngOnInit triggered');

    // Get the code and installation_id from URL parameters
    const code = this.route.snapshot.queryParamMap.get('code');
    const installation_id = this.route.snapshot.queryParamMap.get('installation_id');

    console.log('[AuthorizeComponent] Extracted query params:', { code, installation_id });

    // Post the message to the opener window
    if (window.opener) {
      console.log('[AuthorizeComponent] Found opener window. Posting message...');
      console.log({ code, installation_id });
      window.opener.postMessage({ code, installation_id }, "*");
      console.log('[AuthorizeComponent] Message posted. Closing window...');
      // window.close();
    } else {
      console.warn('[AuthorizeComponent] No opener window found');
      console.log('[AuthorizeComponent] Closing window after timeout');
      // window.close();
    }
  }
} 