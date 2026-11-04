import { ChangeDetectorRef, Component, inject, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonDirective } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Paginator, PaginatorState } from 'primeng/paginator';
import { Skeleton } from 'primeng/skeleton';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { Actualite, SourceActualites } from '@/app/models/actif-model';

@Component({
    selector: 'app-actualites',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonDirective, InputText, Skeleton, Paginator],
    templateUrl: './actualites.html',
    styleUrl: './actualites.scss'
})
export class ActualitesComponent implements OnInit, OnChanges {
    private actifService = inject(ActifService);
    private cdr = inject(ChangeDetectorRef);

    @Input() symbole?: string;
    /** Version courte pour le tableau de bord : 5 articles, sans recherche ni pagination. */
    @Input() compact = false;

    actualites: Actualite[] = [];
    sources: SourceActualites[] = [];
    sourceSelectionnee: number | null = null;
    loading = false;
    errorMessage = '';
    recherche = '';
    rechercheAppliquee = '';

    // Pagination
    premier = 0;
    lignes = 10;

    // Sections repliées
    groupesReplies = new Set<string>();

    ngOnInit(): void {
        this.chargerActualites();
        this.chargerSources();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['symbole'] && !changes['symbole'].firstChange) {
            this.chargerActualites();
        }
    }

    chargerActualites(): void {
        this.loading = true;
        this.errorMessage = '';
        this.sourceSelectionnee = null;
        this.premier = 0;

        this.actifService.getActualites(this.symbole).subscribe({
            next: (reponse: any) => {
                this.actualites = Array.isArray(reponse) ? reponse : (reponse?.results ?? []);
                this.loading = false;
                this.cdr.detectChanges();
            },
            error: (erreur) => {
                console.error('Erreur lors du chargement des actualités :', erreur);
                this.actualites = [];
                this.errorMessage = 'Vérifie ta connexion au serveur, puis réessaie.';
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    chargerSources(): void {
        this.actifService.getSources().subscribe({
            next: (reponse: any) => {
                this.sources = Array.isArray(reponse) ? reponse : (reponse?.results ?? []);
                this.cdr.detectChanges();
            },
            error: (erreur) => console.error('Erreur lors du chargement des sources :', erreur)
        });
    }

    sourcesDisponibles(): SourceActualites[] {
        return this.sources.filter((source) => this.actualites.some((actualite) => actualite.source === source.id));
    }

    actualitesFiltrees(): Actualite[] {
        const terme = this.rechercheAppliquee.trim().toLowerCase();

        return this.actualites.filter((actualite) => {
            const correspondSource = this.sourceSelectionnee === null || actualite.source === this.sourceSelectionnee;
            const contenu = `${actualite.titre} ${actualite.contenu} ${actualite.source_nom}`.toLowerCase();

            return correspondSource && contenu.includes(terme);
        });
    }

    /** Articles de la page affichée, sans l'article principal. */
    actualitesPage(): Actualite[] {
        if (this.compact) return this.actualitesFiltrees().slice(0, 5);
        return this.actualitesFiltrees().slice(1).slice(this.premier, this.premier + this.lignes);
    }

    /** Articles de la page, regroupés par date dans l'ordre de la liste. */
    groupesPage(): { titre: string; articles: Actualite[] }[] {
        const groupes: { titre: string; articles: Actualite[] }[] = [];

        for (const actualite of this.actualitesPage()) {
            const titre = this.titreGroupe(actualite.date_publication);
            const groupe = groupes.find((g) => g.titre === titre);

            if (groupe) groupe.articles.push(actualite);
            else groupes.push({ titre, articles: [actualite] });
        }

        return groupes;
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

    estReplie(titre: string): boolean {
        return this.groupesReplies.has(titre);
    }

    basculerGroupe(titre: string): void {
        if (!this.groupesReplies.delete(titre)) this.groupesReplies.add(titre);
    }

    /** Une couleur stable par source, comme les icônes de la Watchlist. */
    couleurSource(nom: string | null | undefined): string {
        const couleurs = ['#2962ff', '#d32f2f', '#00897b', '#7b1fa2', '#ef6c00', '#455a64'];
        const somme = [...(nom ?? '')].reduce((total, lettre) => total + lettre.charCodeAt(0), 0);
        return couleurs[somme % couleurs.length];
    }

    changerPage(evenement: PaginatorState, conteneur: HTMLElement): void {
        this.premier = evenement.first ?? 0;
        this.lignes = evenement.rows ?? this.lignes;
        conteneur.scrollTo({ top: 0 });
    }

    rechercherActualites(): void {
        this.rechercheAppliquee = this.recherche;
        this.premier = 0;
    }

    changerSource(sourceId: number | null): void {
        this.sourceSelectionnee = sourceId;
        this.premier = 0;
    }

    reinitialiserFiltres(): void {
        this.recherche = '';
        this.rechercheAppliquee = '';
        this.sourceSelectionnee = null;
        this.premier = 0;
    }

    /** Les flux RSS contiennent souvent du HTML : on n'affiche que le texte. */
    texteSimple(contenu: string | null | undefined): string {
        if (!contenu) return '';
        const document = new DOMParser().parseFromString(contenu, 'text/html');
        return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
    }

    tempsEcoule(date: string | null): string {
        if (!date) return '';

        const h = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
        if (h < 1) return "Il y a moins d'1 h";
        if (h < 24) return `Il y a ${h} h`;
        return `Il y a ${Math.floor(h / 24)} j`;
    }
}
