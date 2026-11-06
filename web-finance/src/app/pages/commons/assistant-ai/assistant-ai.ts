import { ChangeDetectorRef, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonDirective } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Observable } from 'rxjs';

import type { Actif, ExplicationPic } from '@/app/models/actif-model';
import { apiErrorMessage } from '@/app/models/api-errors';
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
    html?: string;
    sources?: Source[];
    options?: OptionMessage[];
    heure: Date;
}

/** true si l'API renvoie 0.025 pour 2,5 %, comme dans analyse-actif. */
const RATIOS_EN_FRACTION = true;
const SEUIL_SENS = 0.3;
/** La volatilité est calculée sur une fenêtre de 20 bougies d'un jour. */
const FENETRE = 20;
const JOURS_ANALYSE = 90;
const MAX_ACTIFS_CORRELATION = 10;
/** Au-delà, ce n'est plus un raccourci mais une question pour l'agent. */
const MAX_MOTS_COMMANDE = 5;
const AIDE =
    'Vous pouvez aussi utiliser un raccourci avec un symbole, par exemple :\n' +
    '• « pics AAPL »\n• « explique AAPL 2026-10-25 »\n• « volatilité BTC-USD »\n• « corrélation AAPL MSFT »\n• « actualités AAPL »';

function echapper(texte: string): string {
    return texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function enLigne(texte: string): string {
    return echapper(texte)
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function formater(texte: string): string {
    const blocs: string[] = [];
    let liste: { type: 'ul' | 'ol'; items: string[] } | null = null;
    let paragraphe: string[] = [];

    const fermerParagraphe = () => {
        if (paragraphe.length) blocs.push(`<p>${paragraphe.join('<br>')}</p>`);
        paragraphe = [];
    };
    const fermerListe = () => {
        if (liste) blocs.push(`<${liste.type}>${liste.items.map((item) => `<li>${item}</li>`).join('')}</${liste.type}>`);
        liste = null;
    };

    for (const brute of (texte ?? '').replace(/\r/g, '').split('\n')) {
        const ligne = brute.trim();
        const puce = ligne.match(/^(?:[-*•])\s+(.*)$/);
        const numero = ligne.match(/^\d+[.)]\s+(.*)$/);
        const titre = ligne.match(/^#{1,6}\s+(.*)$/);

        if (!ligne) {
            fermerParagraphe();
            fermerListe();
        } else if (puce || numero) {
            fermerParagraphe();
            const type = puce ? 'ul' : 'ol';
            if (liste && liste.type !== type) fermerListe();
            liste ??= { type, items: [] };
            liste.items.push(enLigne((puce ?? numero)![1]));
        } else if (titre) {
            fermerParagraphe();
            fermerListe();
            blocs.push(`<p class="titre">${enLigne(titre[1])}</p>`);
        } else {
            fermerListe();
            paragraphe.push(enLigne(ligne));
        }
    }
    fermerParagraphe();
    fermerListe();
    return blocs.join('');
}

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

    /** L'historique n'est chargé qu'à la première ouverture. */
    private historiqueCharge = false;

    basculer(): void {
        this.ouvert = !this.ouvert;
        if (this.ouvert && !this.historiqueCharge) this.chargerHistorique();
        if (this.ouvert && this.vue === 'chat') this.defiler();
    }

    private chargerHistorique(): void {
        this.historiqueCharge = true;
        this.actifService.getHistorique().subscribe({
            next: (historique) => {
                if (!historique.length) return;
                const anciens: Message[] = historique.map((m) => ({
                    auteur: m.role === 'user' ? 'user' : 'ia',
                    texte: m.contenu,
                    html: m.role === 'user' ? undefined : formater(m.contenu),
                    heure: new Date(m.dateCreation)
                }));
                this.messages = [...anciens, ...this.messages];
                this.vue = 'chat';
                this.cdr.markForCheck();
                this.defiler();
            },
            // Sans historique, l'assistant reste utilisable : on réessaiera à la prochaine ouverture.
            error: () => (this.historiqueCharge = false)
        });
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

    /** Choisit la route de l'API d'après le symbole, la date et les mots de la question.
     *  Sans mot-clé de raccourci, la question part à l'agent LLM. */
    private traiter(question: string, actifs: Actif[], choisie?: Intention): void {
        const symboles = this.trouverSymboles(question, actifs);
        const jour = this.trouverJour(question);
        const contexte = this.actifDeLaPage(actifs);
        // Un bouton ou une réponse à « De quel actif ? » est toujours une commande ; une phrase libre part à l'agent.
        const commande = !!choisie || !!this.attente || this.estCommande(question);
        const intention = commande ? (choisie ?? this.trouverIntention(question) ?? this.attente) : null;
        this.attente = null;

        if (!commande) {
            this.questionLibre(question, symboles.length ? symboles : contexte ? [contexte] : []);
        } else if (jour && (symboles[0] ?? contexte)) {
            this.expliquer(symboles[0] ?? contexte!, jour);
        } else if (!intention) {
            this.questionLibre(question, symboles.length ? symboles : contexte ? [contexte] : []);
        } else if (intention === 'correlations') {
            this.correlations(symboles);
        } else if (intention === 'actualites') {
            this.actualites(symboles[0] ?? contexte);
        } else if (!symboles[0] && !contexte) {
            this.attente = intention ?? 'pics';
            this.repondre('De quel actif s\'agit-il ? Indiquez son symbole, par exemple AAPL.');
        } else if (intention === 'volatilite') {
            this.volatilite(symboles[0] ?? contexte!);
        } else {
            this.pics(symboles[0] ?? contexte!);
        }
    }

    /** Question sans raccourci : l'agent LLM répond avec le contexte des portefeuilles de l'utilisateur. */
    private questionLibre(question: string, symboles: string[]): void {
        this.actifService.envoyerMessage({ message: question, ...(symboles.length ? { symboles } : {}) }).subscribe({
            next: (reponse) =>
                this.repondre(reponse.reponse, {
                    sources: (reponse.sources ?? []).map((s) => ({ texte: s.titre || s.url, lien: s.url || undefined }))
                }),
            error: (erreur: unknown) => this.repondre(`${apiErrorMessage(erreur, 'L\'assistant n\'a pas pu répondre.')}\n\n${AIDE}`)
        });
    }

    /** Pics enregistrés en base : ce sont ceux que l'agent sait expliquer. */
    private pics(symbole: string): void {
        this.charger(this.actifService.getPicsJournaliers({ symbole }), (pics) => {
            const recents = pics.slice(0, 5);
            if (!recents.length) {
                this.repondre(`Aucun pic journalier enregistré pour ${symbole}.`);
                return;
            }
            this.repondre(`Derniers pics de ${symbole}. Lequel voulez-vous expliquer ?`, {
                options: recents.map((pic) => ({
                    label: `${pic.date} (${pic.variation === null ? '—' : `${pic.variation.toFixed(2)} %`})${pic.explication_disponible ? ' ✓' : ''}`,
                    action: () => this.demanderExplication(symbole, pic.date)
                }))
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

    /** Raccourci : « pics AAPL », « volatilité BTC-USD », « corrélation AAPL MSFT ». Une vraie question (« ? », phrase longue) va à l'agent. */
    private estCommande(question: string): boolean {
        return !question.includes('?') && question.trim().split(/\s+/).length <= MAX_MOTS_COMMANDE;
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

    /** L'API envoie les sources sous forme de liste { titre, url }. */
    private lireSources(sources: ExplicationPic['sources'] | null | undefined): Source[] {
        return (sources ?? [])
            .filter((s) => s?.url || s?.titre)
            .map((s) => ({ texte: s.titre || s.url, lien: s.url || undefined }));
    }

    private pourcent(valeur: unknown): string {
        const n = valeur === null || valeur === undefined || valeur === '' ? NaN : Number(valeur);
        return Number.isFinite(n) ? `${(RATIOS_EN_FRACTION ? n * 100 : n).toFixed(2)} %` : '—';
    }

    private repondre(texte: string, extra: Pick<Message, 'sources' | 'options'> = {}): void {
        this.enCours = false;
        this.ajouter({ auteur: 'ia', texte, ...extra });
    }

    choisirOption(message: Message, option: OptionMessage): void {
        if (this.enCours) return;
        message.options = undefined;
        option.action();
    }

    domaine(lien: string | undefined): string {
        if (!lien) return '';
        try {
            return new URL(lien).hostname.replace(/^www\./, '');
        } catch {
            return '';
        }
    }

    private ajouter(message: Omit<Message, 'heure'>): void {
        const html = message.auteur === 'ia' ? formater(message.texte) : undefined;
        this.messages.push({ ...message, html, heure: new Date() });
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
