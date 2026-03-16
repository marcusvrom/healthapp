import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { RoutineBlock, BlockCompleteResult, CreateBlockDto, FeedbackResponse } from '../models';

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

  /** @deprecated Canvas pivot: use createBlock() instead. Will return 410 from the server. */
  generate(date?: string) {
    const d = date ?? this.selectedDate();
    return this.api.post<RoutineBlock[]>(`/routine/generate?date=${d}`, {}).pipe(
      tap(b => this.blocks.set(b))
    );
  }

  createBlock(dto: CreateBlockDto): Observable<RoutineBlock> {
    return this.api.post<RoutineBlock>('/routine/blocks', dto).pipe(
      tap(block => this.blocks.update(list => [...list, block]))
    );
  }

  updateBlock(id: string, dto: Partial<CreateBlockDto>): Observable<RoutineBlock> {
    return this.api.patch<RoutineBlock>(`/routine/blocks/${id}`, dto).pipe(
      tap(block => this.blocks.update(list => list.map(b => b.id === block.id ? block : b)))
    );
  }

  deleteBlock(id: string): Observable<void> {
    return this.api.delete<void>(`/routine/blocks/${id}`).pipe(
      tap(() => this.blocks.update(list => list.filter(b => b.id !== id)))
    );
  }

  getFeedback(date?: string): Observable<FeedbackResponse> {
    const d = date ?? this.selectedDate();
    return this.api.get<FeedbackResponse>('/routine/feedback', { date: d });
  }

  /**
   * Toggle completion of a non-meal/non-medication routine block.
   * Optionally attach a photo for the social feed (+10 XP bonus).
   * Awards XP on first completion; returns updated block + XP info.
   * Also patches the local blocks signal.
   */
  completeBlock(blockId: string, photo?: {
    photoDataUrl: string;
    caption?: string;
    sharePublic?: boolean;
  }): Observable<BlockCompleteResult> {
    return this.api.patch<BlockCompleteResult>(`/routine/blocks/${blockId}/complete`, photo ?? {}).pipe(
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
