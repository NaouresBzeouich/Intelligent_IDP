import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// dashboard components
import { LayoutComponent } from './dashboard/layout/layout.component';
import { SidebarComponent } from './dashboard/sidebar/sidebar/sidebar.component';
import { SidebarItemComponent } from './dashboard/sidebar/sidebar-item/sidebar-item.component';
import { SidebarItemsComponent } from './dashboard/sidebar/sidebar-items/sidebar-items.component';
import { SidebarHeaderComponent } from './dashboard/sidebar/sidebar-header/sidebar-header.component';
import { FormsModule } from '@angular/forms';

// pages
import { HomeComponent } from './pages/home/home.component';

// others
import { ContentComponent } from './components/content/content.component';
import { SidebarNewItemComponent } from './dashboard/sidebar/sidebar-new-item/sidebar-new-item.component';
import { HighlightModule, HIGHLIGHT_OPTIONS } from 'ngx-highlightjs';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ChatComponent } from './components/chat/chat.component';
import { NavbarComponent } from './dashboard/navbar/navbar/navbar.component';
import { UserCardComponent } from './dashboard/navbar/user-card/user-card.component';
import { ThemeToggleComponent } from './theme-toggle/theme-toggle.component';
import { LoginComponent } from './components/login/login.component';

@NgModule({
  declarations: [
    AppComponent,

    // dashboard
    LayoutComponent,
    SidebarComponent,
    SidebarItemComponent,
    SidebarHeaderComponent,
    NavbarComponent,
    UserCardComponent,
    
    // pages
    HomeComponent,

    // others
    ContentComponent,
  ],
  imports: [
    SidebarItemsComponent,

    SidebarNewItemComponent,

    BrowserModule, 
    AppRoutingModule,
    HighlightModule,
    FormsModule,
    HttpClientModule,
    ChatComponent,
    ThemeToggleComponent, 
    LoginComponent
  ],
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
    {
      provide: HIGHLIGHT_OPTIONS,
      useValue: {
        fullLibraryLoader: () => import('highlight.js'),
      },
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
