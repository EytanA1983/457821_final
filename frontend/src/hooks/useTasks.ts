import { useQuery } from '@tanstack/react-query';
import api from '../api';
import { getAccessToken } from '../utils/tokenStorage';

interface UseTasksParams {
  roomId?: number;
  categoryId?: number;
  completed?: boolean;
}

interface UseTasksOptions {
  enabled?: boolean;
}

export const useTasks = (params?: UseTasksParams, options?: UseTasksOptions) => {
  const hasToken = !!getAccessToken();
  const queryEnabled = options?.enabled ?? hasToken;

  return useQuery({
    queryKey: ['tasks', params],
    queryFn: async () => {
      // Convert roomId to room_id for API
      const apiParams: any = {};
      if (params?.roomId) apiParams.room_id = params.roomId;
      if (params?.categoryId) apiParams.category_id = params.categoryId;
      if (params?.completed !== undefined) apiParams.completed = params.completed;
      
      const { data } = await api.get('/tasks', { params: apiParams });
      return data;
    },
    enabled: queryEnabled,
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 1;
    },
  });
};
