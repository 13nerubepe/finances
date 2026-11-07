import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/** Question envoyée à l'assistant depuis une autre page (par exemple un clic sur le graphique). */
export interface DemandeAssistant {
    /** Texte affiché dans la conversation. */
    affichage: string;
    /** Question complète envoyée à l'agent, avec tout le contexte utile. */
    question: string;
    symboles: string[];
}

/** Relie les pages à l'assistant flottant : une page pose la question, l'assistant s'ouvre et répond. */
@Injectable({ providedIn: 'root' })
export class AssistantPont {
    private readonly demandes = new Subject<DemandeAssistant>();
    readonly demandes$ = this.demandes.asObservable();

    demander(demande: DemandeAssistant): void {
        this.demandes.next(demande);
    }
}
