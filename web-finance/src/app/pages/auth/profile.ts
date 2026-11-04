import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { DatePipe, NgClass } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';

import { apiErrorMessage } from '@/app/models/api-errors';
import { UserProfile } from '@/app/models/auth.models';
import { AuthService } from '@/app/pages/service/service/auth.service';

type Feedback = { type: 'success' | 'error'; text: string } | null;

const newPasswordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('new_password')?.value;
    const confirm = group.get('confirm_new_password')?.value;

    return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
};

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [DatePipe, NgClass, ReactiveFormsModule, ButtonModule, InputTextModule, PasswordModule],
    templateUrl: './profile.html'
})
export class Profile implements OnInit {
    private readonly fb = inject(FormBuilder);
    private readonly authService = inject(AuthService);

    readonly onglet = signal<'profil' | 'securite'>('profil');
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

    // Profil
    readonly savingProfile = signal(false);
    readonly profileMessage = signal<Feedback>(null);
    readonly profileForm = this.fb.nonNullable.group({
        first_name: ['', Validators.required],
        last_name: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', Validators.required]
    });

    // Mot de passe
    readonly savingPassword = signal(false);
    readonly passwordMessage = signal<Feedback>(null);
    readonly passwordForm = this.fb.nonNullable.group(
        {
            current_password: ['', Validators.required],
            new_password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?!\d+$).+$/)]],
            confirm_new_password: ['', Validators.required]
        },
        { validators: newPasswordsMatch }
    );

    ngOnInit(): void {
        // L'utilisateur déjà connu s'affiche tout de suite, sans attendre l'API.
        const user = this.authService.user();

        if (user) {
            this.appliquerProfil(user);
            return;
        }

        this.getProfile();
    }

    getProfile(): void {
        this.loading.set(true);
        this.errorMessage.set('');

        this.authService.getProfile().subscribe({
            next: (user) => {
                this.appliquerProfil(user);
                this.loading.set(false);
            },
            error: (error) => {
                this.errorMessage.set(apiErrorMessage(error));
                this.loading.set(false);
            }
        });
    }

    private appliquerProfil(user: UserProfile): void {
        this.profile.set(user);
        this.profileForm.reset({
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email ?? '',
            phone: user.phone
        });
    }

    isInvalid(form: FormGroup, controlName: string): boolean {
        const control = form.get(controlName);

        return !!control && control.invalid && (control.touched || control.dirty);
    }

    passwordMismatch(): boolean {
        return this.passwordForm.hasError('passwordMismatch') && !!this.passwordForm.get('confirm_new_password')?.touched;
    }

    saveProfile(): void {
        this.profileMessage.set(null);

        if (this.profileForm.invalid) {
            this.profileForm.markAllAsTouched();
            return;
        }

        this.savingProfile.set(true);

        this.authService.updateProfile(this.profileForm.getRawValue()).subscribe({
            next: (user) => {
                this.appliquerProfil(user);
                this.savingProfile.set(false);
                this.profileMessage.set({ type: 'success', text: 'Profil mis à jour.' });
            },
            error: (error) => {
                this.savingProfile.set(false);
                this.profileMessage.set({ type: 'error', text: apiErrorMessage(error) });
            }
        });
    }

    changePassword(): void {
        this.passwordMessage.set(null);

        if (this.passwordForm.invalid) {
            this.passwordForm.markAllAsTouched();
            return;
        }

        this.savingPassword.set(true);
        const values = this.passwordForm.getRawValue();

        this.authService.changePassword({ current_password: values.current_password, new_password: values.new_password }).subscribe({
            next: () => {
                this.savingPassword.set(false);
                this.passwordForm.reset();
                this.passwordMessage.set({ type: 'success', text: 'Mot de passe modifié. Vos autres sessions ont été fermées.' });
            },
            error: (error) => {
                this.savingPassword.set(false);
                this.passwordMessage.set({ type: 'error', text: apiErrorMessage(error) });
            }
        });
    }
}
