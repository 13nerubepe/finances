import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    Actif,
    Actualite,
    HistoricalPrice,
    PortfolioDistributionResponse,
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
}
