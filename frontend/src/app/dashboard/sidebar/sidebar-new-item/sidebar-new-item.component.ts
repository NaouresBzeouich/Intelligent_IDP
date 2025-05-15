import { Component } from '@angular/core';

@Component({
  selector: 'app-sidebar-new-item',
  templateUrl: './sidebar-new-item.component.html',
  styleUrls: ['./sidebar-new-item.component.css' ]
})
export class SidebarNewItemComponent {

  onCreateNewChat(): void {
    console.log('Create New Chat button clicked!');
    
  }
}
