import { Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, FormsModule],
  styleUrls: ['./register.component.scss'],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  name = ''; email = ''; password = ''; confirm = '';
  loading = signal(false);
  error   = signal('');

  submit(): void {
    if (!this.name || !this.email || !this.password) return;
    if (this.password !== this.confirm) return;

    this.loading.set(true);
    this.error.set('');

    this.auth.register(this.email, this.name, this.password).subscribe({
      next: () => this.router.navigate(['/onboarding']),
      error: (e) => {
        this.error.set(e.error?.message ?? 'Erro ao criar conta.');
        this.loading.set(false);
      },
    });
  }
}
