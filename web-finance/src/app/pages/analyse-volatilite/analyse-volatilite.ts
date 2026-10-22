
import { Component, DestroyRef, inject, input, OnInit, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, of } from 'rxjs';

import { HeaderVolatile } from '@/app/pages/commons/header-volatile/header-volatile';
import { IndicateursVolatile } from '@/app/pages/commons/indicateurs-volatile/indicateurs-volatile';
import { GraphVolatile } from '@/app/pages/commons/graph-volatile/graph-volatile';
import { CorrelationsActifs } from '@/app/pages/commons/correlations-actifs/correlations-actifs';
import { MouvementsInhabituels } from '@/app/pages/commons/mouvements-inhabituels/mouvements-inhabituels';
import { ActifService } from '@/app/pages/service/service/actif-service';
import {
    ActifOption,
    AnalyseVolatiliteParams,
    MouvementInhabituel, OngletVolatilite,
    ResultatAnalyseVolatilite
} from '@/app/models/model';

@Component({
    selector: 'app-analyse-volatilite',
    standalone: true,
    // @if / @else n'ont pas besoin d'import (syntaxe native Angular)
    imports: [HeaderVolatile],
    templateUrl: './analyse-volatilite.html',
    styleUrl: './analyse-volatilite.scss'
})
export class AnalyseVolatilite implements OnInit {
    // Onglet actuellement mis en avant (fourni par la page)
    ongletActif = input<string>('volatilite');

    // Émis quand l'utilisateur clique sur un onglet
    ongletChange = output<string>();

    readonly onglets: OngletVolatilite[] = [
        { id: 'volatilite', label: 'Volatilité des derniers jours' },
        { id: 'indicateurs', label: 'Indicateurs' },
        { id: 'correlations', label: 'Corrélation entre actifs' },
        { id: 'mouvements', label: 'Mouvements inhabituels' }
    ];

    selectionner(id: string): void {
        this.ongletChange.emit(id);
    }

    private readonly volatiliteService = inject(ActifService);
    private readonly destroyRef = inject(DestroyRef);

    // Actifs proposés dans le sélecteur
    actifsDisponibles: ActifOption[] = [];

    // Filtres de la dernière analyse lancée
    actifsSelectionnes: string[] = [];
    periodeSelectionnee = 30;

    // État de l'interface
    chargement = false;
    erreur: string | null = null;

    // Résultats affichés par les composants enfants
    resultatAnalyse: ResultatAnalyseVolatilite | null = null;

    resultat: MouvementInhabituel[] = [];

    ngOnInit(): void {
        this.chargerActifs();
    }

    /** Récupère les actifs disponibles auprès du backend. */
    chargerActifs(): void {
        this.volatiliteService
            .getActifsDisponibles()
            .pipe(
                catchError((error: unknown) => {
                    console.error('Erreur lors du chargement des actifs :', error);
                    this.erreur = 'Impossible de charger les actifs disponibles.';
                    return of([] as ActifOption[]);
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((actifs: ActifOption[]) => {
                this.actifsDisponibles = actifs ?? [];
                if (this.actifsDisponibles.length > 0) {
                    this.erreur = null;
                }
            });
    }

    /** Déclenchée au clic sur Analyser dans le composant header. */
    lancerAnalyse(params: AnalyseVolatiliteParams): void {
        if (this.chargement) {
            return;
        }

        if (!params.actifs || params.actifs.length === 0) {
            this.erreur = 'Sélectionnez au moins un actif.';
            return;
        }

        if (!Number.isFinite(params.periode) || params.periode <= 0) {
            this.erreur = 'Sélectionnez une période valide.';
            return;
        }

        this.actifsSelectionnes = [...params.actifs];
        this.periodeSelectionnee = params.periode;

        this.chargement = true;
        this.erreur = null;
        this.resultatAnalyse = null;

        this.volatiliteService
            .analyserVolatilite(params)
            .pipe(
                catchError((error: unknown) => {
                    console.error('Erreur lors de l’analyse de la volatilité :', error);
                    this.erreur = 'Une erreur est survenue lors de l’analyse. Réessayez.';
                    return of(null);
                }),
                finalize(() => {
                    this.chargement = false;
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((resultat: ResultatAnalyseVolatilite | null) => {
                if (!resultat) {
                    return;
                }
                this.resultatAnalyse = resultat;
            });
    }

    /** Relance l'analyse avec les derniers filtres. */
    actualiserAnalyse(): void {
        if (this.actifsSelectionnes.length === 0) {
            this.erreur = 'Sélectionnez au moins un actif.';
            return;
        }

        this.lancerAnalyse({
            actifs: [...this.actifsSelectionnes],
            periode: this.periodeSelectionnee
        });
    }

    /** Efface les résultats et les erreurs. */
    reinitialiserAnalyse(): void {
        if (this.chargement) {
            return;
        }

        this.actifsSelectionnes = [];
        this.periodeSelectionnee = 30;
        this.resultatAnalyse = null;
        this.erreur = null;
    }
}












// import { Component, DestroyRef, inject, OnInit } from '@angular/core';
// import { HeaderVolatile } from '@/app/pages/commons/header-volatile/header-volatile';
// import { IndicateursVolatile } from '@/app/pages/commons/indicateurs-volatile/indicateurs-volatile';
// import { GraphVolatile } from '@/app/pages/commons/graph-volatile/graph-volatile';
// import { CorrelationsActifs } from '@/app/pages/commons/correlations-actifs/correlations-actifs';
// import { MouvementsInhabituels } from '@/app/pages/commons/mouvements-inhabituels/mouvements-inhabituels';
// import { ActifService } from '@/app/pages/service/service/actif-service';
// import { ActifOption, AnalyseVolatiliteParams, ResultatAnalyseVolatilite } from '@/app/models/model';
// import { catchError, finalize, of } from 'rxjs';
// import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
//
// @Component({
//     selector: 'app-analyse-volatilite',
//     standalone: true,
//     imports: [HeaderVolatile, IndicateursVolatile, GraphVolatile, CorrelationsActifs, MouvementsInhabituels],
//     templateUrl: './analyse-volatilite.html',
//     styleUrl: './analyse-volatilite.scss'
// })
// export class AnalyseVolatilite implements OnInit {
//     private readonly volatiliteService = inject(ActifService);
//     private readonly destroyRef = inject(DestroyRef);
//
//     // Actifs proposés dans le sélecteur
//     actifsDisponibles: ActifOption[] = [];
//
//     // Filtres courants
//     actifsSelectionnes: string[] = [];
//     periodeSelectionnee = 30;
//
//     // État de l'interface
//     chargement = false;
//     erreur: string | null = null;
//
//     // Résultats affichés par les composants enfants
//     resultatAnalyse: ResultatAnalyseVolatilite | null = null;
//
//     ngOnInit(): void {
//         this.chargerActifs();
//     }
//
//     /**
//      * Récupère les actifs disponibles auprès du backend.
//      */
//     chargerActifs(): void {
//         this.volatiliteService.getActifsDisponibles()
//             .pipe(
//                 catchError((error: unknown) => {
//                     console.error(
//                         'Erreur lors du chargement des actifs :',
//                         error
//                     );
//
//                     this.erreur = 'Impossible de charger les actifs disponibles.';
//                     return of([] as ActifOption[]);
//                 }),
//                 takeUntilDestroyed(this.destroyRef)
//             )
//             .subscribe((actifs: ActifOption[]) => {
//                 this.actifsDisponibles = actifs;
//             });
//     }
//
//     /**
//      * Déclenchée lorsque l'utilisateur clique sur Analyser
//      * dans HeaderVolatileComponent.
//      */
//     lancerAnalyse(params: AnalyseVolatiliteParams): void {
//         if (this.chargement) {
//             return;
//         }
//
//         if (!params.actifs || params.actifs.length === 0) {
//             this.erreur = 'Sélectionnez au moins un actif.';
//             return;
//         }
//
//         if (!Number.isFinite(params.periode) || params.periode <= 0) {
//             this.erreur = 'Sélectionnez une période valide.';
//             return;
//         }
//
//         this.actifsSelectionnes = [...params.actifs];
//         this.periodeSelectionnee = params.periode;
//
//         this.chargement = true;
//         this.erreur = null;
//         this.resultatAnalyse = null;
//
//         this.volatiliteService.analyserVolatilite(params)
//             .pipe(
//                 catchError((error: unknown) => {
//                     console.error(
//                         'Erreur lors de l’analyse de la volatilité :',
//                         error
//                     );
//
//                     this.erreur =
//                         'Une erreur est survenue lors de l’analyse. Réessayez.';
//
//                     return of(null);
//                 }),
//                 finalize(() => {
//                     this.chargement = false;
//                 }),
//                 takeUntilDestroyed(this.destroyRef)
//             )
//             .subscribe((resultat: ResultatAnalyseVolatilite | null) => {
//                 if (!resultat) {
//                     return;
//                 }
//
//                 this.resultatAnalyse = resultat;
//             });
//     }
//
//     /**
//      * Relance l'analyse avec les derniers filtres.
//      */
//     actualiserAnalyse(): void {
//         if (this.actifsSelectionnes.length === 0) {
//             this.erreur = 'Sélectionnez au moins un actif.';
//             return;
//         }
//
//         this.lancerAnalyse({
//             actifs: [...this.actifsSelectionnes],
//             periode: this.periodeSelectionnee
//         });
//     }
//
//     /**
//      * Efface les résultats et les erreurs.
//      */
//     reinitialiserAnalyse(): void {
//         if (this.chargement) {
//             return;
//         }
//
//         this.actifsSelectionnes = [];
//         this.periodeSelectionnee = 30;
//         this.resultatAnalyse = null;
//         this.erreur = null;
//     }
// }
