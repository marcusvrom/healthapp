import { ILike, Repository } from "typeorm";
import { AppDataSource } from "../config/typeorm.config";
import { Food, FoodSource } from "../entities/Food";
import { OFFProduct, OFFSearchResponse } from "../types/food.types";

const OFF_BASE = "https://world.openfoodfacts.org";
const OFF_FIELDS =
  "code,product_name,product_name_pt,serving_size,nutriments";

/**
 * FoodService
 * ───────────
 * Hybrid food-search strategy:
 *
 *  1. LOCAL  – full-text ILIKE search on our PostgreSQL (cached foods)
 *  2. BARCODE – exact barcode lookup locally, then OpenFoodFacts
 *  3. FALLBACK – OpenFoodFacts search API when local results are scarce
 *  4. AUTO-SAVE – results from OpenFoodFacts are persisted to avoid repeat calls
 */
export class FoodService {
  private static get repo(): Repository<Food> {
    return AppDataSource.getRepository(Food);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Search for foods by name.
   *  • Returns local results immediately when ≥ 5 rows found.
   *  • Falls back to OpenFoodFacts when local results are < 5 and saves them.
   */
  static async searchByName(query: string, limit = 20): Promise<Food[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const localResults = await this.repo.find({
      where: { name: ILike(`%${trimmed}%`) },
      take: limit,
      order: { source: "ASC", name: "ASC" },
    });

    if (localResults.length >= 5) return localResults;

    // ── Fallback: OpenFoodFacts ─────────────────────────────────────────────
    const external = await this.fetchFromOFF(trimmed, limit);
    const saved = await this.saveExternalFoods(external);

    // Merge: local first, then newly saved (deduplicated by id)
    const knownIds = new Set(localResults.map((f) => f.id));
    const merged = [
      ...localResults,
      ...saved.filter((f) => !knownIds.has(f.id)),
    ];

    return merged.slice(0, limit);
  }

  /**
   * Look up a food by EAN/barcode.
   * Tries local DB first; if not found calls the OpenFoodFacts product API.
   */
  static async searchByBarcode(barcode: string): Promise<Food | null> {
    const local = await this.repo.findOneBy({ barcode });
    if (local) return local;

    const product = await this.fetchProductByBarcode(barcode);
    if (!product) return null;

    const mapped = this.mapOFFProduct(product);
    if (!mapped) return null;

    mapped.barcode = barcode;
    return this.upsertFood(mapped);
  }

  /** Retrieve a food by its internal UUID */
  static async findById(id: string): Promise<Food | null> {
    return this.repo.findOneBy({ id });
  }

  /**
   * Create a custom food entry by the user.
   * Source is always 'UserCustom'.
   */
  static async createCustomFood(dto: Partial<Food>): Promise<Food> {
    const food = this.repo.create({ ...dto, source: FoodSource.USER_CUSTOM });
    return this.repo.save(food);
  }

  // ── OpenFoodFacts HTTP helpers ─────────────────────────────────────────────

  private static async fetchFromOFF(
    query: string,
    pageSize: number
  ): Promise<OFFProduct[]> {
    try {
      const url = new URL(`${OFF_BASE}/cgi/search.pl`);
      url.searchParams.set("search_terms", query);
      url.searchParams.set("search_simple", "1");
      url.searchParams.set("action", "process");
      url.searchParams.set("json", "1");
      url.searchParams.set("page_size", String(pageSize));
      url.searchParams.set("fields", OFF_FIELDS);
      url.searchParams.set("lc", "pt"); // prefer Portuguese

      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(8_000),
        headers: { "User-Agent": "AiraFit-MVP/1.0 (contact@airafit.local)" },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as OFFSearchResponse;
      return data.products ?? [];
    } catch {
      return [];
    }
  }

  private static async fetchProductByBarcode(
    barcode: string
  ): Promise<OFFProduct | null> {
    try {
      const url = `${OFF_BASE}/api/v0/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8_000),
        headers: { "User-Agent": "AiraFit-MVP/1.0 (contact@airafit.local)" },
      });

      if (!res.ok) return null;

      const data = (await res.json()) as { status: number; product?: OFFProduct };
      return data.status === 1 ? (data.product ?? null) : null;
    } catch {
      return null;
    }
  }

  // ── Mapping & persistence ─────────────────────────────────────────────────

  private static mapOFFProduct(p: OFFProduct): Partial<Food> | null {
    const name = (p.product_name_pt ?? p.product_name ?? "").trim();
    if (!name) return null;

    const n = p.nutriments ?? {};
    const calories = n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0;

    // Parse grams from serving_size string, e.g. "30 g" → 30
    let gramsReference: number | undefined;
    if (p.serving_size) {
      const match = p.serving_size.match(/(\d+(?:[.,]\d+)?)/);
      if (match) gramsReference = parseFloat(match[1]!.replace(",", "."));
    }

    return {
      name,
      source: FoodSource.OPEN_FOOD_FACTS,
      externalId: p.code,
      barcode: p.code,
      gramsReference,
      householdMeasure: p.serving_size ?? undefined,
      calories,
      carbs: n.carbohydrates_100g ?? 0,
      protein: n.proteins_100g ?? 0,
      fat: n.fat_100g ?? 0,
      fiber: n.fiber_100g ?? undefined,
      // OFF stores sodium in g/100g → convert to mg/100g
      sodium:
        n.sodium_100g != null ? Math.round(n.sodium_100g * 1000) : undefined,
    };
  }

  private static async saveExternalFoods(
    products: OFFProduct[]
  ): Promise<Food[]> {
    const saved: Food[] = [];

    for (const p of products) {
      const mapped = this.mapOFFProduct(p);
      if (!mapped) continue;

      try {
        const food = await this.upsertFood(mapped);
        saved.push(food);
      } catch {
        // Skip duplicate or invalid entries
      }
    }

    return saved;
  }

  /**
   * Insert or update a food record keyed by (barcode OR externalId).
   * Uses TypeORM's upsert to avoid race conditions.
   */
  private static async upsertFood(data: Partial<Food>): Promise<Food> {
    // Check by barcode first, then externalId
    let existing: Food | null = null;
    if (data.barcode) {
      existing = await this.repo.findOneBy({ barcode: data.barcode });
    }
    if (!existing && data.externalId) {
      existing = await this.repo.findOneBy({ externalId: data.externalId });
    }

    if (existing) {
      Object.assign(existing, data);
      return this.repo.save(existing);
    }

    return this.repo.save(this.repo.create(data));
  }
}
