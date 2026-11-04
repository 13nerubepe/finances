import { Component, computed, inject } from '@angular/core';
import { MenuItem } from 'primeng/api';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StyleClassModule } from 'primeng/styleclass';
import { AppConfigurator } from './app.configurator';
import { LayoutService } from '@/app/pages/service/service/layout.service';
import { Avatar } from 'primeng/avatar';
import { Menu } from 'primeng/menu';
import { AuthService } from '@/app/pages/service/service/auth.service';
import { OverlayBadge } from 'primeng/overlaybadge';

@Component({
    selector: 'app-topbar',
    standalone: true,
    imports: [RouterModule, CommonModule, StyleClassModule, AppConfigurator, Avatar, Menu],
    template: ` <div class="layout-topbar">
        <div class="layout-topbar-logo-container">
            <button class="layout-menu-button layout-topbar-action" (click)="layoutService.onMenuToggle()">
                <i class="pi pi-bars"></i>
            </button>
            <a class="layout-topbar-logo" routerLink="/">
                <svg
                    viewBox="0 0 54 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-label="Logo MEFA"
                    role="img"
                >
                    <defs>
                        <linearGradient
                            id="mefa-orange"
                            x1="5"
                            y1="0"
                            x2="48"
                            y2="40"
                            gradientUnits="userSpaceOnUse"
                        >
                            <stop offset="0%" stop-color="#FFB52E" />
                            <stop offset="50%" stop-color="#FF7900" />
                            <stop offset="100%" stop-color="#E94B00" />
                        </linearGradient>
                    </defs>

                    <!-- M stylisé -->
                    <path
                        d="M5 32V11C5 6 11 4 14 8L27 20L40 8C43 4 49 6 49 11V28L42 24V14L30 25C28 27 26 27 24 25L12 14V32H5Z"
                        fill="url(#mefa-orange)"
                    />

                    <!-- Barres financières -->
                    <path
                        d="M15 32V26H19V32H15Z
               M22 32V22H27V32H22Z
               M30 32V17H35V32H30Z"
                        fill="url(#mefa-orange)"
                    />

                    <!-- Courbe de croissance -->
                    <path
                        d="M4 34C17 40 32 33 44 19"
                        stroke="url(#mefa-orange)"
                        stroke-width="2.5"
                        stroke-linecap="round"
                    />

                    <!-- Flèche ascendante -->
                    <path
                        d="M39 17L49 13L47 24L44 21L41 24Z"
                        fill="#FF9A00"
                    />
                </svg>
                <span>MEFA</span>
            </a>
        </div>

        <div class="layout-topbar-actions">
            <div class="layout-config-menu">
                <button type="button" class="layout-topbar-action" (click)="toggleDarkMode()">
                    <i [ngClass]="{ 'pi': true, 'pi-moon': layoutService.isDarkTheme(), 'pi-sun': !layoutService.isDarkTheme() }"></i>
                </button>
                <div class="relative">
                    <button
                        class="layout-topbar-action layout-topbar-action-highlight"
                        pStyleClass="@next"
                        enterFromClass="hidden"
                        enterActiveClass="animate-scalein"
                        leaveToClass="hidden"
                        leaveActiveClass="animate-fadeout"
                        [hideOnOutsideClick]="true"
                    >
                        <i class="pi pi-palette"></i>
                    </button>
                    <app-configurator />
                </div>
            </div>

            <button class="layout-topbar-menu-button layout-topbar-action" pStyleClass="@next" enterFromClass="hidden" enterActiveClass="animate-scalein" leaveToClass="hidden" leaveActiveClass="animate-fadeout" [hideOnOutsideClick]="true">
                <i class="pi pi-ellipsis-v"></i>
            </button>

            <div class="layout-topbar-menu hidden lg:block">
                <div class="layout-topbar-menu-content">
<!--                    <button type="button" class="layout-topbar-action" title="Notifications">-->
<!--                        <p-overlaybadge value="2" severity="danger">-->
<!--                            <i class="pi pi-bell"></i>-->
<!--                        </p-overlaybadge>-->
<!--                        <span>Notifications</span>-->
<!--                    </button>-->

<!--                    <button type="button" class="layout-topbar-action">-->
<!--                        <i class="pi pi-inbox"></i>-->
<!--                        <span>Messages</span>-->
<!--                    </button>-->

                    <button type="button" class="layout-topbar-action" aria-haspopup="true" (click)="userMenu.toggle($event)">
                        <p-avatar [label]="initials()" shape="circle" />
                        <span>{{ displayName() }}</span>
                        <i class="pi pi-angle-down"></i>
                    </button>
                    <p-menu #userMenu [model]="userItems" [popup]="true" appendTo="body" />
                </div>
            </div>
        </div>
    </div>`
})
export class AppTopbar {
    private router = inject(Router);
    private readonly authService = inject(AuthService);

    displayName = computed(() => this.authService.user()?.email?.split('@')[0] ?? 'Utilisateur');
    initials = computed(() => this.displayName().slice(0, 2).toUpperCase());

    // Fonction de déconnexion
    seDeconnecter(): void {
        this.authService.logout();
    }
    userItems: MenuItem[] = [
        { label: 'Mon profil', icon: 'pi pi-user', command: () => this.router.navigate(['/profil']) },
        // { label: 'Paramètres', icon: 'pi pi-cog', command: () => this.router.navigate(['/parametres']) },
        { label: 'Aide', icon: 'pi pi-question-circle', command: () => this.router.navigate(['/aide']) },
        // { label: 'Actualités', icon: 'pi pi-fw pi-home', routerLink: ['/actualités'] },
        { separator: true },
        // { label: 'Se déconnecter', icon: 'pi pi-sign-out', styleClass: 'text-red-500', command: () => this.authService.logout() }
        { label: 'Se déconnecter', icon: 'pi pi-sign-out', styleClass: 'text-red-500', command: () => this.seDeconnecter() }
    ];



    items!: MenuItem[];
    layoutService = inject(LayoutService);
    auth = inject(AuthService);

    toggleDarkMode() {
        this.layoutService.layoutConfig.update((state) => ({
            ...state,
            darkTheme: !state.darkTheme
        }));
    }
}
