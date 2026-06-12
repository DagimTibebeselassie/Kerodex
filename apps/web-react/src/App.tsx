import { createRouter, createRoute, createRootRoute, RouterProvider, useRouterState } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, BlinkUIProvider, toast } from '@blinkdotnew/ui';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { HomePage } from './pages/Home';
import { SearchPage } from './pages/Search';
import { VehicleDetailPage } from './pages/VehicleDetail';
import { DashboardPage } from './pages/Dashboard';
import { SellPage } from './pages/Sell';
import { SavedVehiclesPage } from './pages/Saved';
import { ProfilePage } from './pages/Profile';
import { SellerCockpitPage } from './pages/SellerCockpit';
import { SellerProfilePage } from './pages/SellerProfile';
import { VerificationPage } from './pages/Verification';
import { MessagesPage } from './pages/Messages';
import { PrivacyPage, TermsPage } from './pages/LegalPage';
import { SafetyCenterPage } from './pages/SafetyCenter';
import { AboutPage } from './pages/About';
import { ContactPage, HowItWorksPage, SignInPage } from './pages/MarketingPages';
import { OnboardingPage } from './pages/Onboarding';
import { RouteSeo } from './components/Seo';
import { consumeAuthRedirect, currentUser, trackAnalyticsEvent } from './lib/api';

const queryClient = new QueryClient();

function RouteAnalytics() {
  const location = useRouterState({ select: (state) => state.location });

  useEffect(() => {
    trackAnalyticsEvent({
      eventType: 'page_view',
      route: `${location.pathname}${location.searchStr || ''}`,
    });
  }, [location.pathname, location.searchStr]);

  return null;
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <RouteSeo />
      <RouteAnalytics />
      <Layout />
      <Toaster
        position="top-right"
        duration={2600}
        gap={8}
        visibleToasts={3}
        toastOptions={{
          classNames: {
            toast: 'kerodex-toast group relative flex items-start gap-3 overflow-hidden rounded-md border border-border bg-card px-4 py-3 pr-10 text-sm text-card-foreground shadow-lg',
            title: 'text-[13px] font-semibold leading-snug tracking-tight',
            description: 'mt-0.5 text-[12px] leading-snug text-muted-foreground',
            closeButton: 'text-muted-foreground opacity-60 transition-opacity hover:opacity-100',
            actionButton: 'mt-2 text-xs font-medium underline underline-offset-2',
            cancelButton: 'mt-2 text-xs text-muted-foreground hover:opacity-80',
            success: 'border-border bg-card',
            error: 'border-destructive/40 bg-card',
            warning: 'border-amber-500/40 bg-card',
            info: 'border-border bg-card',
          },
        }}
      />
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

const carsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cars',
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

const sellerProfileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/seller/$id',
  component: SellerProfilePage,
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

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signin',
  component: SignInPage,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  component: OnboardingPage,
});

const savedRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/saved',
  component: SavedVehiclesPage,
});

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
  component: AboutPage,
});

const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  component: TermsPage,
});

const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: PrivacyPage,
});

const safetyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/safety',
  component: SafetyCenterPage,
});

const howItWorksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/how-it-works',
  component: HowItWorksPage,
});

const contactRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/contact',
  component: ContactPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  searchRoute,
  carsRoute,
  legacySearchRoute,
  vehicleDetailRoute,
  sellerProfileRoute,
  legacyListingRoute,
  dashboardRoute,
  sellRoute,
  signInRoute,
  onboardingRoute,
  savedRoute,
  messagesRoute,
  profileRoute,
  legacyProfileRoute,
  cockpitRoute,
  verifyRoute,
  aboutRoute,
  termsRoute,
  privacyRoute,
  safetyRoute,
  howItWorksRoute,
  contactRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function AuthRedirectHandler() {
  const navigate = router.navigate;
  useEffect(() => {
    const result = consumeAuthRedirect();
    if (!result) return;
    if (result.ok) {
      const user = currentUser();
      toast.success('Signed in successfully.');
      if (user && !user.onboardingCompleted) {
        navigate({ to: '/onboarding' });
      }
    }
    else {
      toast.error(result.error || 'Authentication failed.');
      if ((result.error || '').toLowerCase().includes('no account found')) {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent('kerodex:auth-required', { detail: { tab: 'signup' } }));
        }, 250);
      }
    }
  }, [navigate]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BlinkUIProvider theme="minimal">
        <AuthRedirectHandler />
        <RouterProvider router={router} />
      </BlinkUIProvider>
    </QueryClientProvider>
  );
}
