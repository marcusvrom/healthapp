import { Component, inject, signal, computed, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { FoodService } from '../../core/services/food.service';
import { Food } from '../../core/models';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';

type ScannerTab = 'search' | 'scanner' | 'custom';

@Component({
  selector: 'app-food-scanner',
  standalone: true,
  imports: [FormsModule, DecimalPipe],
  styleUrls: ['./food-scanner.component.scss'],
  templateUrl: './food-scanner.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FoodScannerComponent implements OnDestroy {
  private foodSvc = inject(FoodService);
  private router  = inject(Router);

  // ── State ─────────────────────────────────────────────────────────────
  activeTab     = signal<ScannerTab>('search');
  searchQuery   = signal('');
  searchResults = signal<Food[]>([]);
  searching     = signal(false);
  selectedFood  = signal<Food | null>(null);
  quantityG     = signal(100);

  // Scanner state
  scannerActive = signal(false);
  scannerError  = signal('');
  scannedFood   = signal<Food | null>(null);
  scannerLoading = signal(false);

  // Custom food
  customFood: Partial<Food> = {
    name: '', calories: 0, protein: 0, carbs: 0, fat: 0,
    fiber: 0, sodium: 0, gramsReference: 100, householdMeasure: '',
  };
  savingCustom = signal(false);

  // Search debounce
  private searchSubject = new Subject<string>();
  private searchSub = this.searchSubject.pipe(
    debounceTime(350),
    distinctUntilChanged(),
    switchMap(q => {
      if (q.length < 2) { this.searchResults.set([]); return of([]); }
      this.searching.set(true);
      return this.foodSvc.searchFoods(q, 20).pipe(catchError(() => of([])));
    }),
  ).subscribe(results => {
    this.searchResults.set(results);
    this.searching.set(false);
  });

  // Scanner instance
  private html5Scanner: any = null;

  // ── Computed ──────────────────────────────────────────────────────────
  computedMacros = computed(() => {
    const food = this.selectedFood();
    if (!food) return null;
    const q = this.quantityG();
    const factor = q / 100;
    return {
      calories: Math.round(food.calories * factor),
      protein:  +(food.protein * factor).toFixed(1),
      carbs:    +(food.carbs * factor).toFixed(1),
      fat:      +(food.fat * factor).toFixed(1),
      fiber:    +((food.fiber ?? 0) * factor).toFixed(1),
    };
  });

  // ── Search ────────────────────────────────────────────────────────────
  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query);
  }

  selectFood(food: Food): void {
    this.selectedFood.set(food);
    this.quantityG.set(food.gramsReference ?? 100);
  }

  clearSelection(): void {
    this.selectedFood.set(null);
    this.quantityG.set(100);
  }

  // ── Barcode Scanner ───────────────────────────────────────────────────
  async startScanner(): Promise<void> {
    this.scannerError.set('');
    this.scannedFood.set(null);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      this.html5Scanner = new Html5Qrcode('scanner-viewport');

      this.scannerActive.set(true);

      await this.html5Scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 280, height: 160 }, aspectRatio: 1.5 },
        (decodedText: string) => this.onBarcodeDetected(decodedText),
        () => {},
      );
    } catch (err: any) {
      this.scannerActive.set(false);
      if (err?.name === 'NotAllowedError') {
        this.scannerError.set('Permissao de camera negada. Habilite nas configuracoes do navegador.');
      } else {
        this.scannerError.set('Nao foi possivel acessar a camera. Verifique as permissoes.');
      }
    }
  }

  async stopScanner(): Promise<void> {
    if (this.html5Scanner) {
      try { await this.html5Scanner.stop(); } catch { /* ignore */ }
      try { this.html5Scanner.clear(); } catch { /* ignore */ }
      this.html5Scanner = null;
    }
    this.scannerActive.set(false);
  }

  private onBarcodeDetected(barcode: string): void {
    this.stopScanner();
    this.scannerLoading.set(true);

    this.foodSvc.searchByBarcode(barcode).subscribe({
      next: food => {
        this.scannedFood.set(food);
        this.selectedFood.set(food);
        this.quantityG.set(food.gramsReference ?? 100);
        this.scannerLoading.set(false);
      },
      error: () => {
        this.scannerError.set(`Alimento nao encontrado para o codigo ${barcode}. Tente buscar pelo nome.`);
        this.scannerLoading.set(false);
      },
    });
  }

  // ── Custom food ───────────────────────────────────────────────────────
  saveCustomFood(): void {
    if (!this.customFood.name?.trim()) return;
    this.savingCustom.set(true);

    this.foodSvc.createCustomFood(this.customFood).subscribe({
      next: food => {
        this.selectedFood.set(food);
        this.quantityG.set(food.gramsReference ?? 100);
        this.activeTab.set('search');
        this.savingCustom.set(false);
        this.resetCustomForm();
      },
      error: () => this.savingCustom.set(false),
    });
  }

  private resetCustomForm(): void {
    this.customFood = {
      name: '', calories: 0, protein: 0, carbs: 0, fat: 0,
      fiber: 0, sodium: 0, gramsReference: 100, householdMeasure: '',
    };
  }

  // ── Tab switching ─────────────────────────────────────────────────────
  switchTab(tab: ScannerTab): void {
    if (this.activeTab() === 'scanner' && tab !== 'scanner') {
      this.stopScanner();
    }
    this.activeTab.set(tab);
    if (tab === 'scanner' && !this.scannerActive()) {
      setTimeout(() => this.startScanner(), 200);
    }
  }

  // ── Source label ──────────────────────────────────────────────────────
  sourceLabel(source: string): string {
    const map: Record<string, string> = {
      TACO: 'TACO', TBCA: 'TBCA',
      OpenFoodFacts: 'Open Food Facts', OPEN_FOOD_FACTS: 'Open Food Facts',
      UserCustom: 'Personalizado', USER_CUSTOM: 'Personalizado',
    };
    return map[source] ?? source;
  }

  // ── Cleanup ───────────────────────────────────────────────────────────
  ngOnDestroy(): void {
    this.stopScanner();
    this.searchSub.unsubscribe();
  }
}
