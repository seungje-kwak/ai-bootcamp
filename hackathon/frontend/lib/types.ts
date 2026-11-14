// PRD 9.3 — keep field names identical to the API.
export type Category = "nature" | "market" | "cafe" | "food" | "culture" | "photo";
export type Tier = "free" | "premium";
export type MoveMethod = "walk" | "bus" | "taxi";
export type ItemStatus = "done" | "current" | "upcoming";
export type ReplanReason = "rain" | "closed" | "hungry" | "tired";

export type Accessibility = {
  walking_level: 1 | 2 | 3;
  terrain: "flat" | "slope" | "steep";
  has_stairs: boolean | null;
  wheelchair_ok: boolean | null;
  indoor: boolean;
  has_seating: boolean | null;
  restroom: boolean | null;
  nearest_public_restroom_m: number | null;
  fatigue_score: 1 | 2 | 3 | 4 | 5;
};

export type FoodOptions = {
  solo_ok: boolean;
  vegan: boolean;
  vegetarian: boolean;
  halal: boolean;
  english_menu: boolean;
  signature_menu_en: string | null;
  allergens: string | null;
};

export type PhraseCard = { situation: string; text_en: string; text_ko: string };

export type Place = {
  id: number;
  source_poi_id: string | null;
  name_en: string;
  name_ko: string;
  category: Category;
  description_en: string;
  lat: number;
  lng: number;
  address_ko: string;
  area_id: string;
  image_url: string | null;
  image_source: string | null;
  avg_stay_min: number;
  opening_hours: string | null;
  open_time: string | null; // "HH:MM"; both null = always open
  close_time: string | null; // "HH:MM" or "24:00"
  closed_days: string[];
  price_level: number | null;
  last_verified_at: string | null;
  source_date: string | null;
  accessibility: Accessibility;
  food_options: FoodOptions | null;
};

// One of the 14 areas a traveler can pick (GET /areas).
export type Area = {
  id: string;
  group: "jeju" | "seogwipo";
  name_en: string;
  name_ko: string;
  description_en: string;
  center_lat: number;
  center_lng: number;
  place_count: number;
  selectable: boolean; // false while the area does not have enough places yet
};

// Courses saved before areas existed have no area_id; they are Jeju City courses.
export const DEFAULT_AREA_ID = "jeju-city";

export type UserProfileInput = {
  interests: Category[];
  fitness_level: 1 | 2 | 3;
  max_walk_min: 10 | 20 | 30;
  avoid_slopes: boolean;
  condition_today: "great" | "normal" | "tired";
  diet: "none" | "vegan" | "vegetarian" | "halal";
};

// The server adds conditions, start_time, end_time and area_id. Courses saved before the trip-time
// change have `duration` instead of the two times.
export type UserProfile = UserProfileInput & {
  conditions: { indoor_only: boolean; low_walking: boolean };
  area_id?: string;
  start_time?: string;
  end_time?: string;
  duration?: "half_day" | "full_day";
};

export type CourseItem = {
  order: number;
  place_id: number;
  start_time: string;
  stay_min: number;
  move_method: MoveMethod | null;
  move_min: number | null;
  reason_en: string;
  is_rest_stop: boolean;
  status: ItemStatus;
  place: Place;
  phrase_cards: PhraseCard[];
};

export type Course = {
  id: string;
  tier: Tier;
  created_at: string;
  user_profile: UserProfile;
  total_items: number;
  locked_count: number;
  items: CourseItem[];
};
