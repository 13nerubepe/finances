import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, switchMap, tap } from 'rxjs';
import {
    Actif, ActifOption,
    Actualite, AnalyseVolatiliteParams,
    HistoricalPrice,
    PortfolioDistributionResponse, ProfileUpdate, ResultatAnalyseVolatilite,
    TopMoversResponse
} from '@/app/models/model';
import { environment } from '@/environments/environment';
import { ACTIFS_MOCK, COURS_HISTORIQUES_MOCK } from '@/app/DATA/marche-mock.data.ts';
import { PORTEFEUILLE_MOCK } from '@/app/DATA/portefeuille-mock.data';
import { TOP_MOVERS_MOCK } from '@/app/DATA/topmoves-mock.data';
import { ACTUALITES_MOCK } from '@/app/DATA/actualites-mock.data';
import { AccessToken, RegisterPayload, User } from '@/app/models/auth.models';

@Injectable({
    providedIn: 'root'
})
export class ActifService {
    private readonly http = inject(HttpClient);
    private readonly accessToken = signal<string | null>(null);
    readonly user = signal<User | null>(null);

    private readonly apiUrl = `${environment.apiUrl}/`;
    private readonly useMockData = true;

    /**
     * Connexion et récupération des tokens JWT.
     */
    login(email: string, password: string): Observable<User> {
        return this.http.post<AccessToken>(`${this.apiUrl}/login/`, { email, password }, { withCredentials: true }).pipe(
            tap(({ access }) => this.accessToken.set(access)),
            switchMap(() => this.loadCurrentUser())
        );
    }

    /**
     * Récupération du profil connecté.
     */
    loadCurrentUser(): Observable<User> {
        return this.http.get<User>(`${this.apiUrl}/me/`).pipe(tap((user) => this.user.set(user)));
    }

    /**
     * Inscription du fondateur et création de son entreprise.
     */
    register(payload: RegisterPayload): Observable<User> {
        return this.http.post<User>(`${this.apiUrl}/register/`, payload);
    }
    /** Name and language. The language also sets the language of agent answers. */
    updateProfile(changes: ProfileUpdate): Observable<User> {
        return this.http.patch<User>(`${this.apiUrl}/me/`, changes).pipe(tap((user) => this.user.set(user)));
    }







    // Récupérer la liste des actifs
    getAssets(): Observable<Actif[]> {
        // return this.http.get<Actif[]>(`${this.apiUrl}/actifs/`);
        return of(ACTIFS_MOCK);
    }

    // Récupérer l'historique des cours d'un actif
    getAssetHistory(assetId: number, period: string): Observable<HistoricalPrice[]> {
        // const params = new HttpParams()
        //     .set('actif', assetId.toString())
        //     .set('period', period);
        //
        // return this.http.get<HistoricalPrice[]>(
        //     `${this.apiUrl}/cours-historiques/`,
        //     { params }
        // );
        const historique = COURS_HISTORIQUES_MOCK[assetId] ?? [];

        // Pour le moment, on retourne tous les cours disponibles.
        // Le filtrage par période pourra être ajouté ensuite.
        return of(historique);
    }

    getPortfolioDistribution(): Observable<PortfolioDistributionResponse> {
        // return this.http.get<PortfolioDistributionResponse>(
        //     `${this.apiUrl}/portefeuille/repartition/`
        // );
        return of(PORTEFEUILLE_MOCK);
    }

    getTopMovers(): Observable<TopMoversResponse> {
        // return this.http.get<TopMoversResponse>(
        //     `${this.apiUrl}/marche/top-movers/`
        // );
        return of(TOP_MOVERS_MOCK);
    }
    // getActualites(
        // categorie = 'Toutes', recherche = ''): Observable<Actualite[]> {
        // let params = new HttpParams();
        //
        // if (categorie !== 'Toutes') {
        //     params = params.set('categorie', categorie);
        // }
        //
        // if (recherche.trim()) {
        //     params = params.set('search', recherche.trim());
        // }
        //
        // return this.http.get<Actualite[]>(
        //     `${this.apiUrl}/`,
        //     { params }
        // );


    // }

    getActualites(
        categorie = 'Toutes',
        recherche = ''
    ): Observable<Actualite[]> {
        let resultats = [...ACTUALITES_MOCK];

        if (categorie !== 'Toutes') {
            resultats = resultats.filter(
                actualite => actualite.categorie === categorie
            );
        }

        if (recherche.trim()) {
            const terme = recherche.trim().toLowerCase();

            resultats = resultats.filter(actualite =>
                actualite.titre.toLowerCase().includes(terme) ||
                actualite.resume.toLowerCase().includes(terme)
            );
        }

        return of(resultats);
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
