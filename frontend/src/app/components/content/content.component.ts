import { Component, signal, WritableSignal } from '@angular/core';

@Component({
    selector: 'app-content',
    templateUrl: './content.component.html',
    styleUrls: ['./content.component.css'],
    standalone: false
})
export class ContentComponent {
    
    techStacks : {name:string |undefined , dockerfile:string |undefined}[] = [
    
        { name: 'Node.js', dockerfile: `FROM node:18\nWORKDIR /app\nCOPY package*.json ./\nRUN npm install\nCOPY . .\nCMD ["node", "index.js"]` },
    
        { name: 'Python', dockerfile: `FROM python:3.11\nWORKDIR /app\nCOPY requirements.txt ./\nRUN pip install -r requirements.txt\nCOPY . .\nCMD ["python", "app.py"]` },
    
        { name: 'Java', dockerfile: `FROM openjdk:17\nWORKDIR /app\nCOPY target/app.jar ./\nCMD ["java", "-jar", "app.jar"]` },
    
        { name: 'Go', dockerfile: `FROM golang:1.20\nWORKDIR /app\nCOPY . .\nRUN go build -o app\nCMD ["./app"]` },
    
        { name: 'PHP', dockerfile: `FROM php:8.2-apache\nCOPY src/ /var/www/html/\nEXPOSE 80` },
  ];

selectedTech : WritableSignal<{name: string |undefined , dockerfile: string |undefined}> = signal({...this.techStacks[0]});
 
  
  onTechChange(name: string) {
    console.log(this.techStacks);
    console.log("onchange to name");
    console.log(name);
    const found = this.techStacks.find((t) => t.name === name)??this.techStacks[0];
    this.selectedTech.set({...found});
    console.log(found , this.selectedTech());
  }


}
