import { Routes } from '@angular/router';
import { Access } from './access';
import { Login } from './login';
import { Error } from './error';

export default [
    { path: 'access', component: Access, title: 'Accès refusé' },
    { path: 'error', component: Error, title: 'Erreur' },
    { path: 'login', component: Login, title: 'Connexion' }
] as Routes;
