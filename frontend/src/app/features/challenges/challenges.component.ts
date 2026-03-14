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
  styleUrls: ['./challenges.component.scss'],
  templateUrl: './challenges.component.html',
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
