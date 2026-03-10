import { Food } from "../entities/Food";

/** Shape returned by the OpenFoodFacts search API */
export interface OFFSearchResponse {
  count: number;
  products: OFFProduct[];
}

export interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_pt?: string;
  serving_size?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    "energy-kcal"?: number;
    carbohydrates_100g?: number;
    proteins_100g?: number;
    fat_100g?: number;
    fiber_100g?: number;
    sodium_100g?: number; // OFF stores sodium in grams/100g
  };
}

/** Result item returned by FoodService.search() */
export interface FoodSearchResult extends Pick<
  Food,
  "id" | "name" | "householdMeasure" | "gramsReference" |
  "calories" | "carbs" | "protein" | "fat" | "fiber" | "sodium" | "source"
> {
  _fromExternalApi?: boolean; // ephemeral flag, not persisted
}
