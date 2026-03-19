/**
 * Shopping List TypeScript Schemas
 * תואם ל-Pydantic schemas בbackend
 */

export interface ShoppingItemBase {
  name: string;
  quantity?: string | null;
  category?: string | null;
  notes?: string | null;
  is_fixed: boolean;
  order: number;
}

export interface ShoppingItemCreate extends ShoppingItemBase {}

export interface ShoppingItemUpdate {
  name?: string;
  quantity?: string | null;
  category?: string | null;
  notes?: string | null;
  is_checked?: boolean;
  is_fixed?: boolean;
  order?: number;
}

export interface ShoppingItemRead extends ShoppingItemBase {
  id: number;
  shopping_list_id: number;
  is_checked: boolean;
  created_at: string;
  checked_at?: string | null;
}

export interface ShoppingListBase {
  name: string;
  description?: string | null;
  is_template: boolean;
  reminder_time?: string | null;
  room_id?: number | null;
}

export interface ShoppingListCreate extends ShoppingListBase {
  items: ShoppingItemCreate[];
}

export interface ShoppingListUpdate {
  name?: string;
  description?: string | null;
  is_template?: boolean;
  is_active?: boolean;
  reminder_time?: string | null;
}

export interface ShoppingListRead extends ShoppingListBase {
  id: number;
  user_id: number;
  room_id?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  items: ShoppingItemRead[];
}

export interface ShoppingListSummary {
  id: number;
  name: string;
  description?: string | null;
  is_template: boolean;
  is_active: boolean;
  reminder_time?: string | null;
  item_count: number;
  checked_count: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface ShoppingListClone {
  source_list_id: number;
  new_name?: string | null;
}

export interface ShoppingListComplete {
  completed: boolean;
}

export interface ShoppingListStatistics {
  list_id: number;
  total_items: number;
  checked_items: number;
  unchecked_items: number;
  progress_percentage: number;
  categories: Record<string, {
    total: number;
    checked: number;
    unchecked: number;
  }>;
  fixed_items_count: number;
  last_updated: string;
}
