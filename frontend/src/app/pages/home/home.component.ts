import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LoginComponent } from '../../components/login/login.component';
import { UserService } from '../../services/user.service';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    standalone: true,
    imports: [CommonModule, RouterModule, LoginComponent]
})
export class HomeComponent {
    constructor(public user: UserService) {}
}
