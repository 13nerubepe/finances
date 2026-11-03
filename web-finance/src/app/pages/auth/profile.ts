import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Avatar } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';

import { apiErrorMessage } from '@/app/models/api-errors';
import { UserProfile } from '@/app/models/auth.models';
import { AuthService } from '@/app/pages/service/service/auth.service';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [DatePipe, Avatar, ButtonModule],
    templateUrl: './profile.html'
})
export class Profile implements OnInit {
    private readonly authService = inject(AuthService);

    readonly loading = signal(false);
    readonly errorMessage = signal('');
    readonly profile = signal<UserProfile | null>(null);

    readonly fullName = computed(() => {
        const user = this.profile();
        return user ? `${user.first_name} ${user.last_name}`.trim() : '';
    });

    readonly initials = computed(() =>
        this.fullName()
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0].toUpperCase())
            .join('')
    );

    ngOnInit(): void {
        this.getProfile();
    }

    getProfile(): void {
        this.loading.set(true);
        this.errorMessage.set('');

        this.authService.getProfile().subscribe({
            next: (user) => {
                this.profile.set(user);
                this.loading.set(false);
            },
            error: (error) => {
                this.errorMessage.set(apiErrorMessage(error));
                this.loading.set(false);
            }
        });
    }
}
