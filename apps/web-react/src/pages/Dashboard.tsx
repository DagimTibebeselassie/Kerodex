import { useQuery } from '@tanstack/react-query';
import { Vehicle } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { listBuyerGuides, listMyVehicles, toVehicle } from '@/lib/api';
import { BasicButton as Button } from '@/components/BasicButton';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus, BarChart3, MessageSquare, Car, ExternalLink, BookOpenCheck } from 'lucide-react';
import { vehicleImageAlt } from '@/lib/vehicleImage';

function DashboardStat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="border border-border bg-background p-6">
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}

function DashboardEmpty({ title, description, actionLabel, onAction, icon }: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center border border-border px-6 py-14 text-center">
      {icon}
      <h3 className="mt-4 text-[15px] font-bold">{title}</h3>
      <p className="mt-2 max-w-md text-[13px] text-muted-foreground">{description}</p>
      <Button onClick={onAction} className="mt-6 h-10 px-5 text-[11px] font-bold uppercase tracking-wider">{actionLabel}</Button>
    </div>
  );
}

export function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data: myVehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['my-vehicles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      return await listMyVehicles() as Vehicle[];
    },
    enabled: !!user,
  });

  const { data: buyerGuides = [], isLoading: guidesLoading } = useQuery({
    queryKey: ['buyer-guides', user?.id],
    queryFn: async () => user ? listBuyerGuides() : [],
    enabled: !!user,
  });

  if (authLoading || vehiclesLoading || guidesLoading) return <div className="p-12 animate-pulse space-y-8">
    <div className="h-10 w-1/4 bg-muted" />
    <div className="grid grid-cols-4 gap-6"><div className="h-24 bg-muted" /></div>
  </div>;

  const totalViews = (myVehicles || []).reduce((sum, vehicle: any) => sum + Number(vehicle.views || 0), 0);
  const totalSaves = (myVehicles || []).reduce((sum, vehicle: any) => sum + Number(vehicle.favorites || vehicle.saves || 0), 0);

  return (
    <div className="animate-fade-in px-6 py-12 max-w-screen-xl mx-auto space-y-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Seller Dashboard</h1>
          <p className="text-muted-foreground text-[13px]">Manage your listings and track performance.</p>
        </div>
        <Link to="/sell">
          <Button className="h-10 px-6 text-[12px] font-bold uppercase tracking-widest">
            <Plus className="h-4 w-4 mr-2" /> New Listing
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <DashboardStat label="Total Views" value={totalViews.toLocaleString()} icon={<BarChart3 className="h-4 w-4" />} />
        <DashboardStat label="Active Listings" value={myVehicles?.length.toString() || '0'} icon={<Car className="h-4 w-4" />} />
        <DashboardStat label="Messages" value="Open" icon={<MessageSquare className="h-4 w-4" />} />
        <DashboardStat label="Saved By Buyers" value={totalSaves.toString()} />
      </div>

      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">My Buying Guides</h2>
            <p className="text-[12px] text-muted-foreground mt-2">Resume vehicle discovery or a private-party purchase checklist.</p>
          </div>
          <Link to="/buyer-guide" className="hidden sm:inline-flex">
            <Button variant="outline" className="h-9 px-4 text-[11px] font-bold uppercase tracking-widest">Start Buyer Guide</Button>
          </Link>
        </div>
        {buyerGuides.length === 0 ? (
          <DashboardEmpty
            title="No buying guides yet"
            description="Start a guide from a vehicle listing when you are interested in buying."
            icon={<BookOpenCheck className="h-8 w-8 text-muted-foreground" />}
            actionLabel="Browse Listings"
            onAction={() => navigate({ to: '/cars' })}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {buyerGuides.map((guide: any) => {
              const listing = guide.listing ? toVehicle(guide.listing) : null;
              const completed = (guide.completedSteps || guide.completed_steps || []).length;
              const total = 11;
              return (
                <div key={guide.id} className="border border-border bg-background p-4 flex gap-4">
                  <div className="h-20 w-28 bg-muted overflow-hidden shrink-0">
                    {listing?.images?.[0] ? <img src={listing.images[0]} alt={vehicleImageAlt(listing)} className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[13px] font-bold truncate">{listing ? `${listing.year} ${listing.make} ${listing.model}` : 'Vehicle discovery guide'}</h3>
                        <p className="text-[12px] text-muted-foreground mt-1">{completed} of {total} complete · {guide.status}</p>
                      </div>
                      {listing ? (
                        <Link to="/buyer-guides/$guideId" params={{ guideId: guide.id }}>
                          <Button size="sm" variant="outline" className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest">Resume</Button>
                        </Link>
                      ) : (
                        <Link to="/buyer-guide">
                          <Button size="sm" variant="outline" className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest">Resume</Button>
                        </Link>
                      )}
                    </div>
                    <div className="h-1.5 bg-muted mt-4 overflow-hidden">
                      <div className="h-full bg-foreground" style={{ width: `${listing ? Math.round((completed / total) * 100) : (guide.recommendations ? 66 : 20)}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Your Active Listings</h2>
        {myVehicles?.length === 0 ? (
          <DashboardEmpty
            title="No listings yet"
            description="Start selling your vehicles on Kerodex today."
            icon={<Car className="h-8 w-8 text-muted-foreground" />}
            actionLabel="Create Listing"
            onAction={() => navigate({ to: '/sell' })}
          />
        ) : (
          <div className="overflow-x-auto border border-border bg-background">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-b border-border text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {(myVehicles || []).map((vehicle) => (
                  <tr key={vehicle.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-14 shrink-0 overflow-hidden bg-muted">
                          <img src={vehicle.images[0]} alt={vehicleImageAlt(vehicle)} width={56} height={40} loading="lazy" className="h-full w-full object-cover" />
                        </div>
                        <span className="text-[13px] font-bold">{vehicle.year} {vehicle.make} {vehicle.model}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-medium">${vehicle.price.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="border border-green-100 bg-green-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-green-700">{vehicle.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link to="/vehicle/$id" params={{ id: vehicle.id }} aria-label={`Open ${vehicle.year} ${vehicle.make} ${vehicle.model}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><ExternalLink className="h-4 w-4" /></Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
