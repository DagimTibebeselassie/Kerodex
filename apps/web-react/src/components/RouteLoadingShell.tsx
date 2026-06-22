function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-muted ${className}`} aria-hidden="true" />;
}

export function ListingGridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:gap-6 xl:grid-cols-3" aria-label="Loading vehicle listings">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="border border-border bg-background">
          <SkeletonBlock className="aspect-[4/3] w-full" />
          <div className="space-y-3 p-5">
            <SkeletonBlock className="h-4 w-3/4" />
            <SkeletonBlock className="h-3 w-1/2" />
            <SkeletonBlock className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VehicleDetailSkeleton() {
  return (
    <div className="mx-auto min-h-[1320px] max-w-screen-xl px-4 py-8 md:px-6 md:py-10" aria-label="Loading vehicle listing">
      <SkeletonBlock className="mb-8 h-10 w-36" />
      <div className="mb-8 flex flex-col justify-between gap-6 md:flex-row">
        <div className="space-y-3">
          <SkeletonBlock className="h-8 w-72 max-w-full" />
          <SkeletonBlock className="h-4 w-52" />
        </div>
        <SkeletonBlock className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 xl:gap-16">
        <div className="space-y-10 lg:col-span-8">
          <SkeletonBlock className="aspect-video w-full border border-border" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, index) => <SkeletonBlock key={index} className="aspect-video" />)}
          </div>
          <SkeletonBlock className="h-12 w-full" />
          <div className="space-y-4">
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="h-4 w-11/12" />
            <SkeletonBlock className="h-4 w-4/5" />
          </div>
        </div>
        <div className="space-y-5 lg:col-span-4">
          <SkeletonBlock className="h-48 w-full border border-border" />
          <SkeletonBlock className="h-72 w-full border border-border" />
          <SkeletonBlock className="h-44 w-full border border-border" />
        </div>
      </div>
    </div>
  );
}

export function SellFormSkeleton() {
  return (
    <div className="mx-auto min-h-[1680px] max-w-screen-md px-4 py-10 md:px-6" aria-label="Loading vehicle listing form">
      <div className="mb-10 space-y-3">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="h-9 w-72 max-w-full" />
        <SkeletonBlock className="h-4 w-96 max-w-full" />
      </div>
      <SkeletonBlock className="mb-8 h-32 w-full border border-border" />
      <div className="space-y-8">
        {Array.from({ length: 6 }, (_, section) => (
          <div key={section} className="space-y-4 border border-border p-5">
            <SkeletonBlock className="h-5 w-44" />
            <div className="grid gap-4 sm:grid-cols-2">
              <SkeletonBlock className="h-11 w-full" />
              <SkeletonBlock className="h-11 w-full" />
              <SkeletonBlock className="h-11 w-full" />
              <SkeletonBlock className="h-11 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RouteLoadingShell({ pathname }: { pathname: string }) {
  if (pathname === '/cars' || pathname === '/search' || pathname === '/search.html') {
    return (
      <div className="min-h-[1100px] px-4 py-16 md:px-6">
        <ListingGridSkeleton />
      </div>
    );
  }
  if (pathname.startsWith('/vehicle/')) return <VehicleDetailSkeleton />;
  if (pathname === '/sell') return <SellFormSkeleton />;
  return <div className="min-h-[calc(100dvh-3.5rem)] bg-background" aria-label="Loading page" />;
}
