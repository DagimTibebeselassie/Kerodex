import { createRouter, createRoute, createRootRoute, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, BlinkUIProvider } from '@blinkdotnew/ui';
import { Layout } from './components/Layout';
import { HomePage } from './pages/Home';
import { SearchPage } from './pages/Search';
import { VehicleDetailPage } from './pages/VehicleDetail';
import { DashboardPage } from './pages/Dashboard';
import { SellPage } from './pages/Sell';
import { SavedVehiclesPage } from './pages/Saved';
import { ProfilePage } from './pages/Profile';
import { SellerCockpitPage } from './pages/SellerCockpit';
import { VerificationPage } from './pages/Verification';
import { MessagesPage } from './pages/Messages';
import { StubPage } from './pages/StubPage';

const queryClient = new QueryClient();

const rootRoute = createRootRoute({
  component: () => (
    <>
      <Layout />
      <Toaster position="top-right" />
    </>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: SearchPage,
});

const legacySearchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search.html',
  component: SearchPage,
});

const vehicleDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/vehicle/$id',
  component: VehicleDetailPage,
});

const legacyListingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/listing.html',
  component: () => {
    const id = new URLSearchParams(window.location.search).get('id') || '';
    window.location.replace(id ? `/vehicle/${encodeURIComponent(id)}` : '/search');
    return null;
  },
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: DashboardPage,
});

const sellRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sell',
  component: SellPage,
});

const savedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/saved',
  component: SavedVehiclesPage,
});

// ── Stub routes for nav links ─────────────────────────────────────────────
const messagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/messages',
  component: MessagesPage,
});

const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: ProfilePage,
});

const legacyProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile.html',
  component: ProfilePage,
});

const cockpitRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cockpit',
  component: SellerCockpitPage,
});

const verifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/verify',
  component: VerificationPage,
});

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: () => <StubPage title="About Kerodex" description="Kerodex is a private-party car marketplace built for trust, transparency, and simplicity." />,
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  component: () => <StubPage title="Terms of Service" description="Our terms of service are being finalized. Please check back soon." />,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: () => <StubPage title="Privacy Policy" description="Our privacy policy is being finalized. Please check back soon." />,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  searchRoute,
  legacySearchRoute,
  vehicleDetailRoute,
  legacyListingRoute,
  dashboardRoute,
  sellRoute,
  savedRoute,
  messagesRoute,
  profileRoute,
  legacyProfileRoute,
  cockpitRoute,
  verifyRoute,
  aboutRoute,
  termsRoute,
  privacyRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BlinkUIProvider theme="minimal">
        <RouterProvider router={router} />
      </BlinkUIProvider>
    </QueryClientProvider>
  );
}
