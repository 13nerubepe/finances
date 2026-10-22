import { Component, effect, ElementRef, OnInit, signal, viewChild, ViewChild } from '@angular/core';
import {LottieComponent} from 'ngx-lottie';
import {NgClass, NgFor, NgIf} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
    selector: 'app-ai-bot',
    standalone: true,
    imports: [LottieComponent, NgIf, NgFor, FormsModule, NgClass,TranslatePipe],
    templateUrl:'ai-bot.component.html',
    // template: `
    //     <div class="ai-bot-container">
    //         <!-- Bulle de salutation -->
    //         <div class="speech-bubble" *ngIf="showBubble && !chatVisible">{{'salutAssistant' | translate}}<br /><b class="text-blue-500">IMAS AI</b>.</div>
    //
    //         <!-- Animation cliquable -->
    //         <div class="ai-bot" (mouseenter)="showBubble = true" (mouseleave)="showBubble = false" (click)="toggleChat()">
    //             <ng-lottie [options]="options" width="100%" height="100%"></ng-lottie>
    //         </div>
    //
    //         <!-- Fenêtre de chat -->
    //         <div class="chat-window" *ngIf="chatVisible" [class.open]="chatOpen" [class.close]="!chatOpen" (animationend)="onAnimationEnd()">
    //             <div class="chat-header">
    //                 <span class="text-green-500"><img src="/img/probmis.png" class="inline-block" width="20" height="20" alt=""> IMAS AI</span>
    //                 <button class="close-btn" (click)="closeChat()">×</button>
    //             </div>
    //
    //             <div class="chat-body" #chatBody>
    //                 <div *ngFor="let msg of messages" class="message-wrapper" [ngClass]="msg.from">
    //                     <div class="chat-bubble" [ngClass]="msg.from">
    //                         <b *ngIf="msg.from === 'bot'" class="sender-name text-green-500" >IMAS AI :</b>
    //                         <span>{{ msg.text }}</span>
    //                     </div>
    //                 </div>
    //             </div>
    //
    //             <div class="chat-footer">
    //                 <input type="text" [(ngModel)]="userInput" placeholder="{{'writeMsg'|translate}}" (keydown.enter)="sendMessage()" />
    //             </div>
    //         </div>
    //     </div>
    // `,
    styleUrl:'ai-bot.component.scss'
})

interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    text: string;
}

const WELCOME = 'Bip bop ! Je suis votre assistant robot. Comment puis-je vous aider ?';

export class AiBotComponent  {

    private nextId = 1;
    private readonly scrollArea = viewChild<ElementRef<HTMLElement>>('scrollArea');

    readonly open = signal(false);
    readonly typing = signal(false);
    readonly messages = signal<ChatMessage[]>([{ id: this.nextId++, role: 'assistant', text: WELCOME }]);

    draft = '';

    suggestions = ['Comment ajouter un actif ?', 'Comment activer la 2FA ?', 'Comment changer ma photo ?'];

    // Réponses fictives par mot-clé : à remplacer par un appel à votre API
    private readonly knowledge: { keywords: string[]; answer: string }[] = [
        {
            keywords: ['ajouter', 'actif'],
            answer: 'Dans la page « Actifs », cliquez sur « Ajouter un actif », renseignez le nom et le symbole, puis enregistrez.',
        },
        {
            keywords: ['2fa', 'double', 'authentification'],
            answer: 'Ouvrez « Mon profil », section « Authentification à deux facteurs », puis cliquez sur « Activer ». Scannez le QR code et saisissez le code à 6 chiffres.',
        },
        {
            keywords: ['photo', 'avatar'],
            answer: 'Dans « Mon profil », cliquez sur « Changer la photo ». Formats acceptés : JPG, PNG ou WebP, 2 Mo maximum.',
        },
        {
            keywords: ['mot de passe', 'password'],
            answer: "Dans « Mon profil », section « Changer le mot de passe », saisissez l'ancien puis le nouveau (8 caractères minimum).",
        },
    ];

    constructor() {
        // Fait défiler la conversation vers le bas à chaque changement
        effect(() => {
            this.messages();
            this.typing();
            this.open();
            setTimeout(() => {
                const el = this.scrollArea()?.nativeElement;
                if (el) el.scrollTop = el.scrollHeight;
            });
        });
    }

    toggle(): void {
        this.open.update((v) => !v);
    }

    reset(): void {
        this.messages.set([{ id: this.nextId++, role: 'assistant', text: WELCOME }]);
        this.typing.set(false);
        this.draft = '';
    }

    send(text?: string): void {
        const question = (text ?? this.draft).trim();
        if (!question || this.typing()) return;

        this.messages.update((list) => [...list, { id: this.nextId++, role: 'user', text: question }]);
        this.draft = '';
        this.typing.set(true);

        // Simule le temps de réponse
        setTimeout(() => {
            this.messages.update((list) => [
                ...list,
                { id: this.nextId++, role: 'assistant', text: this.answer(question) },
            ]);
            this.typing.set(false);
        }, 900);
    }

    private answer(question: string): string {
        const q = question.toLowerCase();
        const match = this.knowledge.find((k) => k.keywords.some((w) => q.includes(w)));

        return (
            match?.answer ??
            "Bip... Je n'ai pas encore de réponse précise à cette question. Pouvez-vous la reformuler ou donner plus de détails ?"
        );
    }





    // options = {
    //     path: 'assets/animations/robot-2.json',
    //     loop: true,
    //     autoplay: true
    // };
    //
    // showBubble = false;
    // chatVisible = false;
    // chatOpen = false;
    // userInput = '';
    // messages: { from: 'user' | 'bot'; text: string }[] = [{ from: 'bot', text: 'Bonjour ! Comment puis-je vous aider ?'}];
    //
    // @ViewChild('chatBody') chatBodyRef!: ElementRef;
    //
    // ngOnInit() {
    //     this.showBubble = true;
    //     setTimeout(() => (this.showBubble = false), 4000);
    // }
    //
    // scrollToBottom() {
    //     setTimeout(() => {
    //         if (this.chatBodyRef) {
    //             const element = this.chatBodyRef.nativeElement;
    //             element.scrollTop = element.scrollHeight;
    //         }
    //     });
    // }
    //
    // toggleChat() {
    //     if (navigator.vibrate) navigator.vibrate(50);
    //     if (!this.chatVisible) {
    //         this.chatVisible = true;
    //         setTimeout(() => (this.chatOpen = true), 10);
    //     }
    // }
    //
    // closeChat() {
    //     this.chatOpen = false;
    // }
    //
    // onAnimationEnd() {
    //     if (!this.chatOpen) {
    //         this.chatVisible = false;
    //     }
    // }
    //
    // sendMessage() {
    //     const message = this.userInput.trim();
    //     if (!message) return;
    //
    //     this.messages.push({ from: 'user', text: message });
    //     this.userInput = '';
    //     this.scrollToBottom();
    //
    //     setTimeout(() => {
    //         this.messages.push({
    //             from: 'bot',
    //             text: 'Je suis une IA fictive. Pose-moi une autre question !'
    //         });
    //         this.scrollToBottom();
    //     }, 600);
    // }
}
