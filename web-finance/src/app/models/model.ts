
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

export interface LoginPayload {
    email: string;
    password: string;
}

export interface AuthResponse {
    access: string;
    refresh: string;
}

export interface Country {
    label: string;
    value: string;
}

export interface RecentActivity {
    title: string;
    description: string;
    date: string;
    icon: string;
    color: string;
    bg: string;
}

export interface AccessRequestResponse {
    message?: string;
}

export interface MarketAsset {
    id: number;
    name: string;
    symbol: string;
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
    id: number;
    name: string;
    symbol: string;
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
    resume: string;
    source: string;
    categorie: string;
    url: string;
    imageUrl?: string;
    datePublication: string;
}

export interface ActualiteResponse {
    results: Actualite[];
    count?: number;
}

