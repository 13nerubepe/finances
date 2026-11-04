import { ChangeDetectorRef, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Observable } from 'rxjs';

import type { Actif } from '@/app/models/actif-model';
import { ActifService } from '@/app/pages/service/service/actif-service';

type Intention = 'pics' | 'volatilite' | 'actualites' | 'correlations';

interface Source {
    texte: string;
    lien?: string;
}

interface OptionMessage {
    label: string;
    action: () => void;
}

interface Message {
    auteur: 'user' | 'ia';
    texte: string;
    sources?: Source[];
    options?: OptionMessage[];
    heure: Date;
}

/** true si l'API renvoie 0.025 pour 2,5 %, comme dans analyse-actif. */
const RATIOS_EN_FRACTION = true;
const SEUIL_SENS = 0.3;
/** Les pics de l'agent sont journaliers : la fenêtre compte 20 bougies d'un jour. */
const FENETRE = 20;
const SEUIL_PIC = 2;
const JOURS_PICS = 400;
const JOURS_ANALYSE = 90;
const MAX_ACTIFS_CORRELATION = 10;
const AIDE =
    'Je n\'ai pas encore de route pour répondre à une question libre. Je peux vous aider avec un symbole, par exemple :\n' +
    '• « pics AAPL »\n• « explique AAPL 2026-10-25 »\n• « volatilité BTC-USD »\n• « corrélation AAPL MSFT »\n• « actualités AAPL »';

function ilYa(jours: number): string {
    return new Date(Date.now() - jours * 86400000).toISOString();
}

@Component({
    selector: 'app-assistant-ai',
    imports: [NgIf, NgFor, NgClass, DatePipe, FormsModule, ButtonDirective, Dialog, InputText],
    templateUrl: './assistant-ai.html',
    styleUrl: './assistant-ai.scss'
})
export class AssistantAi {
    private readonly actifService = inject(ActifService);
    private readonly cdr = inject(ChangeDetectorRef);
    private readonly router = inject(Router);

    @ViewChild('zoneMessages') zoneMessages?: ElementRef<HTMLElement>;

    ouvert = false;
    vue: 'accueil' | 'chat' = 'accueil';
    enCours = false;
    saisie = '';
    messages: Message[] = [];

    /** Action en attente d'un symbole, posée à la question précédente. */
    private attente: Intention | null = null;

    actions: { id: Intention; titre: string; sousTitre: string; icone: string; couleur: string; question: string }[] = [
        { id: 'pics', titre: 'Expliquer un pic', sousTitre: 'Volatilité et actualités', icone: 'pi-bolt', couleur: 'text-orange-500', question: 'Expliquer un pic' },
        { id: 'volatilite', titre: 'Volatilité', sousTitre: 'Sur les 90 derniers jours', icone: 'pi-chart-line', couleur: 'text-blue-500', question: 'Volatilité d\'un actif' },
        { id: 'actualites', titre: 'Actualités', sousTitre: 'Dernières informations', icone: 'pi-globe', couleur: 'text-green-600', question: 'Dernières actualités' },
        { id: 'correlations', titre: 'Corrélations', sousTitre: 'Liens entre actifs', icone: 'pi-sitemap', couleur: 'text-purple-500', question: 'Corrélations entre actifs' }
    ];

    basculer(): void {
        this.ouvert = !this.ouvert;
        if (this.ouvert && this.vue === 'chat') this.defiler();
    }

    onAction(id: string): void {
        const action = this.actions.find((a) => a.id === id);
        if (action) this.envoyer(action.question, action.id);
    }

    envoyer(texte: string, intention?: Intention): void {
        const question = texte?.trim();
        if (!question || this.enCours) return;

        this.vue = 'chat';
        this.ajouter({ auteur: 'user', texte: question });
        this.saisie = '';
        this.enCours = true;

        this.actifService.getAssets().subscribe({
            next: (actifs) => this.traiter(question, actifs, intention),
            error: () => {
                this.repondre('Impossible de charger la liste des actifs. Vérifiez que le serveur est lancé.');
            }
        });
    }

    /** Choisit la route de l'API d'après le symbole, la date et les mots de la question. */
    private traiter(question: string, actifs: Actif[], choisie?: Intention): void {
        const symboles = this.trouverSymboles(question, actifs);
        const jour = this.trouverJour(question);
        const intention = choisie ?? this.trouverIntention(question) ?? this.attente;
        const contexte = this.actifDeLaPage(actifs);
        this.attente = null;

        if (jour && (symboles[0] ?? contexte)) {
            this.expliquer(symboles[0] ?? contexte!, jour);
        } else if (intention === 'correlations' || symboles.length >= 2) {
            this.correlations(symboles);
        } else if (intention === 'actualites') {
            this.actualites(symboles[0] ?? contexte);
        } else if (!intention && !symboles.length) {
            this.repondre(AIDE);
        } else if (!symboles[0] && !contexte) {
            this.attente = intention ?? 'pics';
            this.repondre('De quel actif s\'agit-il ? Indiquez son symbole, par exemple AAPL.');
        } else if (intention === 'volatilite') {
            this.volatilite(symboles[0] ?? contexte!);
        } else {
            this.pics(symboles[0] ?? contexte!);
        }
    }

    private pics(symbole: string): void {
        this.charger(this.actifService.getPics(symbole, '1j', FENETRE, SEUIL_PIC, ilYa(JOURS_PICS)), ({ pics }) => {
            const recents = [...(pics ?? [])].sort((a, b) => b.horodatage_max.localeCompare(a.horodatage_max)).slice(0, 5);
            if (!recents.length) {
                this.repondre(`Aucun mouvement inhabituel trouvé pour ${symbole} sur la dernière année.`);
                return;
            }
            this.repondre(`Derniers pics de ${symbole}. Lequel voulez-vous expliquer ?`, {
                options: recents.map((pic) => {
                    const jour = new Date(pic.horodatage_max).toISOString().slice(0, 10);
                    return { label: `${jour} (${this.pourcent(pic.variation_prix)})`, action: () => this.demanderExplication(symbole, jour) };
                })
            });
        });
    }

    private demanderExplication(symbole: string, jour: string): void {
        if (this.enCours) return;
        this.vue = 'chat';
        this.ajouter({ auteur: 'user', texte: `Expliquer le pic de ${symbole} du ${jour}` });
        this.enCours = true;
        this.expliquer(symbole, jour);
    }

    private expliquer(symbole: string, jour: string): void {
        this.actifService.getExplicationPic(symbole, jour).subscribe({
            next: (reponse) =>
                this.repondre(`${reponse.texte}\n\nExplication plausible générée par ${reponse.modele}, à vérifier avec les sources.`, {
                    sources: this.lireSources(reponse.sources)
                }),
            error: (erreur: HttpErrorResponse) =>
                this.repondre(
                    erreur.status === 404
                        ? `Je n'ai pas d'indicateur pour ${symbole} le ${jour}. Essayez une date listée par « pics ${symbole} ».`
                        : 'L\'assistant n\'a pas pu répondre. Veuillez réessayer.'
                )
        });
    }

    private volatilite(symbole: string): void {
        this.charger(this.actifService.getVolatilite(symbole, '1j', FENETRE, ilYa(JOURS_ANALYSE)), ({ resume }) =>
            this.repondre(
                `${symbole} sur les 90 derniers jours :\n• Volatilité actuelle : ${this.pourcent(resume.volatilite_derniere)}\n` +
                `• Amplitude : ${this.pourcent(resume.amplitude_periode)}\n• Rendement : ${this.pourcent(resume.rendement_periode)}`
            )
        );
    }

    private correlations(symboles: string[]): void {
        if (symboles.length < 2) {
            this.attente = 'correlations';
            this.repondre('Indiquez au moins 2 symboles, par exemple : AAPL MSFT.');
            return;
        }

        const liste = symboles.slice(0, MAX_ACTIFS_CORRELATION);
        this.charger(this.actifService.getCorrelations(liste, '1j', ilYa(JOURS_ANALYSE)), ({ correlations }) => {
            const lignes: string[] = [];
            liste.forEach((a, i) => {
                for (const b of liste.slice(i + 1)) {
                    const valeur = correlations[a]?.[b];
                    if (valeur === null || valeur === undefined) {
                        lignes.push(`• ${a} / ${b} : données insuffisantes`);
                    } else {
                        const n = Number(valeur);
                        const sens = n >= SEUIL_SENS ? 'même sens' : n <= -SEUIL_SENS ? 'sens opposés' : 'pas de lien net';
                        lignes.push(`• ${a} / ${b} : ${sens} (${n.toFixed(2)})`);
                    }
                }
            });
            this.repondre(`Corrélations sur les 90 derniers jours :\n${lignes.join('\n')}`);
        });
    }

    private actualites(symbole: string | null): void {
        this.charger(this.actifService.rechercherActualites(symbole ?? undefined), (articles) => {
            if (!articles.length) {
                this.repondre(symbole ? `Aucun article trouvé pour « ${symbole} ».` : 'Aucun article disponible.');
                return;
            }
            this.repondre(symbole ? `Derniers articles trouvés pour « ${symbole} » :` : 'Derniers articles :', {
                sources: articles.map((a) => ({ texte: `${a.titre} (${a.source_nom})`, lien: a.lien }))
            });
        });
    }

    private charger<T>(requete: Observable<T>, succes: (donnees: T) => void): void {
        requete.subscribe({
            next: succes,
            error: () => this.repondre('Désolé, une erreur est survenue. Veuillez réessayer.')
        });
    }

    /** Cherche les symboles exacts, ou le premier mot du nom (« Apple » pour « Apple Inc. »). */
    private trouverSymboles(question: string, actifs: Actif[]): string[] {
        const mots = question
            .split(/[\s,;:?!()«»"']+/)
            .map((m) => m.replace(/\.+$/, '').toUpperCase())
            .filter(Boolean);
        const trouves: string[] = [];

        for (const mot of mots) {
            const actif =
                actifs.find((a) => a.symbole.toUpperCase() === mot) ??
                (mot.length >= 4 ? actifs.find((a) => a.nom.split(/\s+/)[0].toUpperCase() === mot) : undefined);
            if (actif && !trouves.includes(actif.symbole)) trouves.push(actif.symbole);
        }
        return trouves;
    }

    private trouverJour(question: string): string | null {
        const iso = question.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
        if (iso) return iso[0];
        const fr = question.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/);
        return fr ? `${fr[3]}-${fr[2]}-${fr[1]}` : null;
    }

    private trouverIntention(question: string): Intention | null {
        const texte = question.toLowerCase();
        if (/corr[ée]l|m[êe]me sens|sens oppos/.test(texte)) return 'correlations';
        if (/actualit|article|news/.test(texte)) return 'actualites';
        if (/\bpics?\b|expliqu/.test(texte)) return 'pics';
        if (/volatil/.test(texte)) return 'volatilite';
        return null;
    }

    /** Sur la page détail, le dernier segment de l'adresse est le symbole de l'actif. */
    private actifDeLaPage(actifs: Actif[]): string | null {
        const segment = decodeURIComponent(this.router.url.split(/[?#]/)[0].split('/').pop() ?? '');
        return actifs.find((a) => a.symbole === segment)?.symbole ?? null;
    }

    /** L'API envoie les sources en un seul texte : liste JSON, ou une source par ligne. */
    private lireSources(texte: string | null | undefined): Source[] {
        const brut = texte?.trim();
        if (!brut) return [];

        let liste: unknown[] = brut.split(/\r?\n/);
        try {
            const donnees: unknown = JSON.parse(brut);
            if (Array.isArray(donnees)) liste = donnees;
        } catch {
            // Ce n'est pas du JSON : on garde le découpage par ligne.
        }
        return liste
            .map((s) => String(s).trim())
            .filter(Boolean)
            .map((s) => (/^https?:\/\//i.test(s) ? { texte: s, lien: s } : { texte: s }));
    }

    private pourcent(valeur: unknown): string {
        const n = valeur === null || valeur === undefined || valeur === '' ? NaN : Number(valeur);
        return Number.isFinite(n) ? `${(RATIOS_EN_FRACTION ? n * 100 : n).toFixed(2)} %` : '—';
    }

    private repondre(texte: string, extra: Pick<Message, 'sources' | 'options'> = {}): void {
        this.enCours = false;
        this.ajouter({ auteur: 'ia', texte, ...extra });
    }

    private ajouter(message: Omit<Message, 'heure'>): void {
        this.messages.push({ ...message, heure: new Date() });
        this.cdr.markForCheck();
        this.defiler();
    }

    private defiler(): void {
        setTimeout(() => {
            const el = this.zoneMessages?.nativeElement;
            if (el) el.scrollTop = el.scrollHeight;
        });
    }
}
