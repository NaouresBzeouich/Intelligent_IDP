import { Component } from '@angular/core';

@Component({
    selector: 'sidebar-items',
    templateUrl: './sidebar-items.component.html',
    standalone: false
})
export class SidebarItemsComponent {
  projects = [ "first componenet " , "tp2 angular" , "multiprocossing plateform" , "micro-service-gestions-plateform" , "angular frontend"  , "air poluttion processing"]
}
