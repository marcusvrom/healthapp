import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { GroupService } from '../../core/services/group.service';
import { Group, GroupDetail } from '../../core/models';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [FormsModule, DatePipe],
  styles: [`
    .page { max-width: 780px; margin: 0 auto; padding: 1.5rem 1rem; }

    .page-header { margin-bottom: 1.5rem;
      h2 { font-size: 1.5rem; font-weight: 800; }
      p  { color: var(--color-text-muted); font-size: .875rem; }
    }

    .actions-row {
      display: flex; gap: .75rem; flex-wrap: wrap; margin-bottom: 1.5rem;
      button { padding: .575rem 1rem; border-radius: var(--radius-sm);
        font-size: .875rem; font-weight: 700; cursor: pointer; transition: .15s;
        &.primary { background: var(--color-primary); color: #fff; border: none; }
        &.secondary { background: none; border: 1.5px solid var(--color-border);
          color: var(--color-text-muted); &:hover { color: var(--color-text); } }
      }
    }

    .section-title { font-size: 1rem; font-weight: 700; margin-bottom: .875rem; }

    .groups-list { display: flex; flex-direction: column; gap: .75rem; margin-bottom: 2rem; }
    .group-card {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1rem 1.25rem;
      display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: .15s;
      &:hover { border-color: var(--color-primary); }
      .g-emoji { font-size: 1.75rem; flex-shrink: 0; }
      .g-info  { flex: 1; min-width: 0;
        .g-name { font-weight: 700; }
        .g-meta { font-size: .78rem; color: var(--color-text-muted); margin-top: .15rem; }
      }
      .g-arrow { color: var(--color-text-subtle); font-size: 1rem; }
    }

    /* ── Group detail panel ─────────────────────────────────────────────────── */
    .detail-panel {
      background: var(--color-surface); border: 1px solid var(--color-border);
      border-radius: var(--radius-md); padding: 1.25rem;

      .panel-header {
        display: flex; align-items: center; gap: .75rem; margin-bottom: 1.25rem;
        padding-bottom: 1rem; border-bottom: 1px solid var(--color-border);
        .p-emoji { font-size: 2rem; }
        .p-info  { flex: 1;
          h3 { font-weight: 800; font-size: 1.1rem; }
          p  { font-size: .78rem; color: var(--color-text-muted); }
        }
        .invite-badge {
          font-size: .72rem; font-family: monospace; font-weight: 700;
          background: var(--color-surface-2); border: 1.5px dashed var(--color-border);
          padding: .3rem .75rem; border-radius: var(--radius-sm); color: var(--color-text-muted);
          cursor: pointer; title: "Clique para copiar";
          &:hover { border-color: var(--color-primary); color: var(--color-primary); }
        }
        .leave-btn {
          background: none; border: 1px solid var(--color-border); border-radius: var(--radius-sm);
          padding: .35rem .75rem; font-size: .78rem; cursor: pointer; color: var(--color-text-muted);
          &:hover { background: #fee2e2; color: var(--color-danger); border-color: var(--color-danger); }
        }
      }

      .panel-section { margin-bottom: 1.5rem;
        h4 { font-size: .82rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: .07em; color: var(--color-text-subtle); margin-bottom: .75rem; }
      }

      /* Leaderboard */
      .lb-row {
        display: flex; align-items: center; gap: .75rem;
        padding: .5rem .625rem; border-radius: var(--radius-sm); margin-bottom: .3rem;
        &:first-child { background: var(--color-primary-light); }
        .lb-rank  { font-size: .78rem; font-weight: 800; width: 1.5rem; text-align: center;
          color: var(--color-text-muted); }
        .lb-avatar {
          width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
          background: var(--color-surface-2); display: flex; align-items: center;
          justify-content: center; font-size: .75rem; font-weight: 700; object-fit: cover;
        }
        .lb-info { flex: 1; min-width: 0;
          .lb-name  { font-weight: 700; font-size: .85rem; }
          .lb-level { font-size: .7rem; color: var(--color-text-muted); }
        }
        .lb-xp { font-weight: 800; font-size: .85rem; color: var(--color-primary); }
      }

      /* Collective progress */
      .cp-row {
        display: flex; align-items: center; gap: .75rem; margin-bottom: .75rem;
        .cp-emoji { font-size: 1.25rem; }
        .cp-body { flex: 1;
          .cp-title { font-size: .82rem; font-weight: 700; margin-bottom: .25rem; }
          .cp-bar {
            height: 6px; background: var(--color-border); border-radius: 99px; overflow: hidden;
            .cp-fill { height: 100%; border-radius: 99px; background: var(--color-primary);
              transition: width .4s; &.done { background: #22c55e; } }
          }
          .cp-count { font-size: .7rem; color: var(--color-text-muted); margin-top: .2rem; }
        }
        .cp-done { font-size: 1rem; }
      }

      .back-btn {
        background: none; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm);
        padding: .5rem 1rem; font-size: .875rem; cursor: pointer; font-weight: 600;
        color: var(--color-text-muted); margin-top: .5rem;
        &:hover { background: var(--color-surface-2); }
      }
    }

    /* ── Modals ─────────────────────────────────────────────────────────────── */
    .modal-overlay {
      position: fixed; inset: 0; z-index: 800; background: rgba(0,0,0,.45);
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .modal {
      background: var(--color-surface); border-radius: var(--radius-md);
      padding: 1.5rem; width: 100%; max-width: 360px;
      box-shadow: 0 8px 40px rgba(0,0,0,.25);
      h3 { font-size: 1.05rem; font-weight: 800; margin-bottom: 1rem; }
      .field { margin-bottom: .875rem;
        label { display: block; font-size: .78rem; font-weight: 700; margin-bottom: .35rem; }
        input, select, textarea {
          width: 100%; padding: .5rem .75rem; border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm); font-size: .875rem; background: var(--color-surface-2);
          &:focus { outline: none; border-color: var(--color-primary); }
        }
        textarea { resize: vertical; min-height: 70px; }
      }
      .emoji-picker {
        display: flex; gap: .5rem; flex-wrap: wrap;
        span { font-size: 1.5rem; cursor: pointer; padding: .2rem; border-radius: .3rem;
          transition: .1s; &:hover { background: var(--color-surface-2); }
          &.selected { background: var(--color-primary-light); }
        }
      }
      .modal-actions {
        display: flex; gap: .625rem; margin-top: 1rem;
        button { flex: 1; padding: .575rem; border-radius: var(--radius-sm);
          font-size: .875rem; font-weight: 700; cursor: pointer;
          &.primary { background: var(--color-primary); color: #fff; border: none; }
          &.ghost   { background: none; border: 1.5px solid var(--color-border);
            color: var(--color-text-muted); }
        }
      }
    }

    .empty-state { text-align: center; padding: 2.5rem 1rem;
      .emoji { font-size: 2.5rem; display: block; margin-bottom: .75rem; }
      p { color: var(--color-text-muted); font-size: .875rem; }
    }

    .copied-hint { font-size: .72rem; color: #16a34a; font-weight: 700; }
  `],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>👥 Grupos</h2>
        <p>Compita em times, veja o ranking semanal e metas coletivas.</p>
      </div>

      @if (!selectedGroupId()) {
        <!-- ── Groups list ──────────────────────────────────────────────────── -->
        <div class="actions-row">
          <button class="primary" (click)="showCreate = true">➕ Criar grupo</button>
          <button class="secondary" (click)="showJoin = true">🔗 Entrar por código</button>
        </div>

        @if (loading()) {
          <div class="empty-state"><span class="emoji">⏳</span><p>Carregando...</p></div>
        } @else if (groups().length === 0) {
          <div class="empty-state">
            <span class="emoji">👥</span>
            <p>Você ainda não faz parte de nenhum grupo.<br>Crie um ou entre com um código de convite!</p>
          </div>
        } @else {
          <p class="section-title">Seus grupos</p>
          <div class="groups-list">
            @for (g of groups(); track g.id) {
              <div class="group-card" (click)="openDetail(g.id)">
                <span class="g-emoji">{{ g.avatarEmoji }}</span>
                <div class="g-info">
                  <div class="g-name">{{ g.name }}</div>
                  <div class="g-meta">{{ g.memberCount }} membro{{ g.memberCount !== 1 ? 's' : '' }}
                    @if (g.isOwner) { · <strong>Admin</strong> }
                  </div>
                </div>
                <span class="g-arrow">›</span>
              </div>
            }
          </div>
        }

      } @else if (detailLoading()) {
        <div class="empty-state"><span class="emoji">⏳</span><p>Carregando grupo...</p></div>

      } @else if (detail()) {
        <!-- ── Group detail ─────────────────────────────────────────────────── -->
        <div class="detail-panel">
          <div class="panel-header">
            <span class="p-emoji">{{ detail()!.group.avatarEmoji }}</span>
            <div class="p-info">
              <h3>{{ detail()!.group.name }}</h3>
              <p>{{ detail()!.memberCount }} membro{{ detail()!.memberCount !== 1 ? 's' : '' }}</p>
            </div>
            <span class="invite-badge" (click)="copyCode(detail()!.group.inviteCode)"
              title="Clique para copiar">
              🔗 {{ detail()!.group.inviteCode }}
            </span>
            @if (copied()) { <span class="copied-hint">Copiado!</span> }
            <button class="leave-btn" (click)="leave()">Sair</button>
          </div>

          <!-- Leaderboard -->
          <div class="panel-section">
            <h4>🏅 Ranking semanal</h4>
            @for (m of detail()!.leaderboard; track m.userId; let i = $index) {
              <div class="lb-row">
                <span class="lb-rank">{{ rankMedal(i) }}</span>
                @if (m.avatarUrl) {
                  <img [src]="apiBase + m.avatarUrl" class="lb-avatar" [alt]="m.name">
                } @else {
                  <div class="lb-avatar">{{ initials(m.name) }}</div>
                }
                <div class="lb-info">
                  <div class="lb-name">{{ m.name }}</div>
                  <div class="lb-level">Nível {{ m.level }} · {{ m.levelTitle }}</div>
                </div>
                <span class="lb-xp">{{ m.weeklyXp }} XP</span>
              </div>
            }
          </div>

          <!-- Collective challenge progress -->
          @if (detail()!.collectiveProgress.length) {
            <div class="panel-section">
              <h4>🏆 Metas coletivas (semana)</h4>
              @for (cp of detail()!.collectiveProgress; track cp.challengeId) {
                <div class="cp-row">
                  <span class="cp-emoji">{{ cp.emoji }}</span>
                  <div class="cp-body">
                    <div class="cp-title">{{ cp.title }}</div>
                    <div class="cp-bar">
                      <div class="cp-fill"
                        [class.done]="cp.completed"
                        [style.width]="cpPct(cp) + '%'">
                      </div>
                    </div>
                    <div class="cp-count">{{ cp.collectiveProgress }} / {{ cp.collectiveTarget }}</div>
                  </div>
                  @if (cp.completed) { <span class="cp-done">✅</span> }
                </div>
              }
            </div>
          }

          <button class="back-btn" (click)="selectedGroupId.set(null)">← Voltar</button>
        </div>
      }
    </div>

    <!-- ── Create group modal ──────────────────────────────────────────────── -->
    @if (showCreate) {
      <div class="modal-overlay" (click)="showCreate = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>➕ Criar grupo</h3>
          <div class="field">
            <label>Nome do grupo *</label>
            <input type="text" [(ngModel)]="createForm.name" placeholder="Ex: Atletas do DF" maxlength="80">
          </div>
          <div class="field">
            <label>Descrição (opcional)</label>
            <textarea [(ngModel)]="createForm.description" placeholder="Sobre o grupo..."></textarea>
          </div>
          <div class="field">
            <label>Emoji do grupo</label>
            <div class="emoji-picker">
              @for (e of EMOJI_OPTIONS; track e) {
                <span [class.selected]="createForm.avatarEmoji === e"
                  (click)="createForm.avatarEmoji = e">{{ e }}</span>
              }
            </div>
          </div>
          <div class="modal-actions">
            <button class="ghost" (click)="showCreate = false">Cancelar</button>
            <button class="primary" (click)="createGroup()"
              [disabled]="!createForm.name.trim() || creating()">
              {{ creating() ? '...' : 'Criar' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ── Join group modal ────────────────────────────────────────────────── -->
    @if (showJoin) {
      <div class="modal-overlay" (click)="showJoin = false">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>🔗 Entrar com código</h3>
          <div class="field">
            <label>Código de convite (8 letras)</label>
            <input type="text" [(ngModel)]="joinCode"
              placeholder="Ex: ABCD1234" maxlength="8"
              style="text-transform:uppercase; letter-spacing:.1em; font-family:monospace">
          </div>
          @if (joinError()) { <p style="font-size:.78rem;color:var(--color-danger)">{{ joinError() }}</p> }
          <div class="modal-actions">
            <button class="ghost" (click)="showJoin = false">Cancelar</button>
            <button class="primary" (click)="joinGroup()"
              [disabled]="joinCode.length < 4 || joining()">
              {{ joining() ? '...' : 'Entrar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class GroupsComponent implements OnInit {
  private svc = inject(GroupService);

  readonly apiBase = environment.apiUrl.replace('/api', '');

  readonly EMOJI_OPTIONS = ['👥','🔥','💪','🏃','🧠','⚡','🌿','🎯','🏆','🦁','🐉','🚀'];

  groups         = signal<Group[]>([]);
  loading        = signal(true);
  selectedGroupId= signal<string | null>(null);
  detail         = signal<GroupDetail | null>(null);
  detailLoading  = signal(false);
  creating       = signal(false);
  joining        = signal(false);
  copied         = signal(false);

  showCreate = false;
  showJoin   = false;
  joinCode   = '';
  joinError  = signal<string | null>(null);

  createForm = { name: '', description: '', avatarEmoji: '👥' };

  ngOnInit(): void { this.loadGroups(); }

  private loadGroups(): void {
    this.loading.set(true);
    this.svc.myGroups().subscribe({
      next: list => { this.groups.set(list); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  openDetail(id: string): void {
    this.selectedGroupId.set(id);
    this.detail.set(null);
    this.detailLoading.set(true);
    this.svc.detail(id).subscribe({
      next: d  => { this.detail.set(d); this.detailLoading.set(false); },
      error: () => this.detailLoading.set(false),
    });
  }

  createGroup(): void {
    if (!this.createForm.name.trim()) return;
    this.creating.set(true);
    this.svc.create({
      name: this.createForm.name,
      description: this.createForm.description || undefined,
      avatarEmoji: this.createForm.avatarEmoji,
    }).subscribe({
      next: g => {
        this.groups.update(l => [...l, { ...g, memberCount: 1, isOwner: true }]);
        this.showCreate = false;
        this.createForm = { name: '', description: '', avatarEmoji: '👥' };
        this.creating.set(false);
      },
      error: () => this.creating.set(false),
    });
  }

  joinGroup(): void {
    this.joinError.set(null);
    this.joining.set(true);
    this.svc.joinByCode(this.joinCode).subscribe({
      next: ({ group, alreadyMember }) => {
        if (!alreadyMember) {
          this.groups.update(l => [...l, { ...group, memberCount: 0, isOwner: false }]);
        }
        this.showJoin = false;
        this.joinCode = '';
        this.joining.set(false);
        this.openDetail(group.id);
      },
      error: err => {
        this.joinError.set(err?.error?.message ?? 'Código inválido.');
        this.joining.set(false);
      },
    });
  }

  leave(): void {
    const id = this.selectedGroupId();
    if (!id) return;
    if (!confirm('Tem certeza que deseja sair do grupo?')) return;
    this.svc.leave(id).subscribe({
      next: () => {
        this.groups.update(l => l.filter(g => g.id !== id));
        this.selectedGroupId.set(null);
        this.detail.set(null);
      },
    });
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  cpPct(cp: { collectiveProgress: number; collectiveTarget: number }): number {
    if (!cp.collectiveTarget) return 0;
    return Math.min(100, Math.round((cp.collectiveProgress / cp.collectiveTarget) * 100));
  }

  rankMedal(i: number): string {
    return ['🥇','🥈','🥉'][i] ?? String(i + 1);
  }

  initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }
}
