import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Documentation } from './app/pages/documentation/documentation';
import { Landing } from './app/pages/landing/landing';
import { Notfound } from './app/pages/notfound/notfound';
import { AppConstantRoute } from '@/app/constants';

export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        children: [

            { path: '', component: Dashboard },

            {
                path: AppConstantRoute.Actif_PATH,
                loadComponent: () => import('./app/pages/actif/actif').then((c) => c.ActifComponent),
                data: { breadcrumb: 'Actif' },
            },
            // {
            //     path: AppConstantRoute.Detail_Actif_PATH,
            //     loadComponent: () => import('./app/pages/detail-actif/detail-actif').then((c) => c.DetailActif),
            //     data: { breadcrumb: 'Detail-actif' },
            // },

            {
                path: `${AppConstantRoute.Detail_Actif_PATH}/:id`,
                loadComponent: () => import('./app/pages/detail-actif/detail-actif')
                    .then((c) => c.DetailActif),
                data: { breadcrumb: 'Detail-actif' }
            },


            {
                path: AppConstantRoute.Profil_PATH,
                loadComponent: () => import('./app/pages/auth/profile').then((c) => c.Profile),
                data: { breadcrumb: 'Profil' },
            },
            {
                path: AppConstantRoute.Actualite_PATH,
                loadComponent: () => import('@/app/pages/commons/actualites/actualites').then((c) => c.ActualitesComponent),
                data: { breadcrumb: 'Actualité' },
            },
            {
                path: AppConstantRoute.ComparaisonActif_PATH,
                loadComponent: () => import('@/app/pages/commons/comparaison-actif/comparaison-actif').then((c) => c.ComparaisonActifComponent),
                data: { breadcrumb: 'ComparairéActifs' },
            },

            { path: 'uikit', loadChildren: () => import('./app/pages/uikit/uikit.routes') },
            { path: 'documentation', component: Documentation },
            { path: 'pages', loadChildren: () => import('./app/pages/pages.routes') }
        ]
    },
    { path: 'landing', component: Landing },
    { path: 'notfound', component: Notfound },
    {
        path: AppConstantRoute.Register_PATH,
        loadComponent: () => import('./app/pages/auth/register').then((c) => c.Register),
        data: { breadcrumb: 'Register' },
    },
    { path: 'auth', loadChildren: () => import('./app/pages/auth/auth.routes') },
    { path: '**', redirectTo: '/notfound' }
];
