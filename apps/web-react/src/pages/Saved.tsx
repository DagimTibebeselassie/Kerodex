import { useQuery } from '@tanstack/react-query';
import { Vehicle } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { listVehicles, savedVehicleIds } from '@/lib/api';
import { Link } from '@tanstack/react-router';
import { useNavigate } from '@tanstack/react-router';
import { Button, EmptyState } from '@/components/ui';
import { Heart, MapPin, Gauge, ArrowRight } from 'lucide-react';

export function SavedVehiclesPage() {
  const { user, login, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data: savedVehicles, isLoading: savedLoading } = useQuery({
    queryKey: ['saved-vehicles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const ids = savedVehicleIds();
      if (ids.size === 0) return [];
      const vehicles = await listVehicles();
      return vehicles.filter((vehicle) => ids.has(vehicle.id)) as Vehicle[];
    },
    enabled: !!user,
  });

  if (authLoading) return <div className="p-12 animate-pulse" />;

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <Heart className="h-12 w-12 text-muted-foreground mb-6" />
        <h2 className="text-xl font-bold mb-2">Save your favorites</h2>
        <p className="text-muted-foreground text-[13px] mb-8 max-w-xs">
          Sign in to keep track of the vehicles you're interested in.
        </p>
        <Button onClick={login} className="h-10 px-8 text-[12px] font-bold uppercase tracking-widest">
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in px-6 py-12 max-w-screen-xl mx-auto">
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Saved Collection</h1>
        <p className="text-muted-foreground text-[13px]">Your curated list of premium vehicles.</p>
      </div>

      {savedLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-video bg-muted animate-pulse" />
          ))}
        </div>
      ) : savedVehicles?.length === 0 ? (
        <EmptyState 
          title="No saved vehicles"
          description="Browse the marketplace and heart the listings you love."
          icon={<Heart className="h-8 w-8 text-muted-foreground" />}
          action={{ label: 'Explore Marketplace', onClick: () => navigate({ to: '/search' }) }}
          className="border border-border py-20"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedVehicles?.map((vehicle) => (
            <Link 
              key={vehicle.id} 
              to="/vehicle/$id" 
              params={{ id: vehicle.id }}
              className="group block border border-border bg-background hover:shadow-sm transition-all"
            >
              <div className="aspect-video overflow-hidden bg-muted">
                <img 
                  src={vehicle.images[0]} 
                  alt="" 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <h4 className="text-[15px] font-bold tracking-tight">
                    {vehicle.year} {vehicle.make} {vehicle.model}
                  </h4>
                  <div className="text-[14px] font-bold">${vehicle.price.toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground text-[12px]">
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {vehicle.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Gauge className="h-3 w-3" /> {vehicle.mileage.toLocaleString()} mi
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
