import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RoutineService } from '../../../core/services/routine.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule],
  styleUrls: ['./login.component.scss'],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);
  private routineSvc = inject(RoutineService);

  email    = '';
  password = '';
  loading  = signal(false);
  error    = signal('');

  readonly heroFeatures = [
    { icon: '🧮', text: 'Cálculo preciso de TMB e macronutrientes' },
    { icon: '🩸', text: 'Análise inteligente de exames de sangue' },
    { icon: '📅', text: 'Rotina personalizada com time-blocking' },
    { icon: '💧', text: 'Controle inteligente de hidratação e metas' },
  ];

  submit(): void {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.email, this.password).subscribe({
      next: () => this.handlePostLoginRedirect(),
      error: (e) => {
        this.error.set(e.error?.message ?? 'Erro ao fazer login. Tente novamente.');
        this.loading.set(false);
      },
    });
  }

  private handlePostLoginRedirect(): void {
    this.routineSvc.load().subscribe({
      next: blocks => {
        const hasWorkoutInAgenda = blocks.some(b => b.type === 'exercise');
        const noInterestInRecurring = localStorage.getItem('ha_workout_recurring_pref') === 'skip';

        this.loading.set(false);

        if (hasWorkoutInAgenda && !noInterestInRecurring) {
          this.router.navigate(['/workouts'], { queryParams: { setupRecurring: 1 } });
          return;
        }

        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/dashboard']);
      },
    });
  }
}
