import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {LottieComponent} from 'ngx-lottie';
import {NgClass, NgFor, NgIf} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
    selector: 'app-ai-bot',
    standalone: true,
    imports: [LottieComponent, NgIf, NgFor, FormsModule, NgClass,TranslatePipe],
    template: `
        <div class="ai-bot-container">
            <!-- Bulle de salutation -->
            <div class="speech-bubble" *ngIf="showBubble && !chatVisible">{{'salutAssistant' | translate}}<br /><b class="text-blue-500">IMAS AI</b>.</div>

            <!-- Animation cliquable -->
            <div class="ai-bot" (mouseenter)="showBubble = true" (mouseleave)="showBubble = false" (click)="toggleChat()">
                <ng-lottie [options]="options" width="100%" height="100%"></ng-lottie>
            </div>

            <!-- Fenêtre de chat -->
            <div class="chat-window" *ngIf="chatVisible" [class.open]="chatOpen" [class.close]="!chatOpen" (animationend)="onAnimationEnd()">
                <div class="chat-header">
                    <span class="text-green-500"><img src="/img/probmis.png" class="inline-block" width="20" height="20" alt=""> IMAS AI</span>
                    <button class="close-btn" (click)="closeChat()">×</button>
                </div>

                <div class="chat-body" #chatBody>
                    <div *ngFor="let msg of messages" class="message-wrapper" [ngClass]="msg.from">
                        <div class="chat-bubble" [ngClass]="msg.from">
                            <b *ngIf="msg.from === 'bot'" class="sender-name text-green-500" >IMAS AI :</b>
                            <span>{{ msg.text }}</span>
                        </div>
                    </div>
                </div>

                <div class="chat-footer">
                    <input type="text" [(ngModel)]="userInput" placeholder="{{'writeMsg'|translate}}" (keydown.enter)="sendMessage()" />
                </div>
            </div>
        </div>
    `,
    styleUrl:'ai-bot.component.scss'
})
export class AiBotComponent implements OnInit {
    options = {
        path: 'assets/animations/robot-2.json',
        loop: true,
        autoplay: true
    };

    showBubble = false;
    chatVisible = false;
    chatOpen = false;
    userInput = '';
    messages: { from: 'user' | 'bot'; text: string }[] = [{ from: 'bot', text: 'Bonjour ! Comment puis-je vous aider ?'}];

    @ViewChild('chatBody') chatBodyRef!: ElementRef;

    ngOnInit() {
        this.showBubble = true;
        setTimeout(() => (this.showBubble = false), 4000);
    }

    scrollToBottom() {
        setTimeout(() => {
            if (this.chatBodyRef) {
                const element = this.chatBodyRef.nativeElement;
                element.scrollTop = element.scrollHeight;
            }
        });
    }

    toggleChat() {
        if (navigator.vibrate) navigator.vibrate(50);
        if (!this.chatVisible) {
            this.chatVisible = true;
            setTimeout(() => (this.chatOpen = true), 10);
        }
    }

    closeChat() {
        this.chatOpen = false;
    }

    onAnimationEnd() {
        if (!this.chatOpen) {
            this.chatVisible = false;
        }
    }

    sendMessage() {
        const message = this.userInput.trim();
        if (!message) return;

        this.messages.push({ from: 'user', text: message });
        this.userInput = '';
        this.scrollToBottom();

        setTimeout(() => {
            this.messages.push({
                from: 'bot',
                text: 'Je suis une IA fictive. Pose-moi une autre question !'
            });
            this.scrollToBottom();
        }, 600);
    }
}
