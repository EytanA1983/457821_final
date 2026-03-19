/**
 * Local types for app-specific data structures
 * 
 * Note: These are simplified types for UI components.
 * For API types, use:
 * - TaskRead from '../schemas/task'
 * - RoomRead from '../schemas/room'
 */

export interface Task {
  id: string;
  title: string;
  room: string;
  completed: boolean;
  frequency: "daily" | "weekly" | "monthly";
  scheduledTime: string;
}

export interface Room {
  id: string;
  name: string;
  icon: string;
}
