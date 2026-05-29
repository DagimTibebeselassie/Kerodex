import { useQuery } from '@tanstack/react-query';
import { Vehicle } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { listVehicles } from '@/lib/api';
import { Button, Stat, StatGroup, DataTable, EmptyState } from '@blinkdotnew/ui';
import { Link } from '@tanstack/react-router';
import { Plus, BarChart3, MessageSquare, Car, ExternalLink } from 'lucide-react';

export function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();

  const { data: myVehicles, isLoading: vehiclesLoading } = useQuery({
    queryKey: ['my-vehicles', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const vehicles = await listVehicles();
      return vehicles.filter((vehicle) => vehicle.userId === user.id || vehicle.seller?.name === user.name) as Vehicle[];
    },
    enabled: !!user,
  });

  if (authLoading || vehiclesLoading) return <div className="p-12 animate-pulse space-y-8">
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
            <img src={row.original.images[0]} alt="" className="w-full h-full object-cover" />
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
          value="1,284" 
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
          value="12" 
          icon={<MessageSquare className="h-4 w-4" />}
          className="bg-background border border-border p-6 shadow-none"
        />
        <Stat 
          label="Conversion Rate" 
          value="2.4%" 
          className="bg-background border border-border p-6 shadow-none"
        />
      </StatGroup>

      <div className="space-y-6">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground">Your Active Listings</h2>
        {myVehicles?.length === 0 ? (
          <EmptyState 
            title="No listings yet"
            description="Start selling your vehicles on Kerodex today."
            icon={<Car className="h-8 w-8 text-muted-foreground" />}
            action={{ label: 'Create Listing', onClick: () => {} }}
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
