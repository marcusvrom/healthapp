import { Component, inject, signal, OnInit } from '@angular/core';
import { ChallengeService } from '../../core/services/challenge.service';
import { Challenge } from '../../core/models';

const CATEGORY_LABEL: Record<string, string> = {
  exercise:     'Exercício',
  sleep:        'Sono',
  water:        'Água',
  sun_exposure: 'Exposição solar',
  work:         'Trabalho',
  free:         'Lazer',
  custom:       'Personalizado',
  any:          'Qualquer bloco',
};

@Component({
  selector: 'app-challenges',
  standalone: true,
  styles: [`
    .page { max-width: 720px; margin: 0 auto; padding: 1.5rem 1rem; }

    .page-header { margin-bottom: 1.5rem;
      h2 { font-size: 1.5rem; font-weight: 800; }
      p  { color: var(--color-text-muted); font-size: .875rem; margin-top: .25rem; }
    }

    .week-badge {
      display: inline-block; background: var(--color-primary-light);
      color: var(--color-primary-dark); font-size: .75rem; font-weight: 700;
      padding: .25rem .75rem; border-radius: 99px; margin-bottom: 1.25rem;
    }

    .challenges-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1rem;
    }

    .challenge-card {
      background: var(--color-surface); border: 2px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem;
      transition: border-color .2s;

      &.completed { border-color: #22c55e; background: #f0fdf4; }
      &.joined:not(.completed) { border-color: var(--color-primary); }

      .card-top {
        display: flex; align-items: flex-start; gap: .75rem; margin-bottom: .75rem;
        .emoji { font-size: 2rem; flex-shrink: 0; line-height: 1; }
        .info {
          flex: 1; min-width: 0;
          .title { font-weight: 800; font-size: .95rem; }
          .desc  { font-size: .78rem; color: var(--color-text-muted); margin-top: .2rem; line-height: 1.4; }
        }
      }

      .tags {
        display: flex; gap: .4rem; flex-wrap: wrap; margin-bottom: .875rem;
        .tag {
          font-size: .68rem; font-weight: 700; padding: .15rem .5rem;
          border-radius: 99px; background: var(--color-surface-2);
          border: 1px solid var(--color-border); color: var(--color-text-muted);
          &.xp { background: #f5f3ff; color: #6d28d9; border-color: #ddd6fe; }
        }
      }

      .progress-wrap {
        margin-bottom: .875rem;
        .progress-label {
          display: flex; justify-content: space-between;
          font-size: .75rem; color: var(--color-text-muted); margin-bottom: .3rem;
          span:last-child { font-weight: 700; color: var(--color-text); }
        }
        .progress-bar {
          height: 8px; background: var(--color-border); border-radius: 99px; overflow: hidden;
          .progress-fill {
            height: 100%; border-radius: 99px; background: var(--color-primary);
            transition: width .4s ease;
            &.done { background: #22c55e; }
          }
        }
      }

      .card-actions {
        .btn {
          width: 100%; padding: .575rem; border-radius: var(--radius-sm);
          font-size: .875rem; font-weight: 700; cursor: pointer; transition: .15s;
          border: none;
          &.join   { background: var(--color-primary); color: #fff;
            &:hover { opacity: .9; } }
          &.done   { background: #dcfce7; color: #166534; cursor: default; }
          &.joined { background: var(--color-surface-2); color: var(--color-text-muted);
            border: 1.5px solid var(--color-border); cursor: default; }
        }
      }
    }

    .empty-state {
      text-align: center; padding: 3rem 1rem;
      .emoji { font-size: 3rem; display: block; margin-bottom: 1rem; }
      p { color: var(--color-text-muted); }
      .retry-btn {
        margin-top: 1rem; padding: .5rem 1.25rem; border-radius: var(--radius-sm);
        background: var(--color-primary); color: #fff; font-weight: 700;
        border: none; cursor: pointer; font-size: .875rem;
        &:hover { opacity: .9; }
      }
    }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>🏆 Desafios da Semana</h2>
        <p>Complete blocos de rotina para avançar nos desafios. XP bônus ao completar!</p>
      </div>

      @if (weekLabel()) {
        <span class="week-badge">📅 {{ weekLabel() }}</span>
      }

      @if (loading()) {
        <div class="empty-state"><span class="emoji">⏳</span><p>Carregando desafios...</p></div>
      } @else if (error()) {
        <div class="empty-state">
          <span class="emoji">⚠️</span>
          <p>Não foi possível carregar os desafios.<br>Verifique sua conexão e tente novamente.</p>
          <button class="retry-btn" (click)="load()">Tentar novamente</button>
        </div>
      } @else if (challenges().length === 0) {
        <div class="empty-state"><span class="emoji">🏆</span><p>Nenhum desafio ativo esta semana.</p></div>
      } @else {
        <div class="challenges-grid">
          @for (c of challenges(); track c.id) {
            <div class="challenge-card"
              [class.completed]="c.completed"
              [class.joined]="c.joined">

              <div class="card-top">
                <span class="emoji">{{ c.emoji }}</span>
                <div class="info">
                  <div class="title">{{ c.title }}</div>
                  <div class="desc">{{ c.description }}</div>
                </div>
              </div>

              <div class="tags">
                <span class="tag">{{ categoryLabel(c.category) }}</span>
                <span class="tag xp">+{{ c.xpReward }} XP</span>
                <span class="tag">{{ c.targetCount }} blocos</span>
              </div>

              @if (c.joined) {
                <div class="progress-wrap">
                  <div class="progress-label">
                    <span>Progresso</span>
                    <span>{{ c.progress }} / {{ c.targetCount }}</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill"
                      [class.done]="c.completed"
                      [style.width]="progressPct(c) + '%'">
                    </div>
                  </div>
                </div>
              }

              <div class="card-actions">
                @if (c.completed) {
                  <button class="btn done">✅ Concluído! +{{ c.xpReward }} XP</button>
                } @else if (c.joined) {
                  <button class="btn joined">✓ Participando — {{ c.progress }}/{{ c.targetCount }}</button>
                } @else {
                  <button class="btn join"
                    [disabled]="joining().has(c.id)"
                    (click)="join(c)">
                    {{ joining().has(c.id) ? '...' : '🚀 Participar' }}
                  </button>
                }
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ChallengesComponent implements OnInit {
  private svc = inject(ChallengeService);

  challenges = signal<Challenge[]>([]);
  loading    = signal(true);
  error      = signal(false);
  joining    = signal<Set<string>>(new Set());

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.svc.list().subscribe({
      next: list => { this.challenges.set(list); this.loading.set(false); },
      error: ()  => { this.loading.set(false); this.error.set(true); },
    });
  }

  join(c: Challenge): void {
    const s = new Set(this.joining());
    s.add(c.id);
    this.joining.set(s);

    this.svc.join(c.id).subscribe({
      next: () => {
        this.challenges.update(list =>
          list.map(x => x.id === c.id ? { ...x, joined: true } : x)
        );
        const s2 = new Set(this.joining());
        s2.delete(c.id);
        this.joining.set(s2);
      },
      error: () => {
        const s2 = new Set(this.joining());
        s2.delete(c.id);
        this.joining.set(s2);
      },
    });
  }

  progressPct(c: Challenge): number {
    return Math.min(100, Math.round((c.progress / c.targetCount) * 100));
  }

  categoryLabel(cat: string): string {
    return CATEGORY_LABEL[cat] ?? cat;
  }

  weekLabel(): string {
    const list = this.challenges();
    if (!list.length) return '';
    const c = list[0]!;
    const fmt = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return `${fmt(c.weekStart)} – ${fmt(c.weekEnd)}`;
  }
}
