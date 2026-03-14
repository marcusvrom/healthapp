import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { GroupService } from '../../core/services/group.service';
import { ApiService } from '../../core/services/api.service';
import { Group, GroupDetail } from '../../core/models';

@Component({
  selector: 'app-groups',
  standalone: true,
  imports: [FormsModule, DatePipe],
  styleUrls: ['./groups.component.scss'],
  templateUrl: './groups.component.html',
})
export class GroupsComponent implements OnInit {
  private svc = inject(GroupService);
  private api = inject(ApiService);
  img = (path: string | null | undefined) => this.api.storageUrl(path);

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
