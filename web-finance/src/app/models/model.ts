
export interface ExpandedRows{
    [key: string]: boolean;

}

export interface User_Role {
    id: number;
    name: string;
    email: string;
    avatar: string;
    role: 'Administrateur' | 'RH' | 'Manager' | 'Employé';
    status: 'Actif' | 'Inactif';
}

export interface AccessRequestPayload {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    position: string;
    company_name: string;
    country: string;
    city: string;
    reason: string;
}

export interface UserProfile {
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    two_factor_enabled: boolean;
}

export interface UpdateProfilePayload {
    full_name: string;
    email: string;
    phone: string;
}

export interface ChangePasswordPayload {
    current_password: string;
    new_password: string;
}

export interface TwoFactorSetupResponse {
    qr_code: string; // data URL de l'image, ex. "data:image/png;base64,..."
    secret: string;
}

export interface TwoFactorEnableResponse {
    backup_codes: string[];
}



export interface AccessRequestResponse {
    message?: string;
}

export interface HistoricalPrice {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
export interface PeriodOption {
    label: string;
    value: string;
}

export interface Actif {
    actifId: number;
    name: string;
    symbol: string;
    currentPrice: number;
    previousPrice: number;
    variation: number;
    currency?: string;
    status?: string;
    // Pas encore fournis par l'API : colonnes masquées tant qu'ils sont absents
    volume?: number;
    logo?: string;
    trend?: 'up' | 'down'; // calculé côté front pour le filtre
}

export interface HistoricalPrice {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export interface PortfolioDistributionItem {
    actifId: number;
    name: string;
    symbol: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
    percentage?: number;
}

export interface PortfolioDistributionResponse {
    totalValue: number;
    distribution: PortfolioDistributionItem[];
}

export interface ProfileUpdate {
    first_name?: string;
    last_name?: string;
    language?: 'fr' | 'en';
}

export interface TopMover {
    actifId: number;
    name: string;
    symbol: string;
    currentPrice: number;
    previousPrice: number;
    variation: number;
}

export interface TopMoversResponse {
    topGagnants: TopMover[];
    topPerdants: TopMover[];
}

export interface Actualite {
    id: number;
    titre: string;
    categorie: string;
    datePublication: string;
    resume: string;
    source: string;
    url?: string;
    imageUrl?: string;
}

export interface ActualiteResponse {
    results: Actualite[];
    count?: number;
}

export interface ActifOption {
    label: string;
    value: string;
}

export interface AnalyseVolatiliteParams {
    actifs: string[];
    periode: number;
}

export interface DonneeVolatilite {
    date: string;
    cours: number;
    volatilite: number;
}
/**
 * Structure d'un point historique.
 * Adapte les propriétés à la réponse réelle de ton backend.
 */
export interface DonneeVolatilite {
    date: string;
    cours: number;
    volatilite: number;
}

/**
 * Indicateurs statistiques de volatilité.
 */
export interface IndicateursVolatilite {
    volatiliteActuelle: number;
    volatiliteMoyenne: number;
    volatiliteMaximale: number;
    niveauRisque: string;
}

/**
 * Corrélation entre deux actifs.
 */
export interface CorrelationActif {
    actif1: string;
    actif2: string;
    correlation: number;
}

/**
 * Mouvement inhabituel détecté.
 */
export interface MouvementInhabituel {
    actif: string;
    date: string;
    variation: number;
    type: string;
    description: string;
}

/**
 * Résultat complet de l'analyse.
 */
export interface ResultatAnalyseVolatilite {
    donnees: DonneeVolatilite[];
    indicateurs: IndicateursVolatilite;
    correlations: CorrelationActif[];
    mouvementsInhabituels: MouvementInhabituel[];
}

