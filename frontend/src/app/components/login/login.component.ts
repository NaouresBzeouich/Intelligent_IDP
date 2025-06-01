import { Component } from '@angular/core';
import { GitHubAuthService } from 'src/app/services/github-auth.service';
import { HttpClient } from '@angular/common/http';
import { UserService } from 'src/app/services/user.service';
@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  constructor(private github: GitHubAuthService, public user : UserService, private http: HttpClient) {}

  async login() {
    if (this.user.isLoggedIn())
      // make button disabled
      return;
    
      console.log('[LoginComponent] Starting GitHub login process...');
    const { installation_token, oauth_token } = await this.github.startLogin();
    await this.user.refreshUserProfile();
    

    // Send to backend to exchange for tokens
   /*  this.http.get(`/api/authorize?code=${code}&installation_id=${installation_id}`).subscribe((tokens: any) => {
      console.log('Tokens:', tokens);
      localStorage.setItem('gh_token', tokens.access_token);
    }); */
  }

}
