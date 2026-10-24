
import {
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    ViewChild
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';

import {
    AreaSeries,
    BarSeries,
    BaselineSeries,
    CandlestickSeries,
    ColorType,
    createChart,
    LineSeries
} from 'lightweight-charts';

import type {
    IChartApi,
    ISeriesApi,
    SeriesType,
    Time,
    UTCTimestamp,
    CandlestickData,
    BarData,
    LineData,
    BaselineData
} from 'lightweight-charts';

import type {
    Actif,
    FiltresCours,
    HistoricalPrice,
    Bougie,
    Periode
} from '@/app/models/actif-model';

import { ActifService } from '@/app/pages/service/service/actif-service';

type TypeGraphe = 'candle' | 'line' | 'area' | 'bar' | 'baseline';

@Component({
    selector: 'app-detail-actif',
    standalone: true,
    imports: [CommonModule, Button, Tag, Tooltip],
    templateUrl: './detail-actif.html'
})
export class DetailActif implements OnInit, OnDestroy {

    actif?: Actif;

    loading = false;
    chargementGraphe = false;

    errorMessage = '';
    erreurGraphe = '';

    // Périodes disponibles
    periodes: Periode[] = [
        { label: '7J', value: '7J', jours: 7, frequence: 'daily' },
        { label: '1M', value: '1M', jours: 30, frequence: 'daily' },
        { label: '3M', value: '3M', jours: 90, frequence: 'daily' },
        { label: '6M', value: '6M', jours: 182, frequence: 'weekly' },
        { label: '1A', value: '1A', jours: 365, frequence: 'weekly' },
        { label: '5A', value: '5A', jours: 1825, frequence: 'monthly' }
    ];

    // Types de graphiques
    typesGraphe: {
        value: TypeGraphe;
        label: string;
        icon: string;
    }[] = [
        { value: 'candle', label: 'Chandeliers', icon: 'pi pi-chart-bar' },
        { value: 'line', label: 'Ligne', icon: 'pi pi-chart-line' },
        { value: 'area', label: 'Aire', icon: 'pi pi-chart-scatter' },
        { value: 'bar', label: 'Barres', icon: 'pi pi-align-justify' },
        { value: 'baseline', label: 'Baseline', icon: 'pi pi-arrows-v' }
    ];

    periode = '3M';
    typeGraphe: TypeGraphe = 'candle';

    bougies: Bougie[] = [];

    private chart?: IChartApi;
    private serie?: ISeriesApi<SeriesType>;
    private container?: HTMLDivElement;

    private actifSub?: Subscription;
    private histSub?: Subscription;

    @ViewChild('chartContainer')
    set chartContainer(el: ElementRef<HTMLDivElement> | undefined) {
        if (el) {
            const nouveauConteneur = el.nativeElement;

            if (this.container !== nouveauConteneur || !this.chart) {
                this.detruireGraphique();
                this.container = nouveauConteneur;
                this.creerGraphique();
            }
        } else {
            this.detruireGraphique();
        }
    }

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private actifService: ActifService
    ) {}

    ngOnInit(): void {
        this.actualiser();
    }

    ngOnDestroy(): void {
        this.actifSub?.unsubscribe();
        this.histSub?.unsubscribe();
        this.detruireGraphique();
    }

    // ---------- Chargement de l'actif ----------

    actualiser(): void {
        const parametre =
            this.route.snapshot.paramMap.get('actifId')
            ?? this.route.snapshot.paramMap.get('id');

        const id = Number(parametre);

        if (
            !parametre ||
            !Number.isInteger(id) ||
            id <= 0
        ) {
            this.errorMessage = "Identifiant d'actif manquant ou invalide.";
            return;
        }

        this.loading = true;
        this.errorMessage = '';

        this.actifSub?.unsubscribe();

        this.actifSub = this.actifService.getAssetById(id).subscribe({
            next: (actif: Actif) => {
                this.actif = actif;
                this.loading = false;
                this.chargerHistorique();
            },
            error: (err) => {
                console.error(
                    "Erreur lors du chargement de l'actif :",
                    err
                );

                this.actif = undefined;
                this.loading = false;

                const introuvable =
                    err?.status === 404 ||
                    /introuvable/i.test(err?.message ?? '');

                this.errorMessage = introuvable
                    ? 'Actif introuvable.'
                    : 'Impossible de charger les données du marché.';
            }
        });
    }

    // ---------- Chargement des cours historiques ----------

    chargerHistorique(): void {
        if (!this.actif) {
            return;
        }

        const periode = this.periodeCourante;

        const fin = new Date();
        const debut = new Date();

        debut.setDate(debut.getDate() - periode.jours);

        const filtres: FiltresCours = {
            actifId: this.actif.actifId,
            dateDebut: this.formaterDate(debut),
            dateFin: this.formaterDate(fin),
            frequence: periode.frequence
        };

        this.chargementGraphe = true;
        this.erreurGraphe = '';

        this.histSub?.unsubscribe();

        this.histSub = this.actifService
            .getAssetHistory(filtres)
            .subscribe({
                next: (cours: HistoricalPrice[]) => {
                    this.bougies = this.versBougies(cours);
                    this.chargementGraphe = false;

                    if (this.bougies.length === 0) {
                        this.erreurGraphe =
                            'Aucun cours historique disponible pour cette période.';
                    }

                    this.dessiner();
                },
                error: (err) => {
                    console.error(
                        "Erreur lors du chargement de l'historique :",
                        err
                    );

                    this.bougies = [];
                    this.erreurGraphe =
                        "Impossible de charger l'historique des cours.";

                    this.chargementGraphe = false;
                    this.dessiner();
                }
            });
    }

    // ---------- Navigation ----------

    retour(): void {
        this.router.navigate(['/actifs']);
    }

    // ---------- Actions utilisateur ----------

    changerPeriode(value: string): void {
        if (value === this.periode) {
            return;
        }

        this.periode = value;
        this.chargerHistorique();
    }

    changerType(type: TypeGraphe): void {
        if (type === this.typeGraphe) {
            return;
        }

        this.typeGraphe = type;
        this.dessiner();
    }

    // ---------- Indicateurs ----------

    get periodeCourante(): Periode {
        return this.periodes.find(
            (p) => p.value === this.periode
        ) ?? this.periodes[2];
    }

    get plusHaut(): number {
        return this.bougies.length
            ? Math.max(...this.bougies.map((b) => b.high))
            : 0;
    }

    get plusBas(): number {
        return this.bougies.length
            ? Math.min(...this.bougies.map((b) => b.low))
            : 0;
    }

    get performance(): number {
        if (!this.bougies.length) {
            return 0;
        }

        const debut = this.bougies[0].open;
        const fin = this.bougies[this.bougies.length - 1].close;

        return debut !== 0
            ? +(((fin - debut) / debut) * 100).toFixed(2)
            : 0;
    }

    get dernierVolume(): number | null {
        if (this.actif?.volume != null) {
            return this.actif.volume;
        }

        return this.bougies.length
            ? this.bougies[this.bougies.length - 1].volume
            : null;
    }

    // ---------- Transformation des données ----------

    private formaterDate(date: Date): string {
        return date.toISOString().slice(0, 10);
    }

    /**
     * Convertit les cours historiques en données pour le graphique.
     * Les dates sont converties en timestamps Unix en secondes.
     * Les cours sont triés chronologiquement et les doublons supprimés.
     */
    private versBougies(cours: HistoricalPrice[]): Bougie[] {
        const parTemps = new Map<number, Bougie>();

        for (const c of cours ?? []) {
            const ms = Date.parse(c.date);

            if (!Number.isFinite(ms) || c.close == null) {
                continue;
            }

            const time = Math.floor(ms / 1000) as UTCTimestamp;

            const open = c.open ?? c.close;
            const high = c.high ?? Math.max(open, c.close);
            const low = c.low ?? Math.min(open, c.close);

            parTemps.set(time, {
                time,
                open,
                high,
                low,
                close: c.close,
                volume: c.volume ?? 0
            });
        }

        return [...parTemps.values()].sort(
            (a, b) => Number(a.time) - Number(b.time)
        );
    }

    // ---------- Création du graphique ----------

    private creerGraphique(): void {
        const conteneur = this.container;

        if (!conteneur) {
            return;
        }

        // Évite de conserver plusieurs graphiques sur le même conteneur.
        this.chart?.remove();
        this.chart = undefined;
        this.serie = undefined;

        const css = getComputedStyle(document.documentElement);

        const texte =
            css.getPropertyValue('--p-text-muted-color').trim()
            || '#64748b';

        const grille =
            css.getPropertyValue('--p-content-border-color').trim()
            || '#e2e8f0';

        this.chart = createChart(conteneur, {
            autoSize: true,

            layout: {
                background: {
                    type: ColorType.Solid,
                    color: 'transparent'
                },
                textColor: texte
            },

            grid: {
                vertLines: { color: grille },
                horzLines: { color: grille }
            },

            rightPriceScale: {
                borderColor: grille
            },

            timeScale: {
                borderColor: grille,
                timeVisible: false
            },

            crosshair: {
                mode: 1
            }
        });

        this.dessiner();
    }

    private detruireGraphique(): void {
        this.chart?.remove();

        this.chart = undefined;
        this.serie = undefined;
        this.container = undefined;
    }

    // ---------- Affichage des séries ----------

    private dessiner(): void {
        if (!this.chart) {
            return;
        }

        if (this.serie) {
            this.chart.removeSeries(this.serie);
            this.serie = undefined;
        }

        if (this.bougies.length === 0) {
            return;
        }

        const haussier = '#22c55e';
        const baissier = '#ef4444';

        // Chaque tableau possède le type attendu par sa série.
        const donneesChandeliers: CandlestickData<Time>[] =
            this.bougies.map(({ time, open, high, low, close }) => ({
                time: time as Time,
                open,
                high,
                low,
                close
            }));

        const donneesBarres: BarData<Time>[] =
            this.bougies.map(({ time, open, high, low, close }) => ({
                time: time as Time,
                open,
                high,
                low,
                close
            }));

        const donneesLigne: LineData<Time>[] =
            this.bougies.map(({ time, close }) => ({
                time: time as Time,
                value: close
            }));

        const donneesBaseline: BaselineData<Time>[] =
            this.bougies.map(({ time, close }) => ({
                time: time as Time,
                value: close
            }));

        switch (this.typeGraphe) {
            case 'candle': {
                const serie = this.chart.addSeries(
                    CandlestickSeries,
                    {
                        upColor: haussier,
                        downColor: baissier,
                        borderVisible: false,
                        wickUpColor: haussier,
                        wickDownColor: baissier
                    }
                );

                serie.setData(donneesChandeliers);
                this.serie = serie;
                break;
            }

            case 'bar': {
                const serie = this.chart.addSeries(
                    BarSeries,
                    {
                        upColor: haussier,
                        downColor: baissier
                    }
                );

                serie.setData(donneesBarres);
                this.serie = serie;
                break;
            }

            case 'line': {
                const serie = this.chart.addSeries(
                    LineSeries,
                    {
                        color: '#f97316',
                        lineWidth: 2
                    }
                );

                serie.setData(donneesLigne);
                this.serie = serie;
                break;
            }

            case 'area': {
                const serie = this.chart.addSeries(
                    AreaSeries,
                    {
                        lineColor: '#f97316',
                        topColor: 'rgba(249,115,22,0.35)',
                        bottomColor: 'rgba(249,115,22,0.02)',
                        lineWidth: 2
                    }
                );

                serie.setData(donneesLigne);
                this.serie = serie;
                break;
            }

            case 'baseline': {
                const serie = this.chart.addSeries(
                    BaselineSeries,
                    {
                        baseValue: {
                            type: 'price',
                            price: this.bougies[0].open
                        },
                        topLineColor: haussier,
                        topFillColor1: 'rgba(34,197,94,0.3)',
                        topFillColor2: 'rgba(34,197,94,0.02)',
                        bottomLineColor: baissier,
                        bottomFillColor1: 'rgba(239,68,68,0.02)',
                        bottomFillColor2: 'rgba(239,68,68,0.3)'
                    }
                );

                serie.setData(donneesBaseline);
                this.serie = serie;
                break;
            }
        }

        this.chart.timeScale().fitContent();
    }
}

