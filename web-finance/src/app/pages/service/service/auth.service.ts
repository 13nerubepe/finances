import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '@/environments/environment';
import {
    AccessToken, ChangePasswordPayload,
    LoginPayload,
    RegisterPayload, TwoFactorEnableResponse,
    TwoFactorSetupResponse, UpdateProfilePayload,
    User,
    UserProfile
} from '@/app/models/auth.models';



/**
 * Session handling.
 *
 * The access token lives in memory only (never in localStorage, out of reach of
 * injected scripts). The refresh token is an httpOnly cookie set by the API on
 * /auth/: the browser sends it on its own when `withCredentials` is true. After
 * a page reload, `restoreSession()` exchanges that cookie for a new access token.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly apiUrl = `${environment.apiUrl}/auth`;
    private readonly http = inject(HttpClient);
    private readonly router = inject(Router);

    // Le token d'accès est conservé uniquement en mémoire.
    private readonly accessToken = signal<string | null>(null);
    // Évite plusieurs requêtes de rafraîchissement simultanées.
    private refreshInFlight: Observable<string> | null = null;
    readonly user = signal<User | null>(null);
    /**
     * Vérifie si un token d'accès est présent.
     */
    readonly isAuthenticated = computed(() => this.accessToken() !== null);

    getAccessToken(): string | null {
        return this.accessToken();
    }

    /**
     * Connexion : récupère le token, puis charge l'utilisateur connecté.
     */
    login(payload: LoginPayload): Observable<User> {
        return this.http
            .post<AccessToken>(`${this.apiUrl}/login/`, payload, { withCredentials: true })
            .pipe(
                tap(({ access }) => {
                    this.accessToken.set(access);
                }),
                switchMap(() => this.loadCurrentUser()),
                catchError((error) => {
                    this.clear();
                    return throwError(() => error);
                })
            );
    }

    /**
     * Inscription du fondateur et création de son entreprise.
     */
    register(payload: RegisterPayload): Observable<User> {
        return this.http.post<User>(`${this.apiUrl}/register/`, payload);
    }

    /**
     * Récupération du profil connecté.
     */
    loadCurrentUser(): Observable<User> {
        return this.http.get<User>(`${this.apiUrl}/me/`).pipe(tap((user) => this.user.set(user)));
    }

    /**
     * Renouvelle le token d'accès grâce au cookie HttpOnly.
     */
    refresh(): Observable<string> {
        if (!this.refreshInFlight) {
            this.refreshInFlight = this.http
                .post<AccessToken>(`${this.apiUrl}/refresh/`, {}, { withCredentials: true })
                .pipe(
                    map((response) => response.access),
                    tap((access) => {
                        this.accessToken.set(access);
                    }),
                    catchError((error) => {
                        this.clear();
                        return throwError(() => error);
                    }),
                    finalize(() => {
                        this.refreshInFlight = null;
                    }),
                    shareReplay({
                        bufferSize: 1,
                        refCount: false
                    })
                );
        }

        return this.refreshInFlight;
    }

    /**
     * Restaure la session après un rechargement de page.
     */
    restoreSession(): Observable<boolean> {
        return this.refresh().pipe(
            switchMap(() => this.loadCurrentUser()),
            map(() => true),
            catchError(() => {
                this.clear();
                return of(false);
            })
        );
    }

    /**
     * Déconnexion côté API, puis nettoyage local.
     */
    logout(): void {
        this.http
            .post(
                `${this.apiUrl}/logout/`,
                {},
                { withCredentials: true }
            )
            .pipe(
                catchError(() => of(null)),
                finalize(() => {
                    this.clear();
                    void this.router.navigate(['/auth/login']);
                })
            )
            .subscribe();
    }

    /**
     * Efface les informations de session en mémoire.
     */
    clear(): void {
        this.accessToken.set(null);
        this.user.set(null);
    }


    /**
     * Liste des utilisateurs.
     * À réserver aux utilisateurs autorisés par le backend.
     */
    getUsers(): Observable<User[]> {
        return this.http.get<User[]>(
            `${this.apiUrl}/users/`
        );
    }

    /**
     * Récupère un utilisateur par son identifiant.
     */
    getUserById(id: string): Observable<User> {
        return this.http.get<User>(
            `${this.apiUrl}/users/${encodeURIComponent(id)}/`
        );
    }

    /**
     * Modifie les informations autorisées du profil connecté.
     */
    updateCurrentUser(
        payload: Partial<Pick<User, 'first_name' | 'last_name'>>
    ): Observable<User> {
        return this.http
            .patch<User>(
                `${this.apiUrl}/me/`,
                payload,
                { withCredentials: true }
            )
            .pipe(
                tap((user) => this.user.set(user))
            );
    }
    // submitRequest(
    //     payload: AccessRequestPayload
    // ): Observable<AccessRequestResponse> {
    //     return this.http.post<AccessRequestResponse>(
    //         `${this.apiUrl}/access-requests/`,
    //         payload
    //     );
    // }


    /**
     * Récupère le profil de l'utilisateur connecté.
     */
    getProfile(): Observable<UserProfile> {
        return this.http.get<UserProfile>(`${this.apiUrl}/`, { withCredentials: true });
    }

    /**
     * Modifie le profil de l'utilisateur connecté.
     */
    updateProfile(
        payload: UpdateProfilePayload
    ): Observable<UserProfile> {
        return this.http.patch<UserProfile>(
            `${this.apiUrl}/`,
            payload,
            { withCredentials: true }
        );
    }

    /**
     * Change le mot de passe.
     */
    changePassword(
        payload: ChangePasswordPayload
    ): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(
            `${this.apiUrl}/change-password/`,
            payload,
            { withCredentials: true }
        );
    }

    uploadAvatar(file: File): Observable<any> {
        const formData = new FormData();
        formData.append('avatar', file);

        return this.http.post(
            `${this.apiUrl}/auth/upload-avatar/`,
            formData
        );
    }

    deleteAvatar(): Observable<any> {
        return this.http.delete(
            `${this.apiUrl}/auth/delete-avatar/`
        );
    }

    /**
     * Génère les informations nécessaires à la configuration du 2FA.
     */
    setupTwoFactor(): Observable<TwoFactorSetupResponse> {
        return this.http.post<TwoFactorSetupResponse>(
            `${this.apiUrl}/2fa/setup/`,
            {},
            { withCredentials: true }
        );
    }

    /**
     * Active le 2FA après vérification du code.
     */
    enableTwoFactor(
        code: string
    ): Observable<TwoFactorEnableResponse> {
        return this.http.post<TwoFactorEnableResponse>(
            `${this.apiUrl}/2fa/enable/`,
            { code },
            { withCredentials: true }
        );
    }

    /**
     * Désactive le 2FA après vérification du code.
     */
    disableTwoFactor(
        code: string
    ): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(
            `${this.apiUrl}/2fa/disable/`,
            { code },
            { withCredentials: true }
        );
    }


}
