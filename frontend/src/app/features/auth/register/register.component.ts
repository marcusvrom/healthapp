import { Component, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, FormsModule],
  styles: [`
    .auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center;
      padding: 2rem; background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
    }
    .card {
      width: 100%; max-width: 460px;
      background: #fff; border-radius: 20px;
      padding: 2.5rem; box-shadow: 0 8px 40px rgba(0,0,0,.1);

      .logo { display: flex; align-items: center; gap: .5rem; margin-bottom: 2rem;
        .emoji { font-size: 1.75rem; }
        strong { font-size: 1.25rem; color: var(--color-primary); }
      }
      h2 { margin-bottom: .375rem; }
      .sub { color: var(--color-text-muted); margin-bottom: 2rem; font-size: .95rem; }

      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
        @media (max-width: 480px) { grid-template-columns: 1fr; }
      }
      .fields { display: flex; flex-direction: column; gap: 1.25rem; }
      .submit-btn { width: 100%; margin-top: .5rem; padding: .875rem; font-size: 1rem; }
      .login-link { text-align: center; font-size: .9rem; color: var(--color-text-muted); margin-top: 1.25rem;
        a { color: var(--color-primary); font-weight: 600; }
      }
      .terms { font-size: .78rem; color: var(--color-text-subtle); text-align: center; margin-top: 1rem;
        a { color: var(--color-primary); }
      }
    }
  `],
  template: `
    <div class="auth-page">
      <div class="card animate-scale">
        <div class="logo">
          <span class="emoji">🌿</span>
          <strong>HealthApp</strong>
        </div>

        <h2>Crie sua conta</h2>
        <p class="sub">Comece sua jornada de saúde hoje mesmo.</p>

        @if (error()) {
          <div class="alert alert-error mb-4">⚠️ {{ error() }}</div>
        }

        <form class="fields" (ngSubmit)="submit()">
          <div class="form-group">
            <label>Nome completo</label>
            <input type="text" [(ngModel)]="name" name="name" required placeholder="João Silva" />
          </div>
          <div class="form-group">
            <label>E-mail</label>
            <input type="email" [(ngModel)]="email" name="email" required placeholder="joao@email.com" />
          </div>
          <div class="row">
            <div class="form-group">
              <label>Senha</label>
              <input type="password" [(ngModel)]="password" name="password" required placeholder="min. 8 caracteres" />
            </div>
            <div class="form-group">
              <label>Confirmar</label>
              <input type="password" [(ngModel)]="confirm" name="confirm" required placeholder="repita a senha" />
            </div>
          </div>

          @if (password && confirm && password !== confirm) {
            <div class="alert alert-error">As senhas não coincidem.</div>
          }

          <button type="submit" class="btn btn-primary submit-btn"
            [disabled]="loading() || (!!password && !!confirm && password !== confirm)">
            @if (loading()) {
              <span class="spinner"></span> Criando conta...
            } @else {
              Criar conta grátis 🚀
            }
          </button>
        </form>

        <div class="login-link">
          Já tem conta? <a routerLink="/auth/login">Entrar</a>
        </div>
        <p class="terms">Ao se cadastrar, você concorda com nossos Termos de Uso.</p>
      </div>
    </div>
  `,
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
