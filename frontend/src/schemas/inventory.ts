export interface InventoryAreaRead {
  id: number;
  user_id: number;
  room_id?: number | null;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItemRead {
  id: number;
  user_id: number;
  area_id: number;
  room_id?: number | null;
  name: string;
  quantity: number;
  category?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  is_donated: boolean;
  created_at: string;
  updated_at: string;
}
