import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { RoutineBlock, BlockCompleteResult } from '../models';

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

  /**
   * Toggle completion of a non-meal/non-medication routine block.
   * Awards XP on first completion; returns updated block + XP info.
   * Also patches the local blocks signal.
   */
  completeBlock(blockId: string): Observable<BlockCompleteResult> {
    return this.api.patch<BlockCompleteResult>(`/routine/blocks/${blockId}/complete`, {}).pipe(
      tap(result => {
        this.blocks.update(list =>
          list.map(b => b.id === result.block.id ? result.block : b)
        );
      })
    );
  }

  setDate(date: string) {
    this.selectedDate.set(date);
  }

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
