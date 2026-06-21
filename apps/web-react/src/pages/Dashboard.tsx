import { useQuery } from '@tanstack/react-query';
import { Vehicle } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { listBuyerGuides, listConversations, listMyVehicles, toVehicle } from '@/lib/api';
import { Button, Stat, StatGroup, DataTable, EmptyState } from '@blinkdotnew/ui';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus, BarChart3, MessageSquare, Car, ExternalLink, BookOpenCheck } from 'lucide-react';
import { vehicleImageAlt } from '@/lib/vehicleImage';

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

  const { data: conversations = [] } = useQuery({
    queryKey: ['dashboard-conversations', user?.id],
    queryFn: async () => user ? listConversations() : [],
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

  const columns = [
    {
      accessorKey: 'make',
      header: 'Vehicle',
      cell: ({ row }: any) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-14 bg-muted overflow-hidden shrink-0">
            <img src={row.original.images[0]} alt={vehicleImageAlt(row.original)} className="w-full h-full object-cover" />
          </div>
          <div className="text-[13px] font-bold">
            {row.original.year} {row.original.make} {row.original.model}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ row }: any) => <span className="text-[13px] font-medium">${row.original.price.toLocaleString()}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => (
        <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 bg-green-50 text-green-700 border border-green-100">
          {row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'id',
      header: '',
      cell: ({ row }: any) => (
        <div className="flex justify-end gap-2">
          <Link to="/vehicle/$id" params={{ id: row.original.id }}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ),
    },
  ];
  const totalViews = (myVehicles || []).reduce((sum, vehicle: any) => sum + Number(vehicle.views || 0), 0);
  const totalMessages = conversations.length;
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

      <StatGroup className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Stat
          label="Total Views"
          value={totalViews.toLocaleString()}
          icon={<BarChart3 className="h-4 w-4" />}
          className="bg-background border border-border p-6 shadow-none"
        />
        <Stat
          label="Active Listings"
          value={myVehicles?.length.toString() || '0'}
          icon={<Car className="h-4 w-4" />}
          className="bg-background border border-border p-6 shadow-none"
        />
        <Stat
          label="Messages"
          value={totalMessages.toString()}
          icon={<MessageSquare className="h-4 w-4" />}
          className="bg-background border border-border p-6 shadow-none"
        />
        <Stat
          label="Saved By Buyers"
          value={totalSaves.toString()}
          className="bg-background border border-border p-6 shadow-none"
        />
      </StatGroup>

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
          <EmptyState
            title="No buying guides yet"
            description="Start a guide from a vehicle listing when you are interested in buying."
            icon={<BookOpenCheck className="h-8 w-8 text-muted-foreground" />}
            action={{ label: 'Browse Listings', onClick: () => navigate({ to: '/cars' }) }}
            className="border border-border py-14"
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
          <EmptyState 
            title="No listings yet"
            description="Start selling your vehicles on Kerodex today."
            icon={<Car className="h-8 w-8 text-muted-foreground" />}
            action={{ label: 'Create Listing', onClick: () => navigate({ to: '/sell' }) }}
            className="border border-border py-20"
          />
        ) : (
          <div className="border border-border bg-background">
            <DataTable 
              columns={columns} 
              data={myVehicles || []} 
              className="border-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
