import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '@/app/pages/service/service/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);

    // Ces routes ne doivent ni recevoir le token, ni relancer un rafraîchissement.
    const routePublique = ['/auth/connexion/', '/auth/inscription/', '/auth/rafraichir/', '/auth/deconnexion/'].some((route) =>
        req.url.includes(route)
    );

    if (routePublique) {
        return next(req);
    }

    const ajouterToken = (token: string | null) =>
        token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

    return next(ajouterToken(authService.getAccessToken())).pipe(
        catchError((erreur: HttpErrorResponse) => {
            if (erreur.status !== 401 || !authService.getAccessToken()) {
                return throwError(() => erreur);
            }

            // Token expiré : on en demande un nouveau, puis on rejoue la requête.
            return authService.refresh().pipe(switchMap((token) => next(ajouterToken(token))));
        })
    );
};
