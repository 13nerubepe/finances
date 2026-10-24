
import type { UTCTimestamp } from 'lightweight-charts';

/**
 * Actif financier
 */
export interface Actif {
    actifId: number;
    name: string;
    symbol: string;
    currentPrice: number;
    previousPrice: number;
    variation: number;
    currency?: string;
    volume?: number;
    logo?: string;
    trend?: 'up' | 'down';
}

/**
 * Option d'actif pour les listes déroulantes
 */
export interface ActifOption {
    actifId: number;
    symbol: string;
    name: string;
}

/**
 * Historique des cours
 */
export interface HistoricalPrice {
    id: number;
    actifId: number;
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * Bougie adaptée à Lightweight Charts
 */
export interface Bougie {
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

/**
 * Filtres de recherche des cours historiques
 */
export interface FiltresCours {
    actifId: number;
    dateDebut: string;
    dateFin: string;
    frequence?: 'daily' | 'weekly' | 'monthly';
}

/**
 * Fréquence des données historiques
 */
export type Frequence = NonNullable<FiltresCours['frequence']>;

/**
 * Période d'affichage du graphique
 */
export interface Periode {
    label: string;
    value: string;
    jours: number;
    frequence: Frequence;
}

/**
 * Paramètres d'analyse de volatilité
 */
export interface AnalyseVolatiliteParams {
    actifs: string[];
    periode: number;
    frequence?: Frequence;
}

/**
 * Rendement d'un actif
 */
export interface RendementActif {
    date: string;
    symbol: string;
    rendement: number;
}

/**
 * Point de volatilité glissante
 */
export interface PointVolatilite {
    date: string;
    symbol: string;
    volatilite: number;
    fenetre: number;
}

/**
 * Indicateurs de volatilité et niveau de risque
 */
export interface IndicateursVolatilite {
    volatiliteActuelle: number;
    volatiliteMoyenne: number;
    volatiliteMaximale: number;
    niveauRisque: 'faible' | 'modere' | 'eleve' | 'critique';
}

/**
 * Mouvement inhabituel détecté
 */
export interface MouvementInhabituel {
    actif: string;
    date: string;
    variation: number;
    type: string;
    description: string;
}

/**
 * Matrice de corrélation entre les actifs
 */
export interface MatriceCorrelation {
    actifs: string[];
    matrice: number[][];
}

/**
 * Résultat de l'analyse de volatilité
 */
export interface ResultatAnalyseVolatilite {
    donnees: {
        date: string;
        cours: number;
        volatilite: number;
    }[];

    indicateurs: IndicateursVolatilite;

    correlations: {
        actif1: string;
        actif2: string;
        correlation: number;
    }[];

    covariances?: {
        actif1: string;
        actif2: string;
        covariance: number;
    }[];

    matriceCorrelation?: MatriceCorrelation;

    mouvementsInhabituels: MouvementInhabituel[];
}

/**
 * Alerte de risque
 */
export interface AlerteRisque {
    symbol: string;
    date: string;
    niveau: 'faible' | 'modere' | 'eleve' | 'critique';
    message: string;
}

/**
 * Portefeuille financier
 */
export interface Portefeuille {
    portefeuilleId: number;
    nom: string;
    devise: string;
    valeurTotale: number;
    variation: number;
    dateCreation: string;
}

/**
 * Position détenue dans un portefeuille
 */
export interface PositionPortefeuille {
    positionId: number;
    portefeuilleId: number;
    actifId: number;
    symbol: string;
    nom: string;
    quantite: number;
    prixAchat: number;
    prixActuel: number;
    valeurTotale: number;
    rendement: number;
    poids: number;
}

/**
 * Transaction : achat ou vente d'un actif
 */
export interface Transaction {
    transactionId: number;
    portefeuilleId: number;
    actifId: number;
    symbol: string;
    type: 'achat' | 'vente';
    quantite: number;
    prixUnitaire: number;
    montantTotal: number;
    frais?: number;
    dateTransaction: string;
    devise: string;
}

/**
 * Données nécessaires à la création d'une transaction
 */
export type NouvelleTransaction = Omit<Transaction, 'transactionId'>;

/**
 * Historique de la valeur du portefeuille
 */
export interface HistoriquePortefeuille {
    historiqueId: number;
    portefeuilleId: number;
    date: string;
    valeurTotale: number;
    liquidites: number;
    valeurActifs: number;
}

/**
 * Performance financière du portefeuille
 */
export interface PerformancePortefeuille {
    portefeuilleId: number;
    valeurInitiale: number;
    valeurActuelle: number;
    gainsPertes: number;
    rendementPourcentage: number;
    variationJournaliere?: number;
    dateDebut: string;
    dateFin: string;
    devise: string;
}

/**
 * Actualité financière issue d'un flux RSS
 */
export interface Actualite {
    id: number;
    titre: string;
    resume: string;
    contenu: string;
    source: string;
    categorie: string;
    url: string;
    imageUrl?: string;
    datePublication: string;
}

/**
 * Réponse contenant une liste d'actualités
 */
export interface ActualiteResponse {
    results: Actualite[];
    count?: number;
}

/**
 * Message envoyé à l'assistant IA
 */
export interface MessageAssistantIA {
    id: number;
    role: 'user' | 'assistant';
    contenu: string;
    dateCreation: string;
}

/**
 * Requête adressée à l'assistant IA
 */
export interface RequeteAssistantIA {
    message: string;
    symboles?: string[];
    portefeuilleId?: number;
    dateDebut?: string;
    dateFin?: string;
}

/**
 * Réponse de l'assistant IA
 */
export interface ReponseAssistantIA {
    reponse: string;
    dateCreation?: string;
    sources?: SourceAssistantIA[];
}

/**
 * Source utilisée par l'assistant IA
 */
export interface SourceAssistantIA {
    titre: string;
    url: string;
    type: 'actualite' | 'donnee_marche' | 'analyse';
}

/**
 * Réponse de répartition du portefeuille pour le tableau de bord
 */
export interface PortfolioDistributionResponse {
    labels: string[];
    values: number[];
}

/**
 * Actif présent dans le classement des plus fortes variations
 */
export interface TopMover {
    symbol: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
}

/**
 * Réponse du classement des actifs les plus variables
 */
export interface TopMoversResponse {
    gainers: TopMover[];
    losers: TopMover[];
}
