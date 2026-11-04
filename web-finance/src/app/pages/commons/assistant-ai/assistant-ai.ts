import { ChangeDetectorRef, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
    imports: [NgIf, NgFor, NgClass, DatePipe, FormsModule, ButtonDirective, Dialog, InputText],
    templateUrl: './assistant-ai.html',
    styleUrl: './assistant-ai.scss'
})
export class AssistantAi {
    private readonly assistantService = inject(AssistantIaService);
    private readonly cdr = inject(ChangeDetectorRef);

    @ViewChild('zoneMessages') zoneMessages?: ElementRef<HTMLElement>;

    ouvert = false;
    vue: 'accueil' | 'chat' = 'accueil';
    enCours = false;
    saisie = '';
    messages: Message[] = [];

    actions = [
        { id: 'pics', titre: 'Expliquer un pic', sousTitre: 'Volatilité et actualités', icone: 'pi-bolt', couleur: 'text-orange-500', question: 'Quels sont les derniers pics de volatilité et quelles actualités peuvent les expliquer ?' },
        { id: 'volatilite', titre: 'Volatilité', sousTitre: 'Actifs les plus agités', icone: 'pi-chart-line', couleur: 'text-blue-500', question: 'Quels actifs du panier sont les plus volatils actuellement ?' },
        { id: 'actualites', titre: 'Actualités', sousTitre: 'Dernières informations', icone: 'pi-globe', couleur: 'text-green-600', question: 'Quelles sont les dernières actualités importantes pour les actifs suivis ?' },
        { id: 'correlations', titre: 'Corrélations', sousTitre: 'Liens entre actifs', icone: 'pi-sitemap', couleur: 'text-purple-500', question: 'Quels actifs du panier évoluent dans le même sens ou en sens opposés ?' }
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
                this.cdr.markForCheck();
                this.defiler();
            },
            error: () => {
                this.messages.push({
                    auteur: 'ia',
                    texte: 'Désolé, une erreur est survenue. Veuillez réessayer.',
                    heure: new Date()
                });
                this.enCours = false;
                this.cdr.markForCheck();
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
