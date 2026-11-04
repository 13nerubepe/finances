import { Component, computed, inject, Input, OnChanges, OnInit, signal, SimpleChanges } from '@angular/core';
import { NgClass, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { Skeleton } from 'primeng/skeleton';
import { catchError, forkJoin, of } from 'rxjs';

import { ActifService } from '@/app/pages/service/service/actif-service';
import { Actif, Actualite } from '@/app/models/actif-model';

export type CategorieId = 'action' | 'indice' | 'crypto' | 'general';

interface Categorie {
    id: CategorieId;
    libelle: string;
    description: string;
    icone: string;
    couleur: string;
}

interface ActifIndexe {
    actif: Actif;
    nomCourt: string;
    motifs: RegExp[];
}

export interface ArticleClasse extends Actualite {
    actifs: Actif[];
    categories: CategorieId[];
    resume: string;
}

interface Groupe {
    titre: string;
    articles: ArticleClasse[];
}

const CATEGORIES: Categorie[] = [
    { id: 'action', libelle: 'Actions', description: 'Entreprises cotées', icone: 'pi-briefcase', couleur: 'var(--cat-action)' },
    { id: 'indice', libelle: 'Indices', description: 'S&P 500, CAC 40…', icone: 'pi-chart-bar', couleur: 'var(--cat-indice)' },
    { id: 'crypto', libelle: 'Cryptomonnaies', description: 'Bitcoin, Ethereum…', icone: 'pi-bitcoin', couleur: 'var(--cat-crypto)' },
    { id: 'general', libelle: 'Marchés & économie', description: 'Macro, taux, conjoncture', icone: 'pi-globe', couleur: 'var(--cat-general)' }
];

const PREFIXE_YAHOO = 'Yahoo Finance - ';
const SUFFIXES_NOM = /[\s,]+(inc\.?|corp\.?|corporation|co\.?|company|ltd\.?|limited|plc|s\.?a\.?|usd)$/i;
const ARTICLES_COMPACT = 5;

function nomCourt(nom: string): string {
    let resultat = nom.trim();
    let nettoye = resultat.replace(SUFFIXES_NOM, '').trim();
    while (nettoye !== resultat) {
        resultat = nettoye;
        nettoye = resultat.replace(SUFFIXES_NOM, '').trim();
    }
    return resultat;
}

function echapper(texte: string): string {
    return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function motMotif(mot: string, drapeaux: string): RegExp {
    return new RegExp(`(^|[^\\p{L}\\p{N}])${echapper(mot)}($|[^\\p{L}\\p{N}])`, drapeaux);
}

@Component({
    selector: 'app-actualites',
    standalone: true,
    imports: [NgClass, NgTemplateOutlet, FormsModule, ButtonDirective, InputText, Skeleton, Paginator],
    templateUrl: './actualites.html',
    styleUrl: './actualites.scss'
})
export class ActualitesComponent implements OnInit, OnChanges {
    private readonly actifService = inject(ActifService);

    @Input() symbole?: string;
    @Input() compact = false;

    readonly categories = CATEGORIES;

    readonly articles = signal<ArticleClasse[]>([]);
    readonly loading = signal(false);
    readonly errorMessage = signal('');
    readonly onglet = signal<CategorieId>('action');
    readonly actifSelectionne = signal<string | null>(null);
    readonly recherche = signal('');
    readonly premier = signal(0);
    readonly lignes = signal(10);
    readonly groupesReplies = signal<Set<string>>(new Set());

    readonly articlesRecherches = computed(() => {
        const terme = this.recherche().trim().toLowerCase();
        if (!terme) return this.articles();
        return this.articles().filter((article) =>
            `${article.titre} ${article.resume} ${article.source_nom} ${article.actifs.map((a) => `${a.symbole} ${a.nom}`).join(' ')}`.toLowerCase().includes(terme)
        );
    });

    readonly compteurs = computed(() => {
        const compteurs: Record<CategorieId, number> = { action: 0, indice: 0, crypto: 0, general: 0 };
        for (const article of this.articlesRecherches()) {
            for (const categorie of article.categories) compteurs[categorie]++;
        }
        return compteurs;
    });

    readonly categorieActive = computed(() => this.categorie(this.onglet()));

    readonly autresCategories = computed(() => CATEGORIES.filter((c) => c.id !== this.onglet() && this.compteurs()[c.id] > 0));

    readonly articlesOnglet = computed(() => {
        const onglet = this.onglet();
        return this.articlesRecherches().filter((article) => article.categories.includes(onglet));
    });

    readonly actifsOnglet = computed(() => {
        const compte = new Map<string, { actif: Actif; nombre: number }>();
        const onglet = this.onglet();
        for (const article of this.articlesOnglet()) {
            for (const actif of article.actifs) {
                if (onglet !== 'general' && actif.type_actif !== onglet) continue;
                const entree = compte.get(actif.symbole) ?? { actif, nombre: 0 };
                entree.nombre++;
                compte.set(actif.symbole, entree);
            }
        }
        return [...compte.values()].sort((a, b) => b.nombre - a.nombre || a.actif.symbole.localeCompare(b.actif.symbole));
    });

    readonly totalOnglet = computed(() => this.articlesOnglet().length);

    readonly articlesFiltres = computed(() => {
        const symbole = this.actifSelectionne();
        if (!symbole) return this.articlesOnglet();
        return this.articlesOnglet().filter((article) => article.actifs.some((a) => a.symbole === symbole));
    });

    readonly principale = computed(() => (this.compact || this.premier() > 0 ? null : (this.articlesFiltres()[0] ?? null)));

    readonly totalListe = computed(() => Math.max(this.articlesFiltres().length - (this.compact ? 0 : 1), 0));

    readonly groupesPage = computed<Groupe[]>(() => {
        const articles = this.compact
            ? this.articlesFiltres().slice(0, ARTICLES_COMPACT)
            : this.articlesFiltres()
                  .slice(1)
                  .slice(this.premier(), this.premier() + this.lignes());

        const groupes: Groupe[] = [];
        for (const article of articles) {
            const titre = this.titreGroupe(article.date_publication);
            const groupe = groupes.find((g) => g.titre === titre);
            if (groupe) groupe.articles.push(article);
            else groupes.push({ titre, articles: [article] });
        }
        return groupes;
    });

    ngOnInit(): void {
        this.chargerActualites();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['symbole'] && !changes['symbole'].firstChange) {
            this.chargerActualites();
        }
    }

    chargerActualites(): void {
        this.loading.set(true);
        this.errorMessage.set('');
        this.premier.set(0);

        forkJoin({
            articles: this.actifService.getActualites(this.symbole),
            actifs: this.actifService.getAssets().pipe(catchError(() => of([] as Actif[])))
        }).subscribe({
            next: ({ articles, actifs }) => {
                const liste: Actualite[] = Array.isArray(articles) ? articles : ((articles as { results?: Actualite[] })?.results ?? []);
                const index = this.indexer(actifs ?? []);
                this.articles.set(liste.map((article) => this.classer(article, index)));
                this.choisirOngletDisponible();
                this.loading.set(false);
            },
            error: (erreur) => {
                console.error('Erreur lors du chargement des actualités :', erreur);
                this.articles.set([]);
                this.errorMessage.set('Vérifie ta connexion au serveur, puis réessaie.');
                this.loading.set(false);
            }
        });
    }

    private indexer(actifs: Actif[]): ActifIndexe[] {
        return actifs.map((actif) => {
            const court = nomCourt(actif.nom);
            const base = actif.symbole.replace(/^\^/, '').split('-')[0];
            const motifs: RegExp[] = [];
            if (court.length >= 3) motifs.push(motMotif(court, 'iu'));
            if (base.length >= 3) motifs.push(motMotif(base, 'u'));
            return { actif, nomCourt: court, motifs };
        });
    }

    private classer(article: Actualite, index: ActifIndexe[]): ArticleClasse {
        const source = article.source_nom ?? '';
        const cible = source.startsWith(PREFIXE_YAHOO) ? source.slice(PREFIXE_YAHOO.length).trim().toLowerCase() : null;
        const titre = article.titre ?? '';

        const actifs = index
            .filter(({ actif, nomCourt, motifs }) => actif.symbole.toLowerCase() === cible || nomCourt.toLowerCase() === cible || motifs.some((motif) => motif.test(titre)))
            .map(({ actif }) => actif);

        const categories = new Set<CategorieId>(actifs.map((actif) => actif.type_actif));
        if (article.themes?.includes('Cryptomonnaies')) categories.add('crypto');
        if (!categories.size) categories.add('general');

        return {
            ...article,
            actifs,
            categories: CATEGORIES.map((c) => c.id).filter((id) => categories.has(id)),
            resume: this.texteSimple(article.contenu)
        };
    }

    private choisirOngletDisponible(): void {
        if (this.compteurs()[this.onglet()] > 0) return;
        const premiere = CATEGORIES.find((c) => this.compteurs()[c.id] > 0);
        if (premiere) this.onglet.set(premiere.id);
    }

    choisirOnglet(onglet: CategorieId): void {
        this.onglet.set(onglet);
        this.actifSelectionne.set(null);
        this.premier.set(0);
    }

    choisirActif(symbole: string | null): void {
        this.actifSelectionne.set(this.actifSelectionne() === symbole ? null : symbole);
        this.premier.set(0);
    }

    rechercher(texte: string): void {
        this.recherche.set(texte);
        this.premier.set(0);
    }

    reinitialiserFiltres(): void {
        this.recherche.set('');
        this.actifSelectionne.set(null);
        this.premier.set(0);
        this.choisirOngletDisponible();
    }

    changerPage(evenement: PaginatorState, conteneur: HTMLElement): void {
        this.premier.set(evenement.first ?? 0);
        this.lignes.set(evenement.rows ?? this.lignes());
        conteneur.scrollTo({ top: 0, behavior: 'smooth' });
    }

    estReplie(titre: string): boolean {
        return this.groupesReplies().has(titre);
    }

    basculerGroupe(titre: string): void {
        const replies = new Set(this.groupesReplies());
        if (!replies.delete(titre)) replies.add(titre);
        this.groupesReplies.set(replies);
    }

    categorie(id: CategorieId): Categorie {
        return CATEGORIES.find((c) => c.id === id)!;
    }

    categoriePrincipale(article: ArticleClasse): Categorie {
        const onglet = this.onglet();
        return this.categorie(article.categories.includes(onglet) ? onglet : article.categories[0]);
    }

    actifsAffiches(article: ArticleClasse): Actif[] {
        const onglet = this.onglet();
        const actifs = onglet === 'general' ? article.actifs : article.actifs.filter((a) => a.type_actif === onglet);
        return actifs.slice(0, 3);
    }

    libelleActif(actif: Actif): string {
        return actif.type_actif === 'indice' ? nomCourt(actif.nom) : actif.symbole.replace(/-USD$/, '');
    }

    sousTitreActif(actif: Actif): string {
        const court = nomCourt(actif.nom);
        return court === this.libelleActif(actif) ? actif.symbole : court;
    }

    part(nombre: number): number {
        const total = this.totalOnglet();
        return total ? Math.round((nombre / total) * 100) : 0;
    }

    sourceCourte(article: ArticleClasse): string {
        return (article.source_nom || 'Source inconnue').split(' - ')[0];
    }

    teinte(couleur: string): string {
        return `color-mix(in srgb, ${couleur} 12%, transparent)`;
    }

    private titreGroupe(date: string | null): string {
        if (!date) return 'Date inconnue';

        const jour = new Date(date);
        const aujourdhui = new Date();
        const hier = new Date();
        hier.setDate(hier.getDate() - 1);

        if (jour.toDateString() === aujourdhui.toDateString()) return "Aujourd'hui";
        if (jour.toDateString() === hier.toDateString()) return 'Hier';
        return 'Plus ancien';
    }

    private texteSimple(contenu: string | null | undefined): string {
        if (!contenu) return '';
        const document = new DOMParser().parseFromString(contenu, 'text/html');
        return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
    }

    tempsEcoule(date: string | null): string {
        if (!date) return '';

        const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
        if (minutes < 60) return `Il y a ${Math.max(minutes, 1)} min`;
        const heures = Math.floor(minutes / 60);
        if (heures < 24) return `Il y a ${heures} h`;
        const jours = Math.floor(heures / 24);
        if (jours < 7) return `Il y a ${jours} j`;
        return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }
}
