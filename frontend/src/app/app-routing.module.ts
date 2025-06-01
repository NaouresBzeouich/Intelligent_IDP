import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';

const routes: Routes = [
  { path: '', component: HomeComponent },
  { 
    path: 'authorize', 
    loadComponent: () => import('./authorize/authorize.component').then(m => m.AuthorizeComponent)
  },
  {
    path: 'projects/:id',
    loadComponent: () => import('./components/project-details/project-details.component').then(m => m.ProjectDetailsComponent)
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
