import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, forkJoin, map, Observable, of, switchMap } from 'rxjs';

import type { Analyse, Bougie, Frequence, VolatiliteResponse } from '@/app/models/actif-model';
import { ActifService } from '@/app/pages/service/service/actif-service';

export type Onglet = 'volatilite' | 'pics' | 'correlation' | 'actualites';

/** true si l'API renvoie 0.025 pour 2,5 %. Mets false si elle renvoie déjà 2.5. */
const RATIOS_EN_FRACTION = true;
const FENETRE = 20;
const SEUIL = 2;
const ANALYSE_VIDE: Analyse = { volatilite: null, pics: null, correlations: null, covariances: {}, actualites: null };

function nombre(valeur: unknown): number | null {
    if (valeur === null || valeur === undefined || valeur === '') return null;
    const n = Number(valeur);
    return Number.isFinite(n) ? n : null;
}

function covariance(a: number[], b: number[]): number | null {
    if (a.length < 3) return null;
    const moyenneA = a.reduce((s, v) => s + v, 0) / a.length;
    const moyenneB = b.reduce((s, v) => s + v, 0) / b.length;
    return a.reduce((s, v, i) => s + (v - moyenneA) * (b[i] - moyenneB), 0) / (a.length - 1);
}

@Component({
    selector: 'app-analyse-actif',
    standalone: true,
    imports: [DatePipe],
    templateUrl: './analyse-actif.html',
    styleUrl: './analyse-actif.scss'
})
export class AnalyseActif {
    private readonly actifService = inject(ActifService);

    /** Actif de référence */
    readonly symbole = input.required<string>();
    /** Actifs sélectionnés dans la page */
    readonly actifs = input<{ symbole: string }[]>([]);
    /** Bougies affichées : elles donnent les dates de la période choisie */
    readonly lignes = input<Bougie[]>([]);
    /** La page charge encore les cours : il est trop tôt pour dire qu'il n'y en a aucun. */
    readonly enChargement = input(false);
    /** Demande à la page d'expliquer un pic : envoie l'horodatage de son maximum. */
    readonly expliquerPic = output<string>();

    readonly fenetre = FENETRE;
    readonly onglets: { id: Onglet; label: string; icone: string }[] = [
        { id: 'volatilite', label: 'Volatilité', icone: 'pi-wave-pulse' },
        { id: 'pics', label: 'Mouvements inhabituels', icone: 'pi-bolt' },
        { id: 'correlation', label: 'Corrélation', icone: 'pi-th-large' },
        { id: 'actualites', label: 'Actualités', icone: 'pi-megaphone' }
    ];
    readonly onglet = signal<Onglet>('volatilite');
    readonly chargement = signal(true);
    readonly donnees = signal<Analyse>(ANALYSE_VIDE);

    /** L'API accepte 10 actifs au maximum ; la référence est toujours incluse. */
    readonly symboles = computed(() => {
        const liste = [this.symbole(), ...this.actifs().map((a) => a.symbole)];
        return [...new Set(liste)].slice(0, 10);
    });

    private readonly periode = computed(() => {
        // reduce, car Math.min(...) peut planter sur des dizaines de milliers de bougies.
        const lignes = this.lignes();
        if (!lignes.length) return null;
        return {
            debut: lignes.reduce((min, l) => Math.min(min, l.time), Infinity),
            fin: lignes.reduce((max, l) => Math.max(max, l.time), -Infinity)
        };
    });

    /** Fréquence adaptée à la durée, pour garder assez de bougies pour l'écart-type glissant. */
    readonly frequence = computed((): Frequence => {
        const p = this.periode();
        const jours = p ? (p.fin - p.debut) / 86400 : 0;
        if (jours <= 2) return '15min';
        if (jours <= 30) return '1h';
        return '1j';
    });

    readonly sansCours = computed(() => !this.periode() && !this.enChargement());

    readonly pics = computed(() =>
        [...(this.donnees().pics?.pics ?? [])].sort((a, b) => b.debut.localeCompare(a.debut))
    );

    readonly courbe = computed(() => {
        const points = (this.donnees().volatilite?.serie ?? [])
            .map((p) => ({ t: new Date(p.horodatage).getTime(), v: nombre(p.volatilite) }))
            .filter((p): p is { t: number; v: number } => p.v !== null && Number.isFinite(p.t))
            .sort((a, b) => a.t - b.t);
        if (points.length < 2) return null;

        const limite = nombre(this.donnees().pics?.limite);
        const valeurs = points.map((p) => p.v);
        const min = Math.min(...valeurs, limite ?? Infinity);
        const max = Math.max(...valeurs, limite ?? -Infinity);
        const debut = points[0].t;
        const fin = points[points.length - 1].t;
        // Coordonnées en % : le tracé s'adapte à la largeur disponible
        const x = (t: number) => ((t - debut) / (fin - debut || 1)) * 100;
        const y = (v: number) => 94 - ((v - min) / (max - min || 1)) * 86;
        const trace = points.map((p) => `${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');

        const reperes = this.pics().flatMap((pic) => {
            const t = new Date(pic.horodatage_max).getTime();
            const v = nombre(pic.volatilite_max);
            if (v === null || t < debut || t > fin) return [];
            return [{ x: x(t), y: Math.min(94, Math.max(8, y(v))), titre: `Pic du ${new Date(t).toLocaleString()} : ${this.pourcent(v)}` }];
        });

        return {
            trace,
            aire: `0,100 ${trace} 100,100`,
            reperes,
            graduations: [max, min + (max - min) * (2 / 3), min + (max - min) / 3, min].map((v) => ({ y: y(v), texte: this.pourcent(v) })),
            limite: limite === null ? null : { y: y(limite), texte: this.pourcent(limite) },
            dates: [debut, (debut + fin) / 2, fin]
        };
    });

    /** Identifie la demande : l'API n'est rappelée que si la période ou les actifs changent. */
    private readonly demande = computed(() => {
        const p = this.periode();
        return p ? JSON.stringify({ symboles: this.symboles(), debut: p.debut, fin: p.fin, frequence: this.frequence() }) : '';
    });

    constructor() {
        toObservable(this.demande)
            .pipe(
                debounceTime(100),
                switchMap((cle) => {
                    // Sans cours sur la période, on n'affiche pas l'analyse de la période précédente.
                    if (!cle) return of(ANALYSE_VIDE);
                    this.chargement.set(true);
                    return this.charger();
                }),
                takeUntilDestroyed()
            )
            .subscribe((donnees) => {
                this.donnees.set(donnees);
                this.chargement.set(false);
            });
    }

    private charger(): Observable<Analyse> {
        const symbole = this.symbole();
        const symboles = this.symboles();
        const p = this.periode()!;
        const debut = new Date(p.debut * 1000).toISOString();
        const fin = new Date(p.fin * 1000).toISOString();
        const frequence = this.frequence();

        return forkJoin({
            series: forkJoin(
                symboles.map((s) => this.actifService.getVolatilite(s, frequence, FENETRE, debut, fin).pipe(catchError(() => of(null))))
            ),
            pics: this.actifService.getPics(symbole, frequence, FENETRE, SEUIL, debut, fin).pipe(catchError(() => of(null))),
            correlations:
                symboles.length < 2
                    ? of(null)
                    : this.actifService.getCorrelations(symboles, frequence, debut, fin).pipe(catchError(() => of(null))),
            actualites: this.actifService.getActualites(symbole).pipe(
                map((articles) => articles.slice(0, 10)),
                catchError(() => of(null))
            )
        }).pipe(
            map(({ series, pics, correlations, actualites }) => ({
                volatilite: series[symboles.indexOf(symbole)],
                pics,
                correlations,
                covariances: this.calculerCovariances(symboles, series),
                actualites
            }))
        );
    }

    /** Covariance sur les dates communes à chaque paire, car les cryptos cotent aussi le week-end. */
    private calculerCovariances(symboles: string[], series: (VolatiliteResponse | null)[]): Record<string, Record<string, number | null>> {
        const rendements = series.map((serie) => {
            const parDate = new Map<string, number>();
            for (const p of serie?.serie ?? []) {
                const r = nombre(p.rendement);
                if (r !== null) parDate.set(p.horodatage, r);
            }
            return parDate;
        });

        const resultat: Record<string, Record<string, number | null>> = {};
        symboles.forEach((a, i) => {
            resultat[a] = {};
            symboles.forEach((b, j) => {
                const dates = [...rendements[i].keys()].filter((d) => rendements[j].has(d));
                resultat[a][b] = covariance(dates.map((d) => rendements[i].get(d)!), dates.map((d) => rendements[j].get(d)!));
            });
        });
        return resultat;
    }

    classeSigne(v: unknown): string {
        const n = nombre(v) ?? 0;
        return n > 0 ? 'hausse' : n < 0 ? 'baisse' : '';
    }

    valeur(v: unknown): number | null {
        return nombre(v);
    }

    pourcent(v: unknown): string {
        const n = nombre(v);
        if (n === null) return '—';
        return `${(RATIOS_EN_FRACTION ? n * 100 : n).toFixed(2)} %`;
    }

    decimal(v: unknown): string {
        const n = nombre(v);
        return n === null ? '—' : n.toFixed(2);
    }

    scientifique(v: unknown): string {
        const n = nombre(v);
        if (n === null) return '—';
        return n !== 0 && Math.abs(n) < 0.001 ? n.toExponential(2) : n.toFixed(4);
    }

    couleurCorrelation(v: unknown): string {
        const n = nombre(v);
        if (n === null) return 'transparent';
        const teinte = n >= 0 ? '8, 153, 129' : '242, 54, 69';
        return `rgba(${teinte}, ${(Math.min(Math.abs(n), 1) * 0.45).toFixed(2)})`;
    }
}
