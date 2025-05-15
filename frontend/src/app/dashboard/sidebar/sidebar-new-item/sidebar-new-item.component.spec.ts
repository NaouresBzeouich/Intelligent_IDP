import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SidebarNewItemComponent } from './sidebar-new-item.component';

describe('SidebarNewItemComponent', () => {
  let component: SidebarNewItemComponent;
  let fixture: ComponentFixture<SidebarNewItemComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SidebarNewItemComponent]
    });
    fixture = TestBed.createComponent(SidebarNewItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
