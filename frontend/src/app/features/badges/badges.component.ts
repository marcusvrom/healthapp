import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';

interface Badge {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  tier: string;
  unlockedAt: string | null;
}

@Component({
  selector: 'app-badges',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './badges.component.html',
  styleUrls: ['./badges.component.scss'],
})
export class BadgesComponent implements OnInit {
  private api = inject(ApiService);

  badges = signal<Badge[]>([]);
  loading = signal(true);
  activeCategory = signal<string | null>(null);
  checking = signal(false);

  categories = computed(() => {
    const cats = [...new Set(this.badges().map(b => b.category))];
    return cats;
  });

  filteredBadges = computed(() => {
    const cat = this.activeCategory();
    return cat ? this.badges().filter(b => b.category === cat) : this.badges();
  });

  unlockedCount = computed(() => this.badges().filter(b => b.unlockedAt).length);
  totalCount = computed(() => this.badges().length);

  categoryLabels: Record<string, string> = {
    milestone: 'Marco',
    workout: 'Treino',
    streak: 'Sequencia',
    nutrition: 'Nutricao',
    social: 'Social',
    special: 'Especial',
  };

  ngOnInit() {
    this.loadBadges();
  }

  loadBadges() {
    this.loading.set(true);
    this.api.get<Badge[]>('/badges').subscribe({
      next: (b) => { this.badges.set(b); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  setCategory(cat: string | null) {
    this.activeCategory.set(cat);
  }

  checkBadges() {
    this.checking.set(true);
    this.api.post<{ newBadges: Badge[] }>('/badges/check', {}).subscribe({
      next: (res) => {
        this.checking.set(false);
        this.loadBadges();
      },
      error: () => this.checking.set(false),
    });
  }

  tierClass(tier: string): string {
    return `tier-${tier}`;
  }
}
