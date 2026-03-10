import { Injectable } from '@angular/core';
import { Gender } from '../models';

// ── Public types ──────────────────────────────────────────────────────────────
export type HealthStatus = 'optimal' | 'normal' | 'attention' | 'alert';

export interface StatusInfo {
  status: HealthStatus;
  /** Short human-readable label in Brazilian Portuguese */
  label: string;
  /** CSS color (text / dot) — works on light AND dark backgrounds */
  color: string;
  /** rgba background — semi-transparent, dark-mode safe */
  bg: string;
  /** Emoji indicator */
  dot: string;
}

/** Per-marker threshold definition.
 *  Classification ladder (ascending value):
 *    < alertLow          → alert
 *    < attentionLow      → attention
 *    optimalMin…optimalMax → optimal
 *    > attentionHigh     → attention
 *    > alertHigh         → alert
 *    otherwise           → normal
 */
export interface RangeDef {
  alertLow?: number;
  attentionLow?: number;
  optimalMin: number;
  optimalMax: number;
  attentionHigh?: number;
  alertHigh?: number;
}

// ── Status lookup table ───────────────────────────────────────────────────────
const STATUS: Record<HealthStatus, StatusInfo> = {
  optimal:   { status: 'optimal',   label: 'Ótimo',    color: '#16a34a', bg: 'rgba(34,197,94,.14)',  dot: '🟢' },
  normal:    { status: 'normal',    label: 'Normal',   color: '#2563eb', bg: 'rgba(59,130,246,.14)', dot: '🔵' },
  attention: { status: 'attention', label: 'Atenção',  color: '#d97706', bg: 'rgba(234,179,8,.14)',  dot: '🟡' },
  alert:     { status: 'alert',     label: 'Alerta',   color: '#dc2626', bg: 'rgba(239,68,68,.14)',  dot: '🔴' },
};

// ── Reference ranges ─────────────────────────────────────────────────────────
// Uses gender keys 'male' / 'female' where ranges differ, otherwise 'common'.
type MarkerRanges = { common?: RangeDef; male?: RangeDef; female?: RangeDef };

const RANGES: Record<string, MarkerRanges> = {
  // ── Metabolic ─────────────────────────────────────────────────────────────
  glucoseMgDl: { common: {
    alertLow: 55, attentionLow: 70, optimalMin: 75, optimalMax: 95, attentionHigh: 100, alertHigh: 126,
  }},
  insulinUiuMl: { common: {
    optimalMin: 2, optimalMax: 10, attentionHigh: 20, alertHigh: 30,
  }},
  hba1cPct: { common: {
    optimalMin: 4.0, optimalMax: 5.4, attentionHigh: 6.4, alertHigh: 6.5,
  }},

  // ── Lipid ─────────────────────────────────────────────────────────────────
  cholesterolTotalMgDl: { common: {
    optimalMin: 0, optimalMax: 180, attentionHigh: 239, alertHigh: 240,
  }},
  ldlMgDl: { common: {
    optimalMin: 0, optimalMax: 99, attentionHigh: 159, alertHigh: 190,
  }},
  hdlMgDl: {
    male:   { alertLow: 35, attentionLow: 40, optimalMin: 50, optimalMax: 9999 },
    female: { alertLow: 40, attentionLow: 50, optimalMin: 60, optimalMax: 9999 },
  },
  triglyceridesMgDl: { common: {
    optimalMin: 0, optimalMax: 100, attentionHigh: 199, alertHigh: 500,
  }},

  // ── Hormonal ──────────────────────────────────────────────────────────────
  testosteroneTotalNgDl: {
    male:   { alertLow: 200, attentionLow: 300, optimalMin: 500, optimalMax: 900, attentionHigh: 1200, alertHigh: 1500 },
    female: { alertLow: 10, attentionLow: 15,   optimalMin: 20,  optimalMax: 60,  attentionHigh: 80,   alertHigh: 120  },
  },
  testosteroneFreeNgDl: {
    male:   { alertLow: 3, attentionLow: 5, optimalMin: 9,   optimalMax: 21, attentionHigh: 30, alertHigh: 40 },
    female: { alertLow: 0.3, attentionLow: 0.8, optimalMin: 0.8, optimalMax: 3, attentionHigh: 5, alertHigh: 8 },
  },
  estradiolPgMl: {
    male:   { alertLow: 5, attentionLow: 10, optimalMin: 20,  optimalMax: 30,  attentionHigh: 50,  alertHigh: 80  },
    female: { alertLow: 20, attentionLow: 30, optimalMin: 50, optimalMax: 200, attentionHigh: 300, alertHigh: 600 },
  },
  shbgNmolL: { common: {
    alertLow: 5, attentionLow: 10, optimalMin: 20, optimalMax: 55, attentionHigh: 70, alertHigh: 90,
  }},
  prolactinNgMl: {
    male:   { optimalMin: 2, optimalMax: 10, attentionHigh: 15, alertHigh: 25 },
    female: { optimalMin: 3, optimalMax: 20, attentionHigh: 25, alertHigh: 40 },
  },
  dhtPgMl: {
    male:   { alertLow: 50, attentionLow: 112, optimalMin: 300, optimalMax: 700,  attentionHigh: 1000, alertHigh: 1300 },
    female: { alertLow: 10, attentionLow: 24,  optimalMin: 24,  optimalMax: 80,   attentionHigh: 100,  alertHigh: 150  },
  },
  fshMuiMl: {
    male:   { alertLow: 0.3, attentionLow: 1.5, optimalMin: 2, optimalMax: 8,  attentionHigh: 12, alertHigh: 20 },
    female: { alertLow: 0.3, attentionLow: 2,   optimalMin: 3, optimalMax: 10, attentionHigh: 15, alertHigh: 40 },
  },
  lhMuiMl: {
    male:   { alertLow: 0.3, attentionLow: 1.7, optimalMin: 2, optimalMax: 7,  attentionHigh: 10, alertHigh: 20 },
    female: { alertLow: 0.3, attentionLow: 2,   optimalMin: 2, optimalMax: 12, attentionHigh: 20, alertHigh: 50 },
  },
  cortisolMcgDl: { common: {
    alertLow: 3, attentionLow: 6, optimalMin: 8, optimalMax: 18, attentionHigh: 23, alertHigh: 35,
  }},

  // ── Thyroid ───────────────────────────────────────────────────────────────
  tshMiuL: { common: {
    alertLow: 0.1, attentionLow: 0.4, optimalMin: 0.5, optimalMax: 2.5, attentionHigh: 4.0, alertHigh: 10.0,
  }},
  t3FreePgMl: { common: {
    alertLow: 1.4, attentionLow: 2.3, optimalMin: 2.8, optimalMax: 3.8, attentionHigh: 4.2, alertHigh: 6.0,
  }},
  t4FreeNgDl: { common: {
    alertLow: 0.4, attentionLow: 0.8, optimalMin: 1.0, optimalMax: 1.6, attentionHigh: 1.8, alertHigh: 2.5,
  }},

  // ── Hepatic & Renal ───────────────────────────────────────────────────────
  astUL: { common: {
    optimalMin: 0, optimalMax: 30, attentionHigh: 60, alertHigh: 80,
  }},
  altUL: { common: {
    optimalMin: 0, optimalMax: 30, attentionHigh: 60, alertHigh: 80,
  }},
  gamaGtUL: {
    male:   { optimalMin: 0, optimalMax: 35, attentionHigh: 60,  alertHigh: 120 },
    female: { optimalMin: 0, optimalMax: 25, attentionHigh: 40,  alertHigh: 80  },
  },
  creatinineMgDl: {
    male:   { alertLow: 0.3, attentionLow: 0.5, optimalMin: 0.7, optimalMax: 1.1, attentionHigh: 1.3, alertHigh: 2.0 },
    female: { alertLow: 0.3, attentionLow: 0.4, optimalMin: 0.5, optimalMax: 0.9, attentionHigh: 1.1, alertHigh: 1.8 },
  },
  ureaMgDl: { common: {
    alertLow: 5, attentionLow: 10, optimalMin: 15, optimalMax: 40, attentionHigh: 55, alertHigh: 80,
  }},

  // ── Vitamins & Inflammation ───────────────────────────────────────────────
  vitaminDNgMl: { common: {
    alertLow: 10, attentionLow: 20, optimalMin: 40, optimalMax: 80, attentionHigh: 100, alertHigh: 150,
  }},
  vitaminB12PgMl: { common: {
    alertLow: 100, attentionLow: 200, optimalMin: 400, optimalMax: 700, attentionHigh: 1000, alertHigh: 1200,
  }},
  ferritinNgMl: {
    male:   { alertLow: 5, attentionLow: 20, optimalMin: 50,  optimalMax: 200, attentionHigh: 300, alertHigh: 500 },
    female: { alertLow: 5, attentionLow: 12, optimalMin: 30,  optimalMax: 150, attentionHigh: 200, alertHigh: 400 },
  },
  crpMgL: { common: {
    optimalMin: 0, optimalMax: 1.0, attentionHigh: 3.0, alertHigh: 10.0,
  }},
};

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class ClinicalReferenceService {

  /** Returns the effective RangeDef for a given marker and gender. */
  getRange(key: string, gender: Gender = 'male'): RangeDef | null {
    const entry = RANGES[key];
    if (!entry) return null;
    return (gender !== 'other' ? entry[gender] : undefined) ?? entry.common ?? null;
  }

  /** Classifies a numeric value into one of 4 health tiers. */
  classify(key: string, value: number, gender: Gender = 'male'): StatusInfo {
    const r = this.getRange(key, gender);
    if (!r) return STATUS.normal;

    if (r.alertLow     != null && value < r.alertLow)     return STATUS.alert;
    if (r.alertHigh    != null && value > r.alertHigh)    return STATUS.alert;
    if (r.attentionLow != null && value < r.attentionLow) return STATUS.attention;
    if (r.attentionHigh != null && value > r.attentionHigh) return STATUS.attention;
    if (value >= r.optimalMin && value <= r.optimalMax)    return STATUS.optimal;
    return STATUS.normal;
  }
}
