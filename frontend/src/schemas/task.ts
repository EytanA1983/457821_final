import { TodoRead } from './todo';
import { CategoryRead } from './category';
import { RoomRead } from './room';

export interface TaskRead {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  recurrence?: string;
  rrule_string?: string; // RRULE string for advanced recurrence (RFC 5545)
  category_id?: number;
  room_id?: number;
  assignee_user_id?: number | null;
  assignee_name?: string | null;
  assignee_age?: number | null;
  is_kid_task?: boolean;
  completed: boolean;
  priority?: 'urgent' | 'medium' | 'low' | null;
  before_image_url?: string | null;
  after_image_url?: string | null;
  before_image_at?: string | null;
  after_image_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  category?: CategoryRead;
  room?: RoomRead;
  todos?: TodoRead[];
}
