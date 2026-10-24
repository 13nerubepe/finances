import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Tag } from 'primeng/tag';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { AssistantIaService } from '@/app/pages/commons/assistant-ai/assistant-ai.service';

interface Message {
    auteur: 'user' | 'ia';
    texte: string;
    sources?: string[];
    heure: Date;
}

@Component({
    selector: 'app-assistant-ai',
    imports: [NgIf, NgFor, NgClass, DatePipe, FormsModule, Tag, ButtonDirective, Dialog, InputText],
    templateUrl: './assistant-ai.html',
    styleUrl: './assistant-ai.scss'
})
export class AssistantAi {
    private readonly assistantService = inject(AssistantIaService);

    @ViewChild('zoneMessages') zoneMessages?: ElementRef<HTMLElement>;

    ouvert = false;
    vue: 'accueil' | 'chat' = 'accueil';
    enCours = false;
    saisie = '';
    messages: Message[] = [];

    actions = [
        { id: 'conges', titre: 'Gérer les congés', sousTitre: 'Demandes et absences', icone: 'pi-calendar', couleur: 'text-orange-500', question: 'Comment gérer les congés ?' },
        { id: 'effectifs', titre: 'Voir les effectifs', sousTitre: 'Statistiques du personnel', icone: 'pi-users', couleur: 'text-blue-500', question: 'Quels sont les effectifs actuels ?' },
        { id: 'departements', titre: 'Départements', sousTitre: 'Structures et organisation', icone: 'pi-sitemap', couleur: 'text-purple-500', question: 'Présente-moi les départements.' },
        { id: 'politiques-rh', titre: 'Politiques RH', sousTitre: 'Règles et procédures', icone: 'pi-book', couleur: 'text-green-600', question: 'Quelles sont les politiques RH ?' }
    ];

    basculer(): void {
        this.ouvert = !this.ouvert;
        if (this.ouvert && this.vue === 'chat') this.defiler();
    }

    onAction(id: string): void {
        const action = this.actions.find((a) => a.id === id);
        if (action) this.envoyer(action.question);
    }

    envoyer(texte: string): void {
        const question = texte?.trim();
        if (!question || this.enCours) return;

        this.vue = 'chat';
        this.messages.push({ auteur: 'user', texte: question, heure: new Date() });
        this.saisie = '';
        this.enCours = true;
        this.defiler();

        this.assistantService.poserQuestion(question).subscribe({
            next: (res) => {
                this.messages.push({ auteur: 'ia', texte: res.reponse, sources: res.sources, heure: new Date() });
                this.enCours = false;
                this.defiler();
            },
            error: () => {
                this.messages.push({
                    auteur: 'ia',
                    texte: 'Désolé, une erreur est survenue. Veuillez réessayer.',
                    heure: new Date()
                });
                this.enCours = false;
                this.defiler();
            }
        });
    }

    private defiler(): void {
        setTimeout(() => {
            const el = this.zoneMessages?.nativeElement;
            if (el) el.scrollTop = el.scrollHeight;
        });
    }
}
