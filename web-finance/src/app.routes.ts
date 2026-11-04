import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Documentation } from './app/pages/documentation/documentation';
import { Landing } from './app/pages/landing/landing';
import { Notfound } from './app/pages/notfound/notfound';
import { AppConstantRoute } from '@/app/constants';
import { authGuard } from '@/app/pages/service/service/auth.guard';

export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        // canActivate: [authGuard],
        children: [

            { path: '', component: Dashboard, title: 'Tableau de bord' },

            {
                path: AppConstantRoute.Actif_PATH,
                title: 'Actifs',
                loadComponent: () => import('./app/pages/actif/actif').then((c) => c.ActifComponent),
                data: { breadcrumb: 'Actif' },
            },

            {
                path: `${AppConstantRoute.Detail_Actif_PATH}/:symbole`,
                title: 'Détail de l\'actif',
                loadComponent: () => import('./app/pages/detail-actif/detail-actif')
                    .then((c) => c.DetailActif),
                data: { breadcrumb: 'Detail-actif' }
            },


            {
                path: AppConstantRoute.Portefeuilles_PATH,
                title: 'Portefeuilles',
                loadComponent: () => import('./app/pages/portefeuilles/portefeuilles').then((c) => c.PortefeuillesComponent),
                data: { breadcrumb: 'Portefeuilles' },
            },
            {
                path: AppConstantRoute.Profil_PATH,
                title: 'Profil',
                loadComponent: () => import('./app/pages/auth/profile').then((c) => c.Profile),
                data: { breadcrumb: 'Profil' },
            },
            {
                path: AppConstantRoute.Actualite_PATH,
                title: 'Actualités',
                loadComponent: () => import('@/app/pages/commons/actualites/actualites').then((c) => c.ActualitesComponent),
                data: { breadcrumb: 'Actualité' },
            },
            {
                path: AppConstantRoute.ComparaisonActif_PATH,
                title: 'Comparaison d\'actifs',
                loadComponent: () => import('@/app/pages/commons/comparaison-actif/comparaison-actif').then((c) => c.ComparaisonActifComponent),
                data: { breadcrumb: 'ComparairéActifs' },
            },

            { path: 'uikit', loadChildren: () => import('./app/pages/uikit/uikit.routes') },
            { path: 'documentation', component: Documentation },
            { path: 'pages', loadChildren: () => import('./app/pages/pages.routes') }
        ]
    },
    { path: 'landing', component: Landing },
    { path: 'notfound', component: Notfound, title: 'Page introuvable' },
    {
        path: AppConstantRoute.Register_PATH,
        title: 'Inscription',
        loadComponent: () => import('./app/pages/auth/register').then((c) => c.Register),
        data: { breadcrumb: 'Register' },
    },
    { path: 'auth', loadChildren: () => import('./app/pages/auth/auth.routes') },
    { path: '**', redirectTo: '/notfound' }
];
