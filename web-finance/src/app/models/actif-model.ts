import type { UTCTimestamp } from 'lightweight-charts';

export type Frequence = '5min' | '15min' | '1h' | '1j';

/* ---------- Actifs ---------- */

export interface Actif {
    id: number;
    symbole: string;
    nom: string;
    type_actif: 'action' | 'indice' | 'crypto';
    devise: string;
    est_suivi: boolean;
    prix_actuel?: number;
    variation?: number;
    logo?: string;
    trend?: 'up' | 'down' | 'stable';
}

/* ---------- Cours ---------- */

export interface HistoricalPrice {
    actif: string;
    horodatage: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface HistoricalPriceResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: HistoricalPrice[];
}

export interface FiltresCours {
    actif: string;
    debut?: string;
    fin?: string;
}

export interface Bougie {
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface Periode {
    label: string;
    value: string;
    jours: number;
}

/* ---------- Volatilité ---------- */

export interface PointVolatilite {
    horodatage: string;
    close: number;
    rendement: number | null;
    volatilite: number | null;
    amplitude: number | null;
}

export interface VolatiliteResponse {
    actif: string;
    fenetre: number;
    frequence: Frequence;
    debut: string;
    fin: string;
    resume: {
        nb_points: number;
        volatilite_derniere: number | null;
        volatilite_moyenne: number | null;
        amplitude_periode: number | null;
        rendement_periode: number | null;
    };
    serie: PointVolatilite[];
}

/* ---------- Mouvements inhabituels ---------- */

export interface Pic {
    debut: string;
    fin: string;
    nb_points: number;
    horodatage_max: string;
    volatilite_max: number;
    score_max: number;
    variation_prix: number;
}

export interface PicsResponse {
    actif: string;
    fenetre: number;
    frequence: Frequence;
    seuil: number;
    debut: string;
    fin: string;
    moyenne: number;
    ecart_type: number;
    limite: number;
    pics: Pic[];
}

/* ---------- Corrélations ---------- */

export interface CorrelationsResponse {
    actifs: string[];
    frequence: Frequence;
    debut: string;
    fin: string;
    correlations: Record<string, Record<string, number | null>>;
    observations: Record<string, Record<string, number>>;
}

/* ---------- Actualités ---------- */

export interface Actualite {
    id: number;
    titre: string;
    lien: string;
    auteur: string;
    contenu: string;
    date_publication: string | null;
    themes: string[];
    source: number;
    source_nom: string;
}

export interface SourceActualites {
    id: number;
    nom: string;
    url_flux: string;
    actif: boolean;
    derniere_collecte: string | null;
}

/* ---------- Assistant IA : à vérifier avec les routes de agent ---------- */

export interface MessageAssistantIA {
    id: number;
    role: 'user' | 'assistant';
    contenu: string;
    dateCreation: string;
}

export interface RequeteAssistantIA {
    message: string;
    symboles?: string[];
    dateDebut?: string;
    dateFin?: string;
}

export interface SourceAssistantIA {
    titre: string;
    url: string;
    type: 'actualite' | 'donnee_marche' | 'analyse';
}

export interface ReponseAssistantIA {
    reponse: string;
    dateCreation?: string;
    sources?: SourceAssistantIA[];
}

/* ---------- Tableau de bord ---------- */

export interface PortfolioDistributionResponse {
    labels: string[];
    values: number[];
}

export interface TopMover {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
}

export interface TopMoversResponse {
    gainers: TopMover[];
    losers: TopMover[];
}

export interface Analyse {
    volatilite: VolatiliteResponse | null;
    pics: PicsResponse | null;
    correlations: CorrelationsResponse | null;
    covariances: Record<string, Record<string, number | null>>;
    actualites: Actualite[] | null;
}

/** Réponse de GET /api/agent/pics/{symbole}/{jour}/explication/ */
export interface ExplicationPic {
    symbole: string;
    date: string;
    z: number;
    type_pic: string;
    texte: string;
    sources: string;
    modele: string;
    date_creation: string;
}
