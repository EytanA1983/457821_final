import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { getAccessToken } from '../utils/tokenStorage';

/** Minimal room row from GET /rooms — enough for lists and menus. */
export interface RoomListItem {
  id: number;
  name: string;
}

interface UseRoomsOptions {
  enabled?: boolean;
}

export const useRooms = (options?: UseRoomsOptions) => {
  const hasToken = !!getAccessToken();
  const queryEnabled = options?.enabled ?? hasToken;

  return useQuery<RoomListItem[]>({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data } = await api.get<RoomListItem[]>('/rooms');
      return data;
    },
    enabled: queryEnabled,
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      const isNetworkError = error?.code === 'ERR_NETWORK' || error?.code === 'ERR_FAILED';
      
      // Don't retry on auth errors or network errors (server is down)
      if (status === 401 || status === 403 || status === 404 || isNetworkError) {
        return false;
      }
      // Retry once for other errors
      return failureCount < 1;
    },
  });
};
