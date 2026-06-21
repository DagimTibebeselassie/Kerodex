import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listSavedVehicles, setVehicleSaved } from '@/lib/api';

export function useSavedVehicles(userId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['saved-vehicles', userId];
  const query = useQuery({
    queryKey,
    queryFn: () => listSavedVehicles(),
    enabled: Boolean(userId),
    initialData: userId ? undefined : { listingIds: [], vehicles: [], count: 0 },
    staleTime: 60_000,
  });
  const mutation = useMutation({
    mutationFn: ({ vehicleId, saved }: { vehicleId: string; saved: boolean }) => setVehicleSaved(vehicleId, saved),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['saved-count', userId] });
      queryClient.invalidateQueries({ queryKey: ['my-vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['my-vehicles-count'] });
    },
  });

  return {
    ...query,
    savedIds: new Set(query.data?.listingIds || []),
    vehicles: query.data?.vehicles || [],
    count: query.data?.count || 0,
    setSaved: (vehicleId: string, saved: boolean) => mutation.mutateAsync({ vehicleId, saved }),
    isSaving: mutation.isPending,
  };
}
