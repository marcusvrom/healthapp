import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule],
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1fr 1fr;
      @media (max-width: 768px) { grid-template-columns: 1fr; }
    }

    /* Left – hero */
    .hero {
      background: linear-gradient(135deg, #064e3b 0%, #065f46 40%, #10b981 100%);
      padding: 3rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2rem;
      @media (max-width: 768px) { display: none; }

      .hero-icon { font-size: 4rem; }
      h1 { color: #fff; font-size: 2.5rem; }
      p  { color: rgba(255,255,255,.8); font-size: 1.1rem; }

      .features { display: flex; flex-direction: column; gap: .875rem; margin-top: 1rem; }
      .feature {
        display: flex; align-items: center; gap: .75rem;
        color: rgba(255,255,255,.9);
        .icon { font-size: 1.25rem; }
        span  { font-size: .95rem; }
      }
    }

    /* Right – form */
    .form-side {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      background: var(--color-surface);
    }

    .form-card {
      width: 100%;
      max-width: 400px;

      .logo { display: flex; align-items: center; gap: .5rem; margin-bottom: 2rem;
        .emoji { font-size: 1.75rem; }
        strong { font-size: 1.25rem; color: var(--color-primary); }
      }

      h2 { margin-bottom: .375rem; }
      .sub { color: var(--color-text-muted); margin-bottom: 2rem; font-size: .95rem; }

      .fields { display: flex; flex-direction: column; gap: 1.25rem; }

      .forgot { font-size: .82rem; color: var(--color-text-subtle); cursor: pointer;
        &:hover { color: var(--color-primary); }
      }

      .submit-btn {
        width: 100%;
        margin-top: .5rem;
        padding: .875rem;
        font-size: 1rem;
      }

      .divider {
        text-align: center; margin: 1.5rem 0; position: relative;
        color: var(--color-text-subtle); font-size: .85rem;
        &::before, &::after {
          content: ''; position: absolute; top: 50%;
          width: 40%; height: 1px; background: var(--color-border);
        }
        &::before { left: 0; }
        &::after  { right: 0; }
      }

      .register-link {
        text-align: center; font-size: .9rem; color: var(--color-text-muted);
        a { color: var(--color-primary); font-weight: 600; }
      }
    }
  `],
  template: `
    <div class="auth-page">
      <!-- Hero panel -->
      <div class="hero">
        <div>
          <div class="hero-icon">🌿</div>
          <h1>HealthApp</h1>
          <p>Sua jornada para uma vida mais saudável começa aqui.</p>
        </div>
        <div class="features">
          @for (f of heroFeatures; track f.icon) {
            <div class="feature">
              <span class="icon">{{ f.icon }}</span>
              <span>{{ f.text }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Form panel -->
      <div class="form-side">
        <div class="form-card animate-fade">
          <div class="logo">
            <span class="emoji">🌿</span>
            <strong>HealthApp</strong>
          </div>

          <h2>Bem-vindo de volta</h2>
          <p class="sub">Entre com suas credenciais para continuar.</p>

          @if (error()) {
            <div class="alert alert-error mb-4">⚠️ {{ error() }}</div>
          }

          <form class="fields" (ngSubmit)="submit()" #f="ngForm">
            <div class="form-group">
              <label for="email">E-mail</label>
              <input
                id="email" type="email" name="email"
                [(ngModel)]="email" required placeholder="seu@email.com"
              />
            </div>

            <div class="form-group">
              <label for="password">Senha</label>
              <input
                id="password" type="password" name="password"
                [(ngModel)]="password" required placeholder="••••••••"
              />
            </div>

            <button type="submit" class="btn btn-primary submit-btn" [disabled]="loading()">
              @if (loading()) {
                <span class="spinner"></span> Entrando...
              } @else {
                Entrar
              }
            </button>
          </form>

          <div class="divider">ou</div>

          <div class="register-link">
            Não tem conta? <a routerLink="/auth/register">Criar conta grátis</a>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  email    = '';
  password = '';
  loading  = signal(false);
  error    = signal('');

  readonly heroFeatures = [
    { icon: '🧮', text: 'Cálculo preciso de TMB e macronutrientes' },
    { icon: '🩸', text: 'Análise inteligente de exames de sangue' },
    { icon: '📅', text: 'Rotina personalizada com time-blocking' },
    { icon: '🥗', text: 'Banco de alimentos TACO/TBCA integrado' },
  ];

  submit(): void {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (e) => {
        this.error.set(e.error?.message ?? 'Erro ao fazer login. Tente novamente.');
        this.loading.set(false);
      },
    });
  }
}
