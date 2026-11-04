import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { catchError, forkJoin, map, of, Subject, Subscription, switchMap } from 'rxjs';

import { Button } from 'primeng/button';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';

import {
    AreaSeries,
    BarSeries,
    BaselineSeries,
    CandlestickSeries,
    ColorType,
    createChart,
    CrosshairMode,
    HistogramSeries,
    LineSeries,
    LineStyle,
    PriceScaleMode
} from 'lightweight-charts';
import type { IChartApi, ISeriesApi, MouseEventParams, SeriesType, UTCTimestamp } from 'lightweight-charts';

import type { Actif, Bougie, FiltresCours, HistoricalPrice } from '@/app/models/actif-model';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { AnalyseActif } from '@/app/pages/commons/analyse-actif/analyse-actif';

type TypeGraphe = 'candle' | 'line' | 'area' | 'bar' | 'baseline';
type ModeGraphe = 'cours' | 'base100';

interface SerieActif {
    actif: Actif;
    points: Bougie[];
    parTemps: Map<number, Bougie>;
    enErreur: boolean;
}

interface StatsActif {
    perf: number | null;
    volatilite: number | null;
    ouverture: number | null;
    haut: number | null;
    bas: number | null;
    dernier: number | null;
    volume: number | null;
}

interface LegendeCours {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    variation: number;
}

interface LegendeBase100 {
    symbole: string;
    couleur: string;
    valeur: number | null;
}

const COULEUR_HAUSSE = '#089981';
const COULEUR_BAISSE = '#f23645';
const COULEUR_MM20 = '#f7a600';
const COULEUR_MM50 = '#ab47bc';

const STATS_VIDES: StatsActif = { perf: null, volatilite: null, ouverture: null, haut: null, bas: null, dernier: null, volume: null };

@Component({
    selector: 'app-detail-actif',
    standalone: true,
    imports: [CommonModule, FormsModule, Button, MultiSelect, Select, TableModule, Tag, AnalyseActif],
    templateUrl: './detail-actif.html',
    styleUrl: './detail-actif.scss'
})
export class DetailActif implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('zoneGraphique') zoneGraphique?: ElementRef<HTMLDivElement>;
    @ViewChild('panneauGraphique') panneauGraphique?: ElementRef<HTMLElement>;

    // Actifs
    actifs: Actif[] = [];
    selection: Actif[] = [];
    reference: Actif | null = null;
    suggestions: Actif[] = [];

    vueTableau: 'historique' | 'comparaison' = 'historique';

    maxActifs = 5;
    loading = false;
    errorMessage = '';

    // Périodes
    periode = '1mo';
    periodes = [
        { label: '1S', value: '5d' },
        { label: '1M', value: '1mo' },
        { label: '3M', value: '3mo' },
        { label: '6M', value: '6mo' },
        { label: 'YTD', value: 'ytd' },
        { label: '1A', value: '1y' },
        { label: '5A', value: '5y' }
    ];

    // Graphique
    mode: ModeGraphe = 'cours';
    typeGraphe: TypeGraphe = 'candle';
    typesGraphe: { label: string; value: TypeGraphe }[] = [];
    mm20 = false;
    mm50 = false;
    echelleLog = false;
    pleinEcran = false;

    readonly couleurMm20 = COULEUR_MM20;
    readonly couleurMm50 = COULEUR_MM50;

    legendeCours: LegendeCours | null = null;
    legendeBase100: LegendeBase100[] = [];

    private readonly tousLesTypes: { label: string; value: TypeGraphe; ohlc: boolean }[] = [
        { label: 'Chandeliers', value: 'candle', ohlc: true },
        { label: 'Barres', value: 'bar', ohlc: true },
        { label: 'Ligne', value: 'line', ohlc: false },
        { label: 'Aire', value: 'area', ohlc: false },
        { label: 'Ligne de base', value: 'baseline', ohlc: false }
    ];
    private readonly couleurs = ['#2962ff', '#ff6d00', '#00acc1', '#e91e63', '#7e57c2'];

    private series: SerieActif[] = [];
    private stats = new Map<Actif['id'], StatsActif>();
    private chart?: IChartApi;
    private seriesGraphique: ISeriesApi<SeriesType>[] = [];
    private observateurTheme?: MutationObserver;
    private avertissementRoute = '';

    private readonly demandeComparaison$ = new Subject<void>();
    private readonly subscriptions = new Subscription();
    private readonly surChangementPleinEcran = () => {
        this.pleinEcran = document.fullscreenElement === this.panneauGraphique?.nativeElement;
        this.cdr.markForCheck();
    };

    constructor(
        private actifService: ActifService,
        private route: ActivatedRoute,
        private cdr: ChangeDetectorRef
    ) {
        this.typesGraphe = this.tousLesTypes;
    }

    ngOnInit(): void {
        // switchMap annule la requête en cours : une réponse lente ne peut plus écraser une plus récente.
        this.subscriptions.add(
            this.demandeComparaison$.pipe(switchMap(() => this.chargerHistoriques())).subscribe((series) => {
                this.series = series;
                this.calculerStats();
                this.adapterTypesDisponibles();
                this.loading = false;
                this.errorMessage = this.messageErreur(series);
                this.rendreGraphique();
                this.cdr.markForCheck();
            })
        );
        this.chargerActifs();
        document.addEventListener('fullscreenchange', this.surChangementPleinEcran);
    }

    ngAfterViewInit(): void {
        this.creerGraphique();
        this.rendreGraphique();
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
        this.observateurTheme?.disconnect();
        document.removeEventListener('fullscreenchange', this.surChangementPleinEcran);
        this.chart?.remove();
    }

    lignesHistorique(): Bougie[] {
        const serie = this.series.find((s) => s.actif.id === this.reference?.id);
        return serie ? [...serie.points].reverse() : [];
    }

    // --------------------------------------------------
    // CHARGEMENT DES ACTIFS
    // --------------------------------------------------

    private chargerActifs(): void {
        this.loading = true;

        const sub = this.actifService
            .getAssets()
            .pipe(
                switchMap((data: Actif[]) => {
                    this.actifs = data;
                    return this.route.paramMap;
                })
            )
            .subscribe({
                next: (params) => {
                    this.initialiserDepuisRoute(params);
                    this.cdr.markForCheck();
                },
                error: (err) => {
                    console.error('Erreur de chargement des actifs :', err);
                    this.errorMessage = 'Impossible de charger les actifs.';
                    this.loading = false;
                    this.cdr.markForCheck();
                }
            });

        this.subscriptions.add(sub);
    }

    /** L'actif de la route devient la référence, suivi de 2 actifs à comparer. */
    private initialiserDepuisRoute(params: ParamMap): void {
        const parametre = params.get('id') ?? params.get('symbole') ?? params.get('symbol');
        const actifRoute = parametre ? this.actifs.find((a) => String(a.id) === parametre || a.symbole === parametre) : undefined;
        const principal = actifRoute ?? this.actifs[0] ?? null;

        if (!principal) {
            this.loading = false;
            return;
        }

        this.avertissementRoute = parametre && !actifRoute ? `Actif « ${parametre} » introuvable : affichage de ${principal.nom}.` : '';
        this.reference = principal;
        this.selection = [principal, ...this.actifs.filter((a) => a.id !== principal.id).slice(0, 2)];
        this.majSuggestions();
        this.demanderComparaison();
    }

    // --------------------------------------------------
    // GESTION DE LA SELECTION
    // --------------------------------------------------

    onSelectionChange(): void {
        // Le multiselect peut tout vider : l'actif de la page reste toujours affiché.
        if (!this.selection.length && this.reference) {
            this.selection = [this.reference];
        }
        if (this.selection.length > this.maxActifs) {
            this.selection = this.selection.slice(0, this.maxActifs);
        }
        if (!this.selection.some((a) => a.id === this.reference?.id)) {
            this.reference = this.selection[0] ?? null;
        }

        this.mode = this.selection.length > 1 ? 'base100' : 'cours';
        this.majSuggestions();
        this.demanderComparaison();
    }

    ajouter(actif: Actif): void {
        if (this.selection.length >= this.maxActifs || this.selection.some((a) => a.id === actif.id)) return;

        this.selection = [...this.selection, actif];
        this.reference ??= actif;
        this.mode = 'base100';
        this.majSuggestions();
        this.demanderComparaison();
    }

    retirer(actif: Actif): void {
        if (this.selection.length <= 1) return;

        this.selection = this.selection.filter((a) => a.id !== actif.id);
        if (this.reference?.id === actif.id) {
            this.reference = this.selection[0] ?? null;
        }
        if (this.selection.length === 1) {
            this.mode = 'cours';
        }

        this.majSuggestions();
        this.demanderComparaison();
    }

    definirReference(actif: Actif): void {
        this.reference = actif;
        this.majTout();
    }

    majTout(): void {
        this.rendreGraphique();
    }

    private majSuggestions(): void {
        this.suggestions = this.actifs.filter((a) => !this.selection.some((s) => s.id === a.id)).slice(0, 5);
    }

    // --------------------------------------------------
    // COULEURS
    // --------------------------------------------------

    couleur(actif: Actif): string {
        const index = this.selection.findIndex((a) => a.id === actif.id);
        if (index !== -1) return this.couleurs[index % this.couleurs.length];

        const indexActif = this.actifs.findIndex((a) => a.id === actif.id);
        return this.couleurs[Math.max(0, indexActif) % this.couleurs.length];
    }

    // --------------------------------------------------
    // PERIODE ET COMMANDES DU GRAPHIQUE
    // --------------------------------------------------

    changerPeriode(value: string): void {
        this.periode = value;
        this.demanderComparaison();
    }

    get periodeLabel(): string {
        return this.periodes.find((p) => p.value === this.periode)?.label ?? '';
    }

    changerMode(mode: ModeGraphe): void {
        this.mode = mode;
        this.rendreGraphique();
    }

    /** Bouton « Comparer » : recharge les données et affiche les courbes en base 100. */
    comparer(): void {
        this.mode = 'base100';
        this.demanderComparaison();
    }

    basculerMm(periode: 20 | 50): void {
        if (periode === 20) this.mm20 = !this.mm20;
        else this.mm50 = !this.mm50;
        this.rendreGraphique();
    }

    basculerEchelleLog(): void {
        this.echelleLog = !this.echelleLog;
        this.appliquerOptionsEchelle();
    }

    ajusterVue(): void {
        this.chart?.timeScale().fitContent();
    }

    basculerPleinEcran(): void {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            this.panneauGraphique?.nativeElement.requestFullscreen();
        }
    }

    // --------------------------------------------------
    // CHARGEMENT DES HISTORIQUES
    // --------------------------------------------------

    private demanderComparaison(): void {
        if (!this.selection.length) return;
        this.loading = true;
        this.errorMessage = this.avertissementRoute;
        this.demandeComparaison$.next();
    }

    private chargerHistoriques() {
        const actifsSelectionnes = [...this.selection];
        const debut = this.formaterDate(this.calculerDateDebut(this.periode));
        const fin = this.formaterDate(new Date());

        // Une erreur sur un actif ne doit pas faire disparaître les autres.
        const requetes = actifsSelectionnes.map((actif) => {
            const filtres: FiltresCours = { actif: actif.symbole, debut, fin };

            return this.actifService.getAllAssetHistory(filtres).pipe(
                map((response: any) => this.creerSerie(actif, response.results ?? response, false)),
                catchError((err) => {
                    console.error(`Erreur d'historique pour ${actif.symbole} :`, err);
                    return of(this.creerSerie(actif, [], true));
                })
            );
        });

        return forkJoin(requetes);
    }

    private creerSerie(actif: Actif, cours: HistoricalPrice[], enErreur: boolean): SerieActif {
        const parTemps = new Map<number, Bougie>();

        for (const c of cours) {
            const close = this.nombre(c.close);
            const secondes = Math.floor(new Date(c.horodatage).getTime() / 1000);
            if (close === null || Number.isNaN(secondes)) continue;

            parTemps.set(secondes, {
                time: secondes as UTCTimestamp,
                open: this.nombre(c.open) ?? close,
                high: this.nombre(c.high) ?? close,
                low: this.nombre(c.low) ?? close,
                close,
                volume: this.nombre(c.volume) ?? 0
            });
        }

        // Le graphique exige des dates strictement croissantes et sans doublon.
        const points = [...parTemps.values()].sort((a, b) => a.time - b.time);
        return { actif, points, parTemps, enErreur };
    }

    private messageErreur(series: SerieActif[]): string {
        const enErreur = series.filter((s) => s.enErreur).map((s) => s.actif.symbole);
        const historique = enErreur.length ? `Historique indisponible pour : ${enErreur.join(', ')}.` : '';
        return [this.avertissementRoute, historique].filter(Boolean).join(' ');
    }

    private calculerDateDebut(periode: string): Date {
        const date = new Date();

        switch (periode) {
            case '5d':
                date.setDate(date.getDate() - 5);
                break;
            case '1mo':
                date.setMonth(date.getMonth() - 1);
                break;
            case '3mo':
                date.setMonth(date.getMonth() - 3);
                break;
            case '6mo':
                date.setMonth(date.getMonth() - 6);
                break;
            case 'ytd':
                return new Date(Date.UTC(date.getFullYear(), 0, 1));
            case '1y':
                date.setFullYear(date.getFullYear() - 1);
                break;
            case '5y':
                date.setFullYear(date.getFullYear() - 5);
                break;
        }

        return date;
    }

    private formaterDate(date: Date): string {
        return date.toISOString().slice(0, 10);
    }

    // --------------------------------------------------
    // INDICATEURS
    // --------------------------------------------------

    private calculerStats(): void {
        this.stats = new Map(this.series.map((s) => [s.actif.id, this.statsDe(s.points)]));
    }

    private statsDe(points: Bougie[]): StatsActif {
        if (!points.length) return STATS_VIDES;

        const premier = points[0];
        const dernier = points[points.length - 1];

        return {
            perf: points.length > 1 && premier.close ? this.arrondi(((dernier.close - premier.close) / premier.close) * 100) : null,
            volatilite: this.calculerVolatilite(points),
            ouverture: premier.open,
            haut: Math.max(...points.map((p) => p.high)),
            bas: Math.min(...points.map((p) => p.low)),
            dernier: dernier.close,
            volume: dernier.volume
        };
    }

    /** Écart-type des rendements entre deux points, sur la période affichée. */
    private calculerVolatilite(points: Bougie[]): number | null {
        const rendements: number[] = [];
        for (let i = 1; i < points.length; i++) {
            if (points[i - 1].close > 0) {
                rendements.push((points[i].close - points[i - 1].close) / points[i - 1].close);
            }
        }
        if (!rendements.length) return null;

        const moyenne = rendements.reduce((a, b) => a + b, 0) / rendements.length;
        const variance = rendements.reduce((somme, r) => somme + (r - moyenne) ** 2, 0) / rendements.length;
        return this.arrondi(Math.sqrt(variance) * 100);
    }

    statsActif(actif: Actif | null): StatsActif {
        return (actif && this.stats.get(actif.id)) || STATS_VIDES;
    }

    perf(actif: Actif): number | null {
        return this.statsActif(actif).perf;
    }

    volatilite(actif: Actif): number | null {
        return this.statsActif(actif).volatilite;
    }

    prixActuel(actif: Actif | null): number | null {
        if (!actif) return null;
        return this.nombre(actif.prix_actuel) ?? this.statsActif(actif).dernier;
    }

    var24h(actif: Actif | null): number | null {
        if (!actif) return null;
        const variation = this.nombre(actif.variation);
        return variation === null ? null : this.arrondi(variation);
    }

    ecart(actif: Actif): number | null {
        const perfActif = this.perf(actif);
        const perfReference = this.reference ? this.perf(this.reference) : null;
        return perfActif === null || perfReference === null ? null : this.arrondi(perfActif - perfReference);
    }

    get meilleur(): Actif | null {
        return this.plusGrand(this.selection, (a) => this.perf(a));
    }

    get plusVolatil(): Actif | null {
        return this.plusGrand(this.selection, (a) => this.volatilite(a));
    }

    get meilleurVsRef(): Actif | null {
        return this.plusGrand(
            this.selection.filter((a) => a.id !== this.reference?.id),
            (a) => this.ecart(a)
        );
    }

    private plusGrand(actifs: Actif[], valeur: (a: Actif) => number | null): Actif | null {
        let meilleur: Actif | null = null;
        let max = -Infinity;
        for (const actif of actifs) {
            const v = valeur(actif);
            if (v !== null && v > max) {
                max = v;
                meilleur = actif;
            }
        }
        return meilleur;
    }

    /** Largeur de la barre de performance, de 0 à 50 % de part et d'autre de l'axe central. */
    largeurBarre(actif: Actif): number {
        const max = Math.max(1, ...this.selection.map((a) => Math.abs(this.perf(a) ?? 0)));
        return (Math.abs(this.perf(actif) ?? 0) / max) * 50;
    }

    /** Position du prix (0 à 100 %) entre le plus bas et le plus haut de la période. */
    get positionFourchette(): number {
        const { haut, bas } = this.statsActif(this.reference);
        const prix = this.prixActuel(this.reference);
        if (prix === null || haut === null || bas === null || haut === bas) return 0;
        return Math.min(100, Math.max(0, ((prix - bas) / (haut - bas)) * 100));
    }

    // --------------------------------------------------
    // FORMATAGE
    // --------------------------------------------------

    formaterPrix(valeur: number | null | undefined): string {
        if (valeur === null || valeur === undefined) return '—';
        const decimales = Math.abs(valeur) > 0 && Math.abs(valeur) < 1 ? 4 : 2;
        return valeur.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
    }

    formaterVolume(valeur: number | null | undefined): string {
        if (valeur === null || valeur === undefined) return '—';
        return valeur.toLocaleString('fr-FR', { notation: 'compact', maximumFractionDigits: 2 });
    }

    /** Valeur signée : « +1,25 % », ou « — » si la donnée manque. */
    formaterVariation(valeur: number | null, suffixe = ' %'): string {
        if (valeur === null) return '—';
        const signe = valeur > 0 ? '+' : '';
        return `${signe}${valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffixe}`;
    }

    classeVariation(valeur: number | null): string {
        if (valeur === null || valeur === 0) return 'neutre';
        return valeur > 0 ? 'hausse' : 'baisse';
    }

    private nombre(valeur: unknown): number | null {
        if (valeur === null || valeur === undefined || valeur === '') return null;
        const n = Number(valeur); // Les API renvoient souvent les décimaux sous forme de texte.
        return Number.isFinite(n) ? n : null;
    }

    private arrondi(valeur: number): number {
        return Number(valeur.toFixed(2));
    }

    // --------------------------------------------------
    // GRAPHIQUE
    // --------------------------------------------------

    private get serieReference(): SerieActif | undefined {
        return this.series.find((s) => s.actif.id === this.reference?.id);
    }

    private adapterTypesDisponibles(): void {
        // Sans vraies données d'ouverture/haut/bas, des chandeliers seraient plats : on les masque.
        const ohlc = this.series.some((s) => s.points.some((p) => p.open !== p.close || p.high !== p.low));
        this.typesGraphe = this.tousLesTypes.filter((t) => ohlc || !t.ohlc);
        if (!this.typesGraphe.some((t) => t.value === this.typeGraphe)) {
            this.typeGraphe = 'area';
        }
    }

    private creerGraphique(): void {
        const conteneur = this.zoneGraphique?.nativeElement;
        if (!conteneur) return;

        this.chart = createChart(conteneur, {
            autoSize: true,
            crosshair: { mode: CrosshairMode.Normal },
            rightPriceScale: { borderVisible: false },
            timeScale: { borderVisible: false, rightOffset: 4 },
            localization: { locale: 'fr-FR' }
        });
        this.appliquerTheme();
        this.chart.subscribeCrosshairMove((param) => {
            this.majLegende(param);
            this.cdr.markForCheck();
        });

        // Suit le passage clair/sombre de l'application.
        this.observateurTheme = new MutationObserver(() => this.appliquerTheme());
        this.observateurTheme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    }

    private appliquerTheme(): void {
        const racine = document.documentElement.classList;
        const sombre = racine.contains('app-dark') || racine.contains('dark');
        const grille = sombre ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

        this.chart?.applyOptions({
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: sombre ? '#b2b5be' : '#5d606b',
                attributionLogo: true
            },
            grid: { vertLines: { color: grille }, horzLines: { color: grille } }
        });
    }

    private appliquerOptionsEchelle(): void {
        this.chart?.applyOptions({
            rightPriceScale: { mode: this.echelleLog ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal }
        });
    }

    private rendreGraphique(): void {
        if (!this.chart) return;

        this.seriesGraphique.forEach((s) => this.chart?.removeSeries(s));
        this.seriesGraphique = [];

        if (this.mode === 'base100') {
            this.dessinerBase100();
        } else {
            this.dessinerCours();
        }

        const tousLesPoints = this.series.flatMap((s) => s.points);
        const intraday = this.series.some((s) => s.points.some((p, i) => i > 0 && p.time - s.points[i - 1].time < 86400));
        this.chart.timeScale().applyOptions({ timeVisible: intraday, secondsVisible: false });
        this.appliquerOptionsEchelle();
        if (tousLesPoints.length) {
            this.chart.timeScale().fitContent();
        }
        this.majLegende();
    }

    private dessinerCours(): void {
        const serie = this.serieReference;
        if (!this.chart || !serie?.points.length) return;

        const lignes = serie.points.map((p) => ({ time: p.time, value: p.close }));
        const dernier = serie.points[serie.points.length - 1].close;
        const decimales = Math.abs(dernier) < 1 ? 4 : 2;
        const priceFormat = { type: 'price' as const, precision: decimales, minMove: 1 / 10 ** decimales };
        let principale: ISeriesApi<SeriesType>;

        switch (this.typeGraphe) {
            case 'candle':
                principale = this.chart.addSeries(CandlestickSeries, {
                    upColor: COULEUR_HAUSSE,
                    downColor: COULEUR_BAISSE,
                    borderVisible: false,
                    wickUpColor: COULEUR_HAUSSE,
                    wickDownColor: COULEUR_BAISSE,
                    priceFormat
                });
                principale.setData(serie.points.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
                break;
            case 'bar':
                principale = this.chart.addSeries(BarSeries, { upColor: COULEUR_HAUSSE, downColor: COULEUR_BAISSE, priceFormat });
                principale.setData(serie.points.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
                break;
            case 'line':
                principale = this.chart.addSeries(LineSeries, { color: '#2962ff', lineWidth: 2, priceFormat });
                principale.setData(lignes);
                break;
            case 'baseline':
                principale = this.chart.addSeries(BaselineSeries, {
                    baseValue: { type: 'price', price: serie.points[0].close },
                    topLineColor: COULEUR_HAUSSE,
                    topFillColor1: 'rgba(8, 153, 129, 0.28)',
                    topFillColor2: 'rgba(8, 153, 129, 0.04)',
                    bottomLineColor: COULEUR_BAISSE,
                    bottomFillColor1: 'rgba(242, 54, 69, 0.04)',
                    bottomFillColor2: 'rgba(242, 54, 69, 0.28)',
                    priceFormat
                });
                principale.setData(lignes);
                break;
            default:
                principale = this.chart.addSeries(AreaSeries, {
                    lineColor: '#2962ff',
                    topColor: 'rgba(41, 98, 255, 0.28)',
                    bottomColor: 'rgba(41, 98, 255, 0.02)',
                    lineWidth: 2,
                    priceFormat
                });
                principale.setData(lignes);
        }
        principale.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.22 } });
        this.seriesGraphique.push(principale);

        this.dessinerVolume(serie.points);
        if (this.mm20) this.dessinerMoyenneMobile(serie.points, 20, COULEUR_MM20);
        if (this.mm50) this.dessinerMoyenneMobile(serie.points, 50, COULEUR_MM50);
    }

    private dessinerVolume(points: Bougie[]): void {
        if (!this.chart || !points.some((p) => p.volume > 0)) return;

        const volume = this.chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
            lastValueVisible: false,
            priceLineVisible: false
        });
        volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
        volume.setData(
            points.map((p) => ({
                time: p.time,
                value: p.volume,
                color: p.close >= p.open ? 'rgba(8, 153, 129, 0.4)' : 'rgba(242, 54, 69, 0.4)'
            }))
        );
        this.seriesGraphique.push(volume);
    }

    private dessinerMoyenneMobile(points: Bougie[], periode: number, couleur: string): void {
        if (!this.chart || points.length < periode) return;

        let somme = 0;
        const donnees: { time: UTCTimestamp; value: number }[] = [];
        points.forEach((p, i) => {
            somme += p.close;
            if (i >= periode) somme -= points[i - periode].close;
            if (i >= periode - 1) donnees.push({ time: p.time, value: somme / periode });
        });

        const moyenne = this.chart.addSeries(LineSeries, {
            color: couleur,
            lineWidth: 1,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false
        });
        moyenne.setData(donnees);
        this.seriesGraphique.push(moyenne);
    }

    private dessinerBase100(): void {
        if (!this.chart) return;

        let ligneTracee = false;
        for (const serie of this.series) {
            if (!serie.points.length || !serie.points[0].close) continue;

            const estReference = serie.actif.id === this.reference?.id;
            const ligne = this.chart.addSeries(LineSeries, {
                color: this.couleur(serie.actif),
                lineWidth: estReference ? 3 : 2,
                title: serie.actif.symbole,
                priceLineVisible: false,
                priceFormat: { type: 'price', precision: 2, minMove: 0.01 }
            });
            ligne.setData(serie.points.map((p) => ({ time: p.time, value: (p.close / serie.points[0].close) * 100 })));
            ligne.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.08 } });

            if (!ligneTracee) {
                ligne.createPriceLine({
                    price: 100,
                    color: '#787b86',
                    lineWidth: 1,
                    lineStyle: LineStyle.Dashed,
                    axisLabelVisible: false,
                    title: ''
                });
                ligneTracee = true;
            }
            this.seriesGraphique.push(ligne);
        }
    }

    /** Sans survol, la légende affiche la dernière valeur connue. */
    private majLegende(param?: MouseEventParams): void {
        const temps = typeof param?.time === 'number' ? param.time : null;

        this.legendeBase100 = this.series.map((s) => {
            const point = temps !== null ? s.parTemps.get(temps) : s.points[s.points.length - 1];
            const base = s.points[0]?.close;
            return {
                symbole: s.actif.symbole,
                couleur: this.couleur(s.actif),
                valeur: point && base ? this.arrondi((point.close / base) * 100) : null
            };
        });

        const serie = this.serieReference;
        const point = serie && (temps !== null ? serie.parTemps.get(temps) : serie.points[serie.points.length - 1]);
        this.legendeCours = point
            ? {
                date: new Date(point.time * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
                open: point.open,
                high: point.high,
                low: point.low,
                close: point.close,
                volume: point.volume,
                variation: point.open ? this.arrondi(((point.close - point.open) / point.open) * 100) : 0
            }
            : null;
    }
}
