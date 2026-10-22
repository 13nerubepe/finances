import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
    AbstractControl,
    FormBuilder, FormControl, FormGroup,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
    Validators
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { apiErrorMessage } from '@/app/models/api-errors';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { Badge } from 'primeng/badge';
import { Avatar } from 'primeng/avatar';
import { Password } from 'primeng/password';


type Feedback = { type: 'success' | 'error'; text: string } | null;

const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const newPasswordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('new_password')?.value;
    const confirm = group.get('confirm_new_password')?.value;

    return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
};



/** Current user: name and language (GET/PATCH /auth/me/), companies and roles. */
@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [ReactiveFormsModule, ButtonModule, InputTextModule, SelectModule, TagModule, Avatar, Password],
    templateUrl: 'profile.html'
    // template: `
    //     <div class="grid grid-cols-12 gap-6">
    //         <div class="col-span-12 lg:col-span-7">
    //             <div class="card !mb-0">
    //                 <h2 class="mb-1 mt-0 !text-xl font-semibold">Mon profil</h2>
    //                 <p class="mb-6 mt-0 text-sm text-surface-500">{{ auth.user()?.email }}</p>
    //
    //                 <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-col gap-5">
    //                     <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
    //                         <div class="flex flex-col gap-2">
    //                             <label for="first_name" class="text-sm font-semibold">Prénom</label>
    //                             <input pInputText id="first_name" formControlName="first_name" maxlength="150" />
    //                         </div>
    //                         <div class="flex flex-col gap-2">
    //                             <label for="last_name" class="text-sm font-semibold">Nom</label>
    //                             <input pInputText id="last_name" formControlName="last_name" maxlength="150" />
    //                         </div>
    //                     </div>
    //
    //                     <div class="flex flex-col gap-2">
    //                         <label for="language" class="text-sm font-semibold">Langue</label>
    //                         <p-select inputId="language" formControlName="language" [options]="languages" optionLabel="label" optionValue="value" class="w-full sm:w-64" />
    //                         <small class="text-surface-500">Langue des réponses de l'assistant juridique.</small>
    //                     </div>
    //
    //                     @if (errorMessage()) {
    //                         <p class="m-0 text-sm text-red-600" role="alert">{{ errorMessage() }}</p>
    //                     }
    //                     @if (saved()) {
    //                         <p class="m-0 text-sm text-green-600" role="status">Profil enregistré.</p>
    //                     }
    //
    //                     <div>
    //                         <p-button type="submit" label="Enregistrer" icon="pi pi-check" [loading]="saving()" [disabled]="form.pristine" />
    //                     </div>
    //                 </form>
    //             </div>
    //         </div>
    //
    //         <div class="col-span-12 lg:col-span-5">
    //             <div class="card !mb-0">
    //                 <h2 class="mb-4 mt-0 !text-xl font-semibold">Mes entreprises</h2>
    //                 @for (m of auth.user()?.memberships ?? []; track m.company_id) {
    //                     <div class="flex items-center justify-between border-b border-surface-200 py-3 last:border-0 dark:border-surface-700">
    //                         <div>
    //                             <div class="font-medium">{{ m.company_name }}</div>
    //                             <div class="text-xs text-surface-500">{{ m.country }}</div>
    //                         </div>
    //                         <p-tag [value]="m.role === 'founder' ? 'Fondateur' : 'Employé'" [severity]="m.role === 'founder' ? 'warn' : 'secondary'" />
    //                     </div>
    //                 } @empty {
    //                     <p class="m-0 text-sm text-surface-500">Aucune entreprise.</p>
    //                 }
    //             </div>
    //         </div>
    //     </div>
    // `
})
export class Profile implements OnInit {
    private readonly fb = inject(FormBuilder);
    private readonly actifService = inject(ActifService);

    // ---------- Photo ----------
    readonly avatarUrl = signal<string | null>(null);
    readonly photoError = signal('');

    // ---------- Profil ----------
    readonly savingProfile = signal(false);
    readonly profileMessage = signal<Feedback>(null);

    readonly profileForm = this.fb.nonNullable.group({
        full_name: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        phone: ['', [Validators.pattern(/^\+?[0-9\s]{8,15}$/)]],
    });

    readonly initials = computed(() => {
        const name = this.fullName();
        return name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0].toUpperCase())
            .join('');
    });
    private readonly fullName = signal('');

    // ---------- Mot de passe ----------
    readonly savingPassword = signal(false);
    readonly passwordMessage = signal<Feedback>(null);

    readonly passwordForm = this.fb.nonNullable.group(
        {
            current_password: ['', Validators.required],
            new_password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?!\d+$).+$/)]],
            confirm_new_password: ['', Validators.required],
        },
        { validators: newPasswordsMatch },
    );

    // ---------- Double authentification ----------
    readonly twoFactorEnabled = signal(false);
    readonly twoFactorSetup = signal<{ qrCode: string; secret: string } | null>(null);
    readonly twoFactorLoading = signal(false);
    readonly twoFactorMessage = signal<Feedback>(null);
    readonly backupCodes = signal<string[]>([]);
    readonly confirmingDisable = signal(false);

    readonly twoFactorCode = new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    });

    ngOnInit(): void {
        this.actifService.getProfile().subscribe({
            next: (user) => {
                this.profileForm.reset({
                    full_name: user.full_name,
                    email: user.email,
                    phone: user.phone ?? '',
                });
                this.fullName.set(user.full_name);
                this.avatarUrl.set(user.avatar_url ?? null);
                this.twoFactorEnabled.set(!!user.two_factor_enabled);
            },
            error: (error) => this.profileMessage.set({ type: 'error', text: apiErrorMessage(error) }),
        });
    }

    isInvalid(form: FormGroup, controlName: string): boolean {
        const control = form.get(controlName);
        return !!control && control.invalid && (control.touched || control.dirty);
    }

    passwordMismatch(): boolean {
        return this.passwordForm.hasError('passwordMismatch') && !!this.passwordForm.get('confirm_new_password')?.touched;
    }

    // ---------- Photo ----------
    onPhotoSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = ''; // permet de re-sélectionner le même fichier

        if (!file) return;

        this.photoError.set('');

        if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
            this.photoError.set('Format non supporté. Utilisez JPG, PNG ou WebP.');
            return;
        }
        if (file.size > MAX_PHOTO_SIZE) {
            this.photoError.set('La photo dépasse 2 Mo.');
            return;
        }

        this.actifService.uploadAvatar(file).subscribe({
            next: (res) => this.avatarUrl.set(res.avatar_url),
            error: (error) => this.photoError.set(apiErrorMessage(error)),
        });
    }

    removePhoto(): void {
        this.actifService.deleteAvatar().subscribe({
            next: () => this.avatarUrl.set(null),
            error: (error) => this.photoError.set(apiErrorMessage(error)),
        });
    }

    // ---------- Profil ----------
    saveProfile(): void {
        this.profileMessage.set(null);

        if (this.profileForm.invalid) {
            this.profileForm.markAllAsTouched();
            return;
        }

        this.savingProfile.set(true);

        this.actifService.updateProfile(this.profileForm.getRawValue()).subscribe({
            next: (user) => {
                this.savingProfile.set(false);
                this.fullName.set(user.full_name);
                this.profileForm.markAsPristine();
                this.profileMessage.set({ type: 'success', text: 'Profil mis à jour.' });
            },
            error: (error) => {
                this.savingProfile.set(false);
                this.profileMessage.set({ type: 'error', text: apiErrorMessage(error) });
            },
        });
    }

    // ---------- Mot de passe ----------
    changePassword(): void {
        this.passwordMessage.set(null);

        if (this.passwordForm.invalid) {
            this.passwordForm.markAllAsTouched();
            return;
        }

        this.savingPassword.set(true);
        const { current_password, new_password } = this.passwordForm.getRawValue();

        this.actifService.changePassword({ current_password, new_password }).subscribe({
            next: () => {
                this.savingPassword.set(false);
                this.passwordForm.reset();
                this.passwordMessage.set({ type: 'success', text: 'Mot de passe modifié.' });
            },
            error: (error) => {
                this.savingPassword.set(false);
                this.passwordMessage.set({ type: 'error', text: apiErrorMessage(error) });
            },
        });
    }

    // ---------- Double authentification ----------
    startTwoFactorSetup(): void {
        this.twoFactorMessage.set(null);
        this.twoFactorLoading.set(true);

        this.actifService.twoFactorSetup().subscribe({
            next: (setup) => {
                this.twoFactorLoading.set(false);
                this.twoFactorCode.reset();
                this.twoFactorSetup.set({ qrCode: setup.qr_code, secret: setup.secret });
            },
            error: (error) => {
                this.twoFactorLoading.set(false);
                this.twoFactorMessage.set({ type: 'error', text: apiErrorMessage(error) });
            },
        });
    }

    cancelTwoFactorSetup(): void {
        this.twoFactorSetup.set(null);
        this.twoFactorCode.reset();
    }

    confirmTwoFactor(): void {
        if (this.twoFactorCode.invalid) return;

        this.twoFactorLoading.set(true);

        this.actifService.twoFactorEnable(this.twoFactorCode.value).subscribe({
            next: (res) => {
                this.twoFactorLoading.set(false);
                this.twoFactorEnabled.set(true);
                this.twoFactorSetup.set(null);
                this.backupCodes.set(res.backup_codes ?? []);
                this.twoFactorCode.reset();
                this.twoFactorMessage.set({ type: 'success', text: 'Double authentification activée.' });
            },
            error: (error) => {
                this.twoFactorLoading.set(false);
                this.twoFactorMessage.set({ type: 'error', text: apiErrorMessage(error) });
            },
        });
    }

    disableTwoFactor(): void {
        if (this.twoFactorCode.invalid) return;

        this.twoFactorLoading.set(true);

        this.actifService.twoFactorDisable(this.twoFactorCode.value).subscribe({
            next: () => {
                this.twoFactorLoading.set(false);
                this.twoFactorEnabled.set(false);
                this.confirmingDisable.set(false);
                this.backupCodes.set([]);
                this.twoFactorCode.reset();
                this.twoFactorMessage.set({ type: 'success', text: 'Double authentification désactivée.' });
            },
            error: (error) => {
                this.twoFactorLoading.set(false);
                this.twoFactorMessage.set({ type: 'error', text: apiErrorMessage(error) });
            },
        });
    }
}
