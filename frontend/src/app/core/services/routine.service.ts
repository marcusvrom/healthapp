import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { RoutineBlock } from '../models';

@Injectable({ providedIn: 'root' })
export class RoutineService {
  private api = inject(ApiService);

  readonly blocks = signal<RoutineBlock[]>([]);
  readonly selectedDate = signal<string>(this.todayStr());

  load(date?: string) {
    const d = date ?? this.selectedDate();
    return this.api.get<RoutineBlock[]>('/routine', { date: d }).pipe(
      tap(b => this.blocks.set(b))
    );
  }

  generate(date?: string) {
    const d = date ?? this.selectedDate();
    return this.api.post<RoutineBlock[]>(`/routine/generate?date=${d}`, {}).pipe(
      tap(b => this.blocks.set(b))
    );
  }

  setDate(date: string) {
    this.selectedDate.set(date);
  }

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
