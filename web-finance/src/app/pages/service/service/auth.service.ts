import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '@/environments/environment';
import {
    AccessToken,
    ChangePasswordPayload,
    LoginPayload,
    RegisterPayload,
    UpdateProfilePayload,
    User,
    UserProfile
} from '@/app/models/auth.models';

/**
 * Gestion de la session.
 *
 * Le token d'accès reste en mémoire. Le token de rafraîchissement est un cookie
 * httpOnly posé par l'API : le navigateur l'envoie lui-même avec `withCredentials`.
 * Après un rechargement, `restoreSession()` obtient un nouveau token d'accès.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly apiUrl = `${environment.apiUrl.replace(/\/+$/, '')}/auth`;
    private readonly http = inject(HttpClient);
    private readonly router = inject(Router);

    private readonly accessToken = signal<string | null>(null);
    // Évite plusieurs requêtes de rafraîchissement simultanées.
    private refreshInFlight: Observable<string> | null = null;

    readonly user = signal<User | null>(null);
    readonly isAuthenticated = computed(() => this.accessToken() !== null);

    getAccessToken(): string | null {
        return this.accessToken();
    }

    /** Connexion : récupère le token, puis charge l'utilisateur connecté. */
    login(payload: LoginPayload): Observable<User> {
        return this.http.post<AccessToken>(`${this.apiUrl}/connexion/`, payload, { withCredentials: true }).pipe(
            tap(({ access }) => this.accessToken.set(access ?? null)),
            switchMap(() => this.loadCurrentUser()),
            catchError((error) => {
                this.clear();
                return throwError(() => error);
            })
        );
    }

    register(payload: RegisterPayload): Observable<User> {
        return this.http.post<User>(`${this.apiUrl}/inscription/`, payload);
    }

    /** Charge le profil et le garde en mémoire. */
    loadCurrentUser(): Observable<User> {
        return this.getProfile().pipe(tap((user) => this.user.set(user)));
    }

    getProfile(): Observable<UserProfile> {
        return this.http.get<UserProfile>(`${this.apiUrl}/profile/`);
    }

    /** Renouvelle le token d'accès grâce au cookie httpOnly. */
    refresh(): Observable<string> {
        if (!this.refreshInFlight) {
            this.refreshInFlight = this.http.post<AccessToken>(`${this.apiUrl}/rafraichir/`, {}, { withCredentials: true }).pipe(
                map((response) => response.access ?? ''),
                tap((access) => this.accessToken.set(access)),
                catchError((error) => {
                    this.clear();
                    return throwError(() => error);
                }),
                finalize(() => {
                    this.refreshInFlight = null;
                }),
                shareReplay({ bufferSize: 1, refCount: false })
            );
        }

        return this.refreshInFlight;
    }

    /** Restaure la session après un rechargement de page. */
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

    /** Déconnexion côté API, puis nettoyage local. */
    logout(): void {
        this.http
            .post(`${this.apiUrl}/deconnexion/`, {}, { withCredentials: true })
            .pipe(
                catchError(() => of(null)),
                finalize(() => {
                    this.clear();
                    void this.router.navigate(['/auth/login']);
                })
            )
            .subscribe();
    }

    /** Modifie le profil et met à jour l'utilisateur affiché. */
    updateProfile(payload: UpdateProfilePayload): Observable<UserProfile> {
        return this.http.patch<UserProfile>(`${this.apiUrl}/profile/`, payload).pipe(tap((user) => this.user.set(user)));
    }

    /** Le cookie de rafraîchissement est renouvelé par l'API. */
    changePassword(payload: ChangePasswordPayload): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(`${this.apiUrl}/mot-de-passe/`, payload, { withCredentials: true });
    }

    clear(): void {
        this.accessToken.set(null);
        this.user.set(null);
    }
}
