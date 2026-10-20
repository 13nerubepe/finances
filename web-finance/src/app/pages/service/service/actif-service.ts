import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    Actif, ActifOption,
    Actualite, AnalyseVolatiliteParams,
    HistoricalPrice,
    PortfolioDistributionResponse, ResultatAnalyseVolatilite,
    TopMoversResponse
} from '@/app/models/model';
import { environment } from '@/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ActifService {
    private readonly http = inject(HttpClient);

    private readonly apiUrl = `${environment.apiUrl}/`;

    // Récupérer la liste des actifs
    getAssets(): Observable<Actif[]> {
        return this.http.get<Actif[]>(`${this.apiUrl}/actifs/`);
    }

    // Récupérer l'historique des cours d'un actif
    getAssetHistory(assetId: number, period: string): Observable<HistoricalPrice[]> {
        const params = new HttpParams()
            .set('actif', assetId.toString())
            .set('period', period);

        return this.http.get<HistoricalPrice[]>(
            `${this.apiUrl}/cours-historiques/`,
            { params }
        );
    }

    getPortfolioDistribution(): Observable<PortfolioDistributionResponse> {
        return this.http.get<PortfolioDistributionResponse>(
            `${this.apiUrl}/portefeuille/repartition/`
        );
    }

    getTopMovers(): Observable<TopMoversResponse> {
        return this.http.get<TopMoversResponse>(
            `${this.apiUrl}/marche/top-movers/`
        );
    }
    getActualites(
        categorie = 'Toutes', recherche = ''): Observable<Actualite[]> {
        let params = new HttpParams();

        if (categorie !== 'Toutes') {
            params = params.set('categorie', categorie);
        }

        if (recherche.trim()) {
            params = params.set('search', recherche.trim());
        }

        return this.http.get<Actualite[]>(
            `${this.apiUrl}/`,
            { params }
        );
    }


    /**
     * Récupérer les actifs disponibles pour l'analyse.
     *
     * GET /api/volatilite/actifs
     */
    getActifsDisponibles(): Observable<ActifOption[]> {
        return this.http.get<ActifOption[]>(
            `${this.apiUrl}/actifs`
        );
    }

    /**
     * Lancer l'analyse de volatilité.
     *
     * POST /api/volatilite/analyse
     *
     * Le backend reçoit les actifs et la période sélectionnée.
     */
    analyserVolatilite(
        params: AnalyseVolatiliteParams
    ): Observable<ResultatAnalyseVolatilite> {

        return this.http.post<ResultatAnalyseVolatilite>(
            `${this.apiUrl}/analyse`,
            {
                actifs: params.actifs,
                periode: params.periode
            }
        );
    }

    /**
     * Récupérer les données historiques d'un actif.
     *
     * GET /api/volatilite/historique?actif=...&periode=...
     */
    getHistorique(
        actif: string,
        periode: number
    ): Observable<ResultatAnalyseVolatilite['donnees']> {

        const httpParams = new HttpParams()
            .set('actif', actif)
            .set('periode', periode);

        return this.http.get<ResultatAnalyseVolatilite['donnees']>(
            `${this.apiUrl}/historique`,
            { params: httpParams }
        );
    }

    /**
     * Récupérer les corrélations entre plusieurs actifs.
     *
     * GET /api/volatilite/correlations?actifs=...&periode=...
     */
    getCorrelations(
        actifs: string[],
        periode: number
    ): Observable<ResultatAnalyseVolatilite['correlations']> {

        const httpParams = new HttpParams()
            .set('actifs', actifs.join(','))
            .set('periode', periode);

        return this.http.get<ResultatAnalyseVolatilite['correlations']>(
            `${this.apiUrl}/correlations`,
            { params: httpParams }
        );
    }

    /**
     * Récupérer les mouvements inhabituels détectés.
     *
     * GET /api/volatilite/mouvements-inhabituels
     */
    getMouvementsInhabituels(
        actifs: string[],
        periode: number
    ): Observable<ResultatAnalyseVolatilite['mouvementsInhabituels']> {

        const httpParams = new HttpParams()
            .set('actifs', actifs.join(','))
            .set('periode', periode);

        return this.http.get<
            ResultatAnalyseVolatilite['mouvementsInhabituels']
        >(
            `${this.apiUrl}/mouvements-inhabituels`,
            { params: httpParams }
        );
    }


}
