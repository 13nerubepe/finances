
import { CommonModule, NgClass } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
    AbstractControl,
    FormBuilder,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
    Validators
} from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { Avatar } from 'primeng/avatar';
import { Password } from 'primeng/password';
import { InputOtp } from 'primeng/inputotp';

import { apiErrorMessage } from '@/app/models/api-errors';
import {
    UserProfile,
    UpdateProfilePayload,
    ChangePasswordPayload
} from '@/app/models/auth.models';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { AuthService } from '@/app/pages/service/service/auth.service';

type Feedback = {
    type: 'success' | 'error';
    text: string;
} | null;

const MAX_PHOTO_SIZE = 2 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp'
];

const newPasswordsMatch: ValidatorFn = (
    group: AbstractControl
): ValidationErrors | null => {
    const password = group.get('new_password')?.value;
    const confirm = group.get('confirm_new_password')?.value;

    return password && confirm && password !== confirm
        ? { passwordMismatch: true }
        : null;
};

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [
        CommonModule,
        NgClass,
        ReactiveFormsModule,
        ButtonModule,
        InputTextModule,
        SelectModule,
        TagModule,
        Avatar,
        Password,
        InputOtp
    ],
    templateUrl: './profile.html'
})
export class Profile implements OnInit {
    private readonly fb = inject(FormBuilder);

    // Profil et sécurité
    private readonly authService = inject(AuthService);

    // gestion de la photo
    private readonly actifService = inject(ActifService);

    readonly loadingProfile = signal(false);
    readonly profile = signal<UserProfile | null>(null);

    // Photo
    readonly avatarUrl = signal<string | null>(null);
    readonly photoError = signal('');

    // Profil
    readonly savingProfile = signal(false);
    readonly profileMessage = signal<Feedback>(null);

    readonly profileForm = this.fb.nonNullable.group({
        full_name: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', [Validators.pattern(/^\+?[0-9\s]{8,15}$/)]]
    });

    // Initiales du nom affiché
    private readonly fullName = signal('');

    readonly initials = computed(() =>
        this.fullName()
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(part => part[0].toUpperCase())
            .join('')
    );

    // Navigation entre les étapes de l'interface
    readonly activeStep = signal<number>(1);

    goToStep(step: number): void {
        this.activeStep.set(step);
    }

    // Mot de passe
    readonly savingPassword = signal(false);
    readonly passwordMessage = signal<Feedback>(null);

    readonly passwordForm = this.fb.nonNullable.group(
        { current_password: ['', Validators.required],
            new_password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?!\d+$).+$/)]],
            confirm_new_password: ['', Validators.required]
        },
        { validators: newPasswordsMatch }
    );

    // Double authentification
    readonly twoFactorEnabled = signal(false);
    readonly twoFactorSetup = signal<{ qrCode: string; secret: string; } | null>(null);

    readonly twoFactorLoading = signal(false);
    readonly twoFactorMessage = signal<Feedback>(null);
    readonly backupCodes = signal<string[]>([]);
    readonly confirmingDisable = signal(false);

    readonly twoFactorCode = new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^\d{6}$/)]
    });

    ngOnInit(): void {
        this.getProfile();
    }

    // Récupérer le profil depuis l'API
    getProfile(): void {
        this.loadingProfile.set(true);
        this.profileMessage.set(null);

        this.authService.getProfile().subscribe({
            next: (user) => {
                this.profile.set(user);

                this.profileForm.reset({
                    full_name: user.full_name,
                    email: user.email,
                    phone: user.phone ?? ''
                });

                this.fullName.set(user.full_name);
                this.avatarUrl.set(user.avatar_url ?? null);
                this.twoFactorEnabled.set(
                    user.two_factor_enabled
                );

                this.loadingProfile.set(false);
            },
            error: (error) => {
                this.loadingProfile.set(false);
                this.profileMessage.set({
                    type: 'error',
                    text: apiErrorMessage(error)
                });
            }
        });
    }

    // Vérifier la validité d'un champ
    isInvalid(
        form: FormGroup,
        controlName: string
    ): boolean {
        const control = form.get(controlName);

        return !!control &&
            control.invalid &&
            (control.touched || control.dirty);
    }

    passwordMismatch(): boolean {
        return this.passwordForm.hasError('passwordMismatch') &&
            !!this.passwordForm.get('confirm_new_password')?.touched;
    }

    // Sélectionner une photo
    onPhotoSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        input.value = '';

        if (!file) {
            return;
        }

        this.photoError.set('');

        if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
            this.photoError.set(
                'Format non supporté. Utilisez JPG, PNG ou WebP.'
            );
            return;
        }

        if (file.size > MAX_PHOTO_SIZE) {
            this.photoError.set('La photo dépasse 2 Mo.');
            return;
        }

        this.authService.uploadAvatar(file).subscribe({
            next: (response) => {
                this.avatarUrl.set(response.avatar_url);
            },
            error: (error) => {
                this.photoError.set(apiErrorMessage(error));
            }
        });
    }

    // Supprimer la photo
    removePhoto(): void {
        this.photoError.set('');

        this.authService.deleteAvatar().subscribe({
            next: () => {
                this.avatarUrl.set(null);
            },
            error: (error) => {
                this.photoError.set(apiErrorMessage(error));
            }
        });
    }

    // Modifier le profil
    saveProfile(): void {
        this.profileMessage.set(null);

        if (this.profileForm.invalid) {
            this.profileForm.markAllAsTouched();
            return;
        }

        this.savingProfile.set(true);

        const payload: UpdateProfilePayload =
            this.profileForm.getRawValue();

        this.authService.updateProfile(payload).subscribe({
            next: (user) => {
                this.profile.set(user);
                this.fullName.set(user.full_name);
                this.avatarUrl.set(user.avatar_url ?? null);
                this.twoFactorEnabled.set(
                    user.two_factor_enabled
                );

                this.profileForm.markAsPristine();
                this.savingProfile.set(false);

                this.profileMessage.set({
                    type: 'success',
                    text: 'Profil mis à jour.'
                });
            },
            error: (error) => {
                this.savingProfile.set(false);

                this.profileMessage.set({
                    type: 'error',
                    text: apiErrorMessage(error)
                });
            }
        });
    }

    // Changer le mot de passe
    changePassword(): void {
        this.passwordMessage.set(null);

        if (this.passwordForm.invalid) {
            this.passwordForm.markAllAsTouched();
            return;
        }

        this.savingPassword.set(true);

        const values = this.passwordForm.getRawValue();

        const payload: ChangePasswordPayload = {
            current_password: values.current_password,
            new_password: values.new_password
        };

        this.authService.changePassword(payload).subscribe({
            next: () => {
                this.savingPassword.set(false);
                this.passwordForm.reset();

                this.passwordMessage.set({
                    type: 'success',
                    text: 'Mot de passe modifié.'
                });
            },
            error: (error) => {
                this.savingPassword.set(false);

                this.passwordMessage.set({
                    type: 'error',
                    text: apiErrorMessage(error)
                });
            }
        });
    }

    // Préparer la double authentification
    startTwoFactorSetup(): void {
        this.twoFactorMessage.set(null);
        this.twoFactorLoading.set(true);

        this.authService.setupTwoFactor().subscribe({
            next: (setup) => {
                this.twoFactorLoading.set(false);
                this.twoFactorCode.reset();

                this.twoFactorSetup.set({
                    qrCode: setup.qr_code,
                    secret: setup.secret
                });
            },
            error: (error) => {
                this.twoFactorLoading.set(false);

                this.twoFactorMessage.set({
                    type: 'error',
                    text: apiErrorMessage(error)
                });
            }
        });
    }

    // Annuler la configuration
    cancelTwoFactorSetup(): void {
        this.twoFactorSetup.set(null);
        this.twoFactorCode.reset();
    }

    // Confirmer l'activation
    confirmTwoFactor(): void {
        if (this.twoFactorCode.invalid) {
            this.twoFactorCode.markAsTouched();
            return;
        }

        this.twoFactorLoading.set(true);
        this.twoFactorMessage.set(null);

        this.authService
            .enableTwoFactor(this.twoFactorCode.value)
            .subscribe({
                next: (response) => {
                    this.twoFactorLoading.set(false);
                    this.twoFactorEnabled.set(true);
                    this.twoFactorSetup.set(null);
                    this.backupCodes.set(
                        response.backup_codes ?? []
                    );
                    this.twoFactorCode.reset();

                    this.twoFactorMessage.set({
                        type: 'success',
                        text: 'Double authentification activée.'
                    });
                },
                error: (error) => {
                    this.twoFactorLoading.set(false);

                    this.twoFactorMessage.set({
                        type: 'error',
                        text: apiErrorMessage(error)
                    });
                }
            });
    }

    // Désactiver la double authentification
    disableTwoFactor(): void {
        if (this.twoFactorCode.invalid) {
            this.twoFactorCode.markAsTouched();
            return;
        }

        this.twoFactorLoading.set(true);
        this.twoFactorMessage.set(null);

        this.authService
            .disableTwoFactor(this.twoFactorCode.value)
            .subscribe({
                next: () => {
                    this.twoFactorLoading.set(false);
                    this.twoFactorEnabled.set(false);
                    this.confirmingDisable.set(false);
                    this.backupCodes.set([]);
                    this.twoFactorCode.reset();

                    this.twoFactorMessage.set({
                        type: 'success',
                        text: 'Double authentification désactivée.'
                    });
                },
                error: (error) => {
                    this.twoFactorLoading.set(false);

                    this.twoFactorMessage.set({
                        type: 'error',
                        text: apiErrorMessage(error)
                    });
                }
            });
    }
}
