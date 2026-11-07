import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { catchError, forkJoin, map, of, Subject, Subscription, switchMap } from 'rxjs';

import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { MultiSelect } from 'primeng/multiselect';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { InputText } from 'primeng/inputtext';
import { Tag } from 'primeng/tag';

import {
    AreaSeries,
    BarSeries,
    BaselineSeries,
    CandlestickSeries,
    ColorType,
    createChart,
    createSeriesMarkers,
    CrosshairMode,
    HistogramSeries,
    LineSeries,
    LineStyle,
    PriceScaleMode
} from 'lightweight-charts';
import type { IChartApi, ISeriesApi, MouseEventParams, SeriesType, UTCTimestamp } from 'lightweight-charts';

import type { Actif, Bougie, ExplicationPic, FiltresCours, HistoricalPrice } from '@/app/models/actif-model';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { AnalyseActif } from '@/app/pages/commons/analyse-actif/analyse-actif';
import { AssistantPont } from '@/app/pages/commons/assistant-ai/assistant-pont';

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

interface PicGraphique {
    debut: string;
    fin: string;
    horodatage_max: string;
}

interface SensPaire {
    a: string;
    b: string;
    correlation: number | null;
    sens: 'meme' | 'oppose' | 'neutre' | 'inconnu';
}

/** Au-delà de ce seuil (en valeur absolue), on considère que deux actifs évoluent ensemble. */
const SEUIL_SENS = 0.3;
const MIN_RENDEMENTS = 5;

const COULEUR_HAUSSE = '#089981';
const COULEUR_BAISSE = '#f23645';
const COULEUR_MM20 = '#f7a600';
const COULEUR_MM50 = '#ab47bc';
const COULEUR_PIC = '#f7a600';
/** Les pics sont journaliers : un peu plus d'un an couvre toutes les périodes du graphique. */
const JOURS_PICS = 400;

const STATS_VIDES: StatsActif = { perf: null, volatilite: null, ouverture: null, haut: null, bas: null, dernier: null, volume: null };

@Component({
    selector: 'app-detail-actif',
    standalone: true,
    imports: [CommonModule, FormsModule, Button, Dialog, InputText, MultiSelect, Select, TableModule, Tag, AnalyseActif],
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
    // Durée en heures : 1 M = 30 jours, 1 A = 365 jours.
    periode = 720;
    periodes = [
        { label: '1H', value: 1 },
        { label: '6H', value: 6 },
        { label: '1J', value: 24 },
        { label: '1S', value: 168 },
        { label: '1M', value: 720 },
        { label: '3M', value: 2160 },
        { label: '6M', value: 4320 },
        { label: '1A', value: 8760 }
    ];

    /** Dates précises choisies par l'utilisateur (AAAA-MM-JJ, UTC) ; null = période prédéfinie. */
    plageDates: { debut: string; fin: string } | null = null;
    saisieDates = false;
    dateDebutSaisie = '';
    dateFinSaisie = '';
    erreurDates = '';
    readonly aujourdhui = new Date().toISOString().slice(0, 10);

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
    sensEvolution: SensPaire[] = [];

    // Fenêtre d'explication d'un pic
    fenetreVisible = false;
    fenetreSymbole = '';
    fenetreJour = '';
    fenetreAvecPic = false;
    /** Moment cliqué sur le graphique (UTC) et bougie correspondante, s'il y en a une. */
    fenetreMoment: Date | null = null;
    fenetreBougie: { ouverture: number; cloture: number; variation: number | null } | null = null;
    explication: ExplicationPic | null = null;
    explicationEnCours = false;
    explicationErreur = '';
    /** 404 : réessayer ne changera rien, aucun indicateur n'existe pour ce jour. */
    erreurSansReessai = false;

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
    private historique: { serie?: SerieActif; lignes: Bougie[] } = { lignes: [] };
    private seriePrincipale?: ISeriesApi<SeriesType>;
    private readonly picsParSymbole = new Map<string, PicGraphique[]>();
    private readonly explications = new Map<string, ExplicationPic>();
    private requeteExplication?: Subscription;

    private readonly demandeComparaison$ = new Subject<void>();
    private readonly subscriptions = new Subscription();
    private readonly surChangementPleinEcran = () => {
        this.pleinEcran = document.fullscreenElement === this.panneauGraphique?.nativeElement;
        this.cdr.markForCheck();
    };

    constructor(
        private actifService: ActifService,
        private route: ActivatedRoute,
        private cdr: ChangeDetectorRef,
        private assistant: AssistantPont
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
        this.requeteExplication?.unsubscribe();
        this.observateurTheme?.disconnect();
        document.removeEventListener('fullscreenchange', this.surChangementPleinEcran);
        this.chart?.remove();
    }

    /** Garde le même tableau tant que la série ne change pas, sinon l'analyse se rechargerait sans arrêt. */
    lignesHistorique(): Bougie[] {
        const serie = this.serieReference;
        if (serie !== this.historique.serie) {
            this.historique = { serie, lignes: serie ? [...serie.points].reverse() : [] };
        }
        return this.historique.lignes;
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

    changerPeriode(value: number): void {
        this.periode = value;
        this.plageDates = null;
        this.saisieDates = false;
        this.demanderComparaison();
    }

    get periodeLabel(): string {
        if (this.plageDates) return `du ${this.dateCourte(this.plageDates.debut)} au ${this.dateCourte(this.plageDates.fin)}`;
        return this.periodes.find((p) => p.value === this.periode)?.label ?? '';
    }

    /** Ouvre ou ferme la saisie des dates, préremplie avec la période affichée. */
    basculerSaisieDates(): void {
        this.saisieDates = !this.saisieDates;
        this.erreurDates = '';
        if (this.saisieDates && !this.plageDates) {
            this.dateFinSaisie = this.aujourdhui;
            this.dateDebutSaisie = this.formaterDate(new Date(Date.now() - this.periode * 3600000));
        }
    }

    appliquerDates(): void {
        const debut = this.dateDebutSaisie;
        const fin = this.dateFinSaisie;
        if (!debut || !fin) {
            this.erreurDates = 'Choisissez une date de début et une date de fin.';
            return;
        }
        if (debut > fin) {
            this.erreurDates = 'La date de début doit précéder la date de fin.';
            return;
        }
        if (fin > this.aujourdhui) {
            this.erreurDates = "La date de fin ne peut pas dépasser aujourd'hui.";
            return;
        }
        this.erreurDates = '';
        this.plageDates = { debut, fin };
        this.saisieDates = false;
        this.demanderComparaison();
    }

    /** Durée affichée en heures, pour choisir le format des dates (avec l'heure sous une semaine). */
    private get dureeHeures(): number {
        if (!this.plageDates) return this.periode;
        return (Date.parse(`${this.plageDates.fin}T23:59:59Z`) - Date.parse(`${this.plageDates.debut}T00:00:00Z`)) / 3600000;
    }

    private dateCourte(jour: string): string {
        return new Date(`${jour}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' });
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
        const maintenant = Date.now();
        const plage = this.plageDates;
        // Dates précises : du début du premier jour à la fin du dernier jour (UTC).
        const debutExact = plage ? Date.parse(`${plage.debut}T00:00:00Z`) : maintenant - this.periode * 3600000;
        const finExact = plage ? Date.parse(`${plage.fin}T23:59:59.999Z`) : Infinity;

        // L'API reçoit des jours entiers, avec une marge d'un jour de chaque côté.
        // creerSerie coupe ensuite à l'heure exacte, ce qui fait marcher 1H et 6H.
        const debut = this.formaterDate(new Date(debutExact - 86400000));
        const fin = this.formaterDate(new Date((plage ? finExact : maintenant) + 86400000));

        // Une erreur sur un actif ne doit pas faire disparaître les autres.
        const requetes = actifsSelectionnes.map((actif) => {
            const filtres: FiltresCours = { actif: actif.symbole, debut, fin };

            return this.actifService.getAllAssetHistory(filtres).pipe(
                map((response: any) => this.creerSerie(actif, response.results ?? response, false, debutExact, finExact)),
                catchError((err) => {
                    console.error(`Erreur d'historique pour ${actif.symbole} :`, err);
                    return of(this.creerSerie(actif, [], true));
                })
            );
        });

        return forkJoin(requetes);
    }

    private creerSerie(actif: Actif, cours: HistoricalPrice[], enErreur: boolean, debutExact = 0, finExact = Infinity): SerieActif {
        const parTemps = new Map<number, Bougie>();

        for (const c of cours) {
            const close = this.nombre(c.close);
            const secondes = Math.floor(new Date(c.horodatage).getTime() / 1000);
            if (close === null || Number.isNaN(secondes) || secondes * 1000 < debutExact || secondes * 1000 > finExact) continue;

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
        const vides = series.filter((s) => !s.enErreur && !s.points.length).map((s) => s.actif.symbole);
        const sansCours = vides.length ? `Aucun cours sur cette période pour : ${vides.join(', ')}.` : '';
        return [this.avertissementRoute, historique, sansCours].filter(Boolean).join(' ');
    }

    private formaterDate(date: Date): string {
        return date.toISOString().slice(0, 10);
    }

    // --------------------------------------------------
    // INDICATEURS
    // --------------------------------------------------

    private calculerStats(): void {
        this.stats = new Map(this.series.map((s) => [s.actif.id, this.statsDe(s.points)]));
        this.sensEvolution = this.calculerSensEvolution();
    }

    /** Compare chaque paire d'actifs, de la relation la plus forte à la plus faible. */
    private calculerSensEvolution(): SensPaire[] {
        const paires: SensPaire[] = [];
        this.series.forEach((serieA, i) => {
            for (const serieB of this.series.slice(i + 1)) {
                const correlation = this.correlationRendements(serieA, serieB);
                let sens: SensPaire['sens'] = 'inconnu';
                if (correlation !== null) {
                    sens = correlation >= SEUIL_SENS ? 'meme' : correlation <= -SEUIL_SENS ? 'oppose' : 'neutre';
                }
                paires.push({ a: serieA.actif.symbole, b: serieB.actif.symbole, correlation, sens });
            }
        });
        return paires.sort((p, q) => Math.abs(q.correlation ?? 0) - Math.abs(p.correlation ?? 0));
    }

    /** Corrélation des rendements sur les dates communes, car les cryptos cotent aussi le week-end. */
    private correlationRendements(serieA: SerieActif, serieB: SerieActif): number | null {
        const communs = serieA.points.filter((p) => serieB.parTemps.has(p.time));
        const rendementsA: number[] = [];
        const rendementsB: number[] = [];

        for (let i = 1; i < communs.length; i++) {
            const precedentB = serieB.parTemps.get(communs[i - 1].time)!.close;
            if (communs[i - 1].close > 0 && precedentB > 0) {
                rendementsA.push(communs[i].close / communs[i - 1].close - 1);
                rendementsB.push(serieB.parTemps.get(communs[i].time)!.close / precedentB - 1);
            }
        }
        if (rendementsA.length < MIN_RENDEMENTS) return null;

        const moyenneA = rendementsA.reduce((s, v) => s + v, 0) / rendementsA.length;
        const moyenneB = rendementsB.reduce((s, v) => s + v, 0) / rendementsB.length;
        let covariance = 0;
        let varianceA = 0;
        let varianceB = 0;
        rendementsA.forEach((v, k) => {
            covariance += (v - moyenneA) * (rendementsB[k] - moyenneB);
            varianceA += (v - moyenneA) ** 2;
            varianceB += (rendementsB[k] - moyenneB) ** 2;
        });
        return varianceA && varianceB ? this.arrondi(covariance / Math.sqrt(varianceA * varianceB)) : null;
    }

    private statsDe(points: Bougie[]): StatsActif {
        if (!points.length) return STATS_VIDES;

        const premier = points[0];
        const dernier = points[points.length - 1];

        return {
            perf: points.length > 1 && premier.close ? this.arrondi(((dernier.close - premier.close) / premier.close) * 100) : null,
            volatilite: this.calculerVolatilite(points),
            ouverture: premier.open,
            // reduce, car Math.max(...) peut planter sur des dizaines de milliers de bougies.
            haut: points.reduce((max, p) => Math.max(max, p.high), -Infinity),
            bas: points.reduce((min, p) => Math.min(min, p.low), Infinity),
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
    /** Pourcentage non signé (volatilité, amplitude), toujours avec 2 décimales. */
    formaterPourcent(valeur: number | null | undefined): string {
        if (valeur === null || valeur === undefined) return '—';
        return `${valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
    }

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
        // Une période vide ne doit pas changer le type de graphique choisi.
        if (!this.series.some((s) => s.points.length)) {
            this.typesGraphe = this.tousLesTypes;
            return;
        }

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
        this.chart.subscribeClick((param) => {
            if (typeof param.time === 'number') this.ouvrirFenetre(param.time);
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
        this.seriePrincipale = undefined;

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
        this.afficherPics();
    }

    // --------------------------------------------------
    // PICS ET EXPLICATION
    // --------------------------------------------------

    /** Charge une seule fois les pics de l'actif, puis les marque sur le graphique. */
    private afficherPics(): void {
        const symbole = this.reference?.symbole;
        if (!symbole) return;

        if (this.picsParSymbole.has(symbole)) {
            this.dessinerMarqueurs();
            return;
        }

        const debut = new Date(Date.now() - JOURS_PICS * 86400000).toISOString().slice(0, 10);
        // Mêmes pics que la cloche et l'assistant : ce sont ceux que l'agent sait expliquer.
        const sub = this.actifService
            .getPicsJournaliers({ symbole, debut })
            .pipe(
                map((pics): PicGraphique[] => pics.map((pic) => ({ debut: pic.date, fin: pic.date, horodatage_max: pic.date }))),
                catchError(() => of([] as PicGraphique[]))
            )
            .subscribe((pics) => {
                this.picsParSymbole.set(symbole, pics);
                if (this.reference?.symbole === symbole) this.dessinerMarqueurs();
            });
        this.subscriptions.add(sub);
    }

    private dessinerMarqueurs(): void {
        const serie = this.serieReference;
        const principale = this.seriePrincipale;
        if (!serie?.points.length || !principale) return;

        const debut = serie.points[0].time;
        const fin = serie.points[serie.points.length - 1].time;
        const temps = new Set<UTCTimestamp>();

        for (const pic of this.picsParSymbole.get(serie.actif.symbole) ?? []) {
            const secondes = new Date(pic.horodatage_max).getTime() / 1000;
            if (secondes < debut - 86400 || secondes > fin + 86400) continue;
            // Le marqueur doit tomber sur une bougie existante : on prend la plus proche.
            const proche = serie.points.reduce((a, b) => (Math.abs(b.time - secondes) < Math.abs(a.time - secondes) ? b : a));
            if (Math.abs(proche.time - secondes) <= 86400) temps.add(proche.time);
        }

        createSeriesMarkers(
            principale,
            [...temps]
                .sort((a, b) => a - b)
                .map((time) => ({ time, position: 'aboveBar' as const, shape: 'arrowDown' as const, color: COULEUR_PIC, text: 'Pic' }))
        );
    }

    private jourDe(secondes: number): string {
        return new Date(secondes * 1000).toISOString().slice(0, 10);
    }

    /** Clic sur un point : demande à l'agent d'expliquer ce jour pour l'actif de référence. */
    private ouvrirFenetre(secondes: number): void {
        const symbole = this.reference?.symbole;
        if (!symbole) return;

        const jour = this.jourDe(secondes);
        const pic = (this.picsParSymbole.get(symbole) ?? []).find((p) => p.debut.slice(0, 10) <= jour && jour <= p.fin.slice(0, 10));

        this.preparerFenetre(symbole, pic ? this.jourDe(new Date(pic.horodatage_max).getTime() / 1000) : jour, !!pic, secondes);
    }

    /** Bougie cliquée et sa variation par rapport à la bougie précédente. */
    private bougieA(secondes: number): { ouverture: number; cloture: number; variation: number | null } | null {
        const points = this.serieReference?.points ?? [];
        const i = points.findIndex((p) => p.time === secondes);
        if (i < 0) return null;
        const precedente = i > 0 ? points[i - 1].close : null;
        return {
            ouverture: points[i].open,
            cloture: points[i].close,
            variation: precedente ? ((points[i].close - precedente) / precedente) * 100 : null
        };
    }

    /** Bouton « Expliquer ce pic » de l'onglet Mouvements inhabituels. */
    expliquerPic(horodatage: string): void {
        const symbole = this.reference?.symbole;
        if (symbole) this.preparerFenetre(symbole, this.jourDe(new Date(horodatage).getTime() / 1000), true, new Date(horodatage).getTime() / 1000);
    }

    private preparerFenetre(symbole: string, jour: string, avecPic: boolean, secondes?: number): void {
        // La fenêtre ne peut pas s'afficher par-dessus le plein écran.
        if (document.fullscreenElement) document.exitFullscreen();

        this.fenetreSymbole = symbole;
        this.fenetreJour = jour;
        this.fenetreAvecPic = avecPic;
        this.fenetreMoment = secondes ? new Date(secondes * 1000) : null;
        this.fenetreBougie = secondes ? this.bougieA(secondes) : null;
        this.fenetreVisible = true;
        this.explication = null;
        this.explicationErreur = '';
        this.erreurSansReessai = false;
        this.explicationEnCours = false;
        this.requeteExplication?.unsubscribe();

        this.demanderExplication();
        this.cdr.markForCheck();
    }

    demanderExplication(): void {
        const cle = `${this.fenetreSymbole}|${this.fenetreJour}`;
        const dejaRecue = this.explications.get(cle);
        if (dejaRecue) {
            this.explication = dejaRecue;
            this.cdr.markForCheck();
            return;
        }

        this.explicationEnCours = true;
        this.explicationErreur = '';
        this.requeteExplication?.unsubscribe(); // Seule la dernière demande compte.
        this.requeteExplication = this.actifService
            .getExplicationPic(this.fenetreSymbole, this.fenetreJour)
            .subscribe({
                next: (reponse) => {
                    this.explications.set(cle, reponse);
                    this.explication = reponse;
                    this.explicationEnCours = false;
                    this.cdr.markForCheck();
                },
                error: (erreur: HttpErrorResponse) => {
                    console.error("Erreur de l'agent :", erreur.status, erreur.url, erreur.error);
                    this.explicationErreur = this.messageAgent(erreur);
                    this.erreurSansReessai = erreur.status === 404;
                    this.explicationEnCours = false;
                    this.cdr.markForCheck();
                }
            });
    }

    /** Envoie le moment cliqué (et l'explication déjà obtenue) à l'assistant, qui l'analyse et conseille. */
    demanderAssistant(): void {
        const actif = this.reference;
        if (!actif) return;

        const moment = this.fenetreMoment;
        const quand = moment
            ? `le ${moment.toLocaleDateString('fr-FR', { timeZone: 'UTC' })} à ${moment.toLocaleTimeString('fr-FR', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' })} UTC`
            : `le ${new Date(this.fenetreJour).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`;
        const lignes = [`Explique le mouvement de ${actif.nom} (${this.fenetreSymbole}) ${quand}, puis conseille-moi.`];

        const bougie = this.fenetreBougie;
        if (bougie) {
            const variation = bougie.variation === null ? 'inconnue' : this.formaterVariation(bougie.variation);
            lignes.push(`Bougie cliquée : ouverture ${this.formaterPrix(bougie.ouverture)}, clôture ${this.formaterPrix(bougie.cloture)}, variation ${variation} par rapport à la bougie précédente.`);
        }
        if (this.explication?.texte) lignes.push(`Explication déjà obtenue pour cette journée : ${this.explication.texte}`);
        if (moment) lignes.push(`Utilise cours_autour_d_une_heure avec moment=${moment.toISOString().slice(0, 16)}, puis indicateurs_du_jour pour le ${this.fenetreJour}.`);
        else lignes.push(`Utilise indicateurs_du_jour pour le ${this.fenetreJour}.`);
        lignes.push("Termine par les points à surveiller et ce que cela implique pour mes listes d'actifs.");

        this.fenetreVisible = false;
        this.assistant.demander({
            affichage: `Expliquer le mouvement de ${this.fenetreSymbole} ${quand} et me conseiller`,
            question: lignes.join('\n'),
            symboles: [this.fenetreSymbole]
        });
    }

    /** Affiche la raison donnée par le serveur, pour distinguer une absence de données d'une panne. */
    private messageAgent(erreur: HttpErrorResponse): string {
        const detail = typeof erreur.error?.detail === 'string' ? ` (${erreur.error.detail})` : '';

        if (erreur.status === 0) return 'Le serveur ne répond pas. Vérifie que Django est lancé.';
        if (erreur.status === 401 || erreur.status === 403) return `Accès refusé à l'agent : reconnecte-toi.${detail}`;
        if (erreur.status === 404) return "Les indicateurs de cette journée ne sont pas encore calculés (ils le sont chaque nuit) ou il n'y a pas eu de cotation ce jour-là.";
        if (erreur.status === 503) return `L'IA est momentanément indisponible. Réessayez plus tard.${detail}`;
        return `L'agent a répondu par une erreur ${erreur.status}.${detail}`;
    }

    /** L'API envoie les sources sous forme de liste { titre, url } (articles puis recherche web). */
    get sourcesExplication(): { texte: string; url: string }[] {
        return (this.explication?.sources ?? [])
            .filter((s) => s?.url || s?.titre)
            .map((s) => ({ texte: s.titre || s.url, url: s.url }));
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
        this.seriePrincipale = principale;

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
            if (estReference) this.seriePrincipale = ligne;
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
                date: new Date(point.time * 1000).toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    // Heure seulement pour les courtes périodes, en UTC comme l'axe du graphique.
                    ...(this.dureeHeures <= 168 ? { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' } : {})
                }),
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
