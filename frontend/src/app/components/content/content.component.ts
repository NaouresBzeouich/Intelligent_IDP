import { Component, signal, WritableSignal, OnInit, OnDestroy } from '@angular/core';
import { StacksService, Stack } from '../../services/stacks.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-content',
    templateUrl: './content.component.html',
    styleUrls: ['./content.component.css'],
    standalone: false
})
export class ContentComponent implements OnInit, OnDestroy {
    private subscriptions: Subscription[] = [];
    techStacks: Stack[] = [];
    selectedTech: WritableSignal<Stack> = signal({ name: '', content: '', file_path: '' });

    constructor(private stacksService: StacksService) {}

    ngOnInit() {
        this.subscriptions.push(
            this.stacksService.getStacks().subscribe({
                next: (stacks) => {
                    this.techStacks = stacks;
                    if (stacks.length > 0) {
                        this.selectedTech.set({ ...stacks[0] });
                    }
                },
                error: (error) => {
                    console.error('Error loading tech stacks:', error);
                }
            })
        );
    }

    ngOnDestroy() {
        this.subscriptions.forEach(sub => sub.unsubscribe());
    }
    
    onTechChange(name: string) {
        const found = this.techStacks.find((t) => t.name === name) ?? this.techStacks[0];
        this.selectedTech.set({ ...found });
    }
}
