import { createRouter, createRoute, createRootRoute, Outlet, RouterProvider, useRouterState } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { lazy, Suspense, useEffect } from 'react';
import { Layout } from './components/Layout';
import { RouteSeo } from './components/Seo';
import { consumeAuthRedirect, currentUser, trackAnalyticsEvent } from './lib/api';
import { AuthProvider } from './hooks/useAuth';

function lazyNamed<T extends Record<string, any>, K extends keyof T>(loader: () => Promise<T>, name: K) {
  return lazy(async () => ({ default: (await loader())[name] as React.ComponentType<any> }));
}

const SearchPage = lazyNamed(() => import('./pages/Search'), 'SearchPage');
const HomePage = lazyNamed(() => import('./pages/Home'), 'HomePage');
const VehicleDetailPage = lazyNamed(() => import('./pages/VehicleDetail'), 'VehicleDetailPage');
const DashboardPage = lazyNamed(() => import('./pages/Dashboard'), 'DashboardPage');
const SellPage = lazyNamed(() => import('./pages/Sell'), 'SellPage');
const SavedVehiclesPage = lazyNamed(() => import('./pages/Saved'), 'SavedVehiclesPage');
const ProfilePage = lazyNamed(() => import('./pages/Profile'), 'ProfilePage');
const SellerCockpitPage = lazyNamed(() => import('./pages/SellerCockpit'), 'SellerCockpitPage');
const SellerProfilePage = lazyNamed(() => import('./pages/SellerProfile'), 'SellerProfilePage');
const VerificationPage = lazyNamed(() => import('./pages/Verification'), 'VerificationPage');
const MessagesPage = lazyNamed(() => import('./pages/Messages'), 'MessagesPage');
const BuyerGuidePage = lazyNamed(() => import('./pages/BuyerGuide'), 'BuyerGuidePage');
const BuyerGuideFlowPage = lazyNamed(() => import('./pages/BuyerGuideFlow'), 'BuyerGuideFlowPage');
const PrivacyPage = lazyNamed(() => import('./pages/LegalPage'), 'PrivacyPage');
const TermsPage = lazyNamed(() => import('./pages/LegalPage'), 'TermsPage');
const SafetyCenterPage = lazyNamed(() => import('./pages/SafetyCenter'), 'SafetyCenterPage');
const AboutPage = lazyNamed(() => import('./pages/About'), 'AboutPage');
const DealerPolicyPage = lazyNamed(() => import('./pages/MarketingPages'), 'DealerPolicyPage');
const HowItWorksPage = lazyNamed(() => import('./pages/MarketingPages'), 'HowItWorksPage');
const ProhibitedListingsPage = lazyNamed(() => import('./pages/MarketingPages'), 'ProhibitedListingsPage');
const SignInPage = lazyNamed(() => import('./pages/MarketingPages'), 'SignInPage');
const SupportPage = lazyNamed(() => import('./pages/MarketingPages'), 'SupportPage');
const AccessibilityStatementPage = lazyNamed(() => import('./pages/CompliancePages'), 'AccessibilityStatementPage');
const ContactSupportPage = lazyNamed(() => import('./pages/CompliancePages'), 'ContactSupportPage');
const ReportProblemPage = lazyNamed(() => import('./pages/CompliancePages'), 'ReportProblemPage');
const OnboardingPage = lazyNamed(() => import('./pages/Onboarding'), 'OnboardingPage');
const FeatureTourPage = lazyNamed(() => import('./pages/FeatureTour'), 'FeatureTourPage');
const AdminPage = lazyNamed(() => import('./pages/Admin'), 'AdminPage');
const NotFoundPage = lazyNamed(() => import('./pages/NotFound'), 'NotFoundPage');

const queryClient = new QueryClient();

function RouteAnalytics() {
  const location = useRouterState({ select: (state) => state.location });

  useEffect(() => {
    const send = () => trackAnalyticsEvent({
      eventType: 'page_view',
      route: `${location.pathname}${location.searchStr || ''}`,
    });
    const idleWindow = window as Window & typeof globalThis & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (idleWindow.requestIdleCallback) {
      const id = idleWindow.requestIdleCallback(send, { timeout: 3000 });
      return () => idleWindow.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(send, 1200);
    return () => window.clearTimeout(id);
  }, [location.pathname, location.searchStr]);

  return null;
}

function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return <Suspense fallback={<div className="min-h-screen bg-background" aria-label="Loading admin" />}><Outlet /></Suspense>;
  }
  return <Layout />;
}

const rootRoute = createRootRoute({
  component: () => (
    <>
      <RouteSeo />
      <RouteAnalytics />
      <AppShell />
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
  notFoundComponent: NotFoundPage,
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

const featureTourRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/feature-tour',
  component: FeatureTourPage,
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

const buyerGuideRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/buyer-guides/$guideId',
  component: BuyerGuidePage,
});

const buyerGuideFlowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/buyer-guide',
  component: BuyerGuideFlowPage,
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
  component: ContactSupportPage,
});

const accessibilityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/accessibility',
  component: AccessibilityStatementPage,
});

const reportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/report',
  component: ReportProblemPage,
});

const supportRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/support',
  component: SupportPage,
});

const prohibitedListingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/prohibited-listings',
  component: ProhibitedListingsPage,
});

const dealerPolicyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dealer-policy',
  component: DealerPolicyPage,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminPage,
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
  featureTourRoute,
  savedRoute,
  messagesRoute,
  buyerGuideRoute,
  buyerGuideFlowRoute,
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
  accessibilityRoute,
  reportRoute,
  supportRoute,
  prohibitedListingsRoute,
  dealerPolicyRoute,
  adminRoute,
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
      <AuthProvider>
        <AuthRedirectHandler />
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
