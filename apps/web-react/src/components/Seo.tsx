import { useEffect } from 'react';
import { useRouterState } from '@tanstack/react-router';

const SITE_URL = 'https://kerodexofficial.com';
const SITE_NAME = 'Kerodex';
const DEFAULT_IMAGE = `${SITE_URL}/assets/darkmodeNonTransparent.png`;

type SeoEntry = {
  title: string;
  description: string;
  canonicalPath: string;
};

const seoByPath: Record<string, SeoEntry> = {
  '/': {
    title: 'Kerodex | Private-Party Car Marketplace',
    description: 'Kerodex is a minimalist private-party car marketplace with verified listings, fair prices, and no dealer markup.',
    canonicalPath: '/',
  },
  '/signin': {
    title: 'Sign In | Kerodex',
    description: 'Sign in or create a Kerodex account to save vehicles, message sellers, and manage private-party listings.',
    canonicalPath: '/signin',
  },
  '/feature-tour': {
    title: 'Kerodex Guide | Kerodex',
    description: 'Learn the key Kerodex features for safer private-party car buying, listing verification, messaging, and buyer guides.',
    canonicalPath: '/feature-tour',
  },
  '/cars': {
    title: 'Browse Cars | Kerodex',
    description: 'Browse private-party cars on Kerodex with location-based search, transparent listing details, and seller tools.',
    canonicalPath: '/cars',
  },
  '/search': {
    title: 'Browse Cars | Kerodex',
    description: 'Search private-party cars on Kerodex by make, model, location, price, mileage, and more.',
    canonicalPath: '/cars',
  },
  '/sell': {
    title: 'Sell Your Car | Kerodex',
    description: 'List your car on Kerodex with VIN autofill, vehicle verification, pricing guidance, and seller tools.',
    canonicalPath: '/sell',
  },
  '/saved': {
    title: 'Saved Cars | Kerodex',
    description: 'View private-party vehicles saved to your Kerodex account.',
    canonicalPath: '/saved',
  },
  '/messages': {
    title: 'Messages | Kerodex',
    description: 'Message private-party car buyers and sellers securely through Kerodex.',
    canonicalPath: '/messages',
  },
  '/buyer-guides': {
    title: 'Buyer Purchase Guide | Kerodex',
    description: 'Continue a saved Kerodex buyer purchase guide for a private-party vehicle listing.',
    canonicalPath: '/dashboard',
  },
  '/buyer-guide': {
    title: 'Buyer Guide | Kerodex',
    description: 'Get calm, step-by-step guidance from choosing a vehicle through inspection, payment, title transfer, insurance, and registration.',
    canonicalPath: '/buyer-guide',
  },
  '/profile': {
    title: 'Account Settings | Kerodex',
    description: 'Manage your Kerodex account, saved vehicles, verification, and seller settings.',
    canonicalPath: '/profile',
  },
  '/dashboard': {
    title: 'Seller Dashboard | Kerodex',
    description: 'Manage your Kerodex seller activity, listings, views, saves, and buyer conversations.',
    canonicalPath: '/dashboard',
  },
  '/cockpit': {
    title: 'Seller Cockpit | Kerodex',
    description: 'Use the Kerodex seller cockpit to create listings, review listing quality, and track seller performance.',
    canonicalPath: '/cockpit',
  },
  '/verify': {
    title: 'Verification | Kerodex',
    description: 'Manage Kerodex account, vehicle, and listing verification steps.',
    canonicalPath: '/verify',
  },
  '/how-it-works': {
    title: 'How Kerodex Works | Kerodex',
    description: 'Learn how Kerodex helps private sellers list vehicles and helps buyers find cars without dealer markup.',
    canonicalPath: '/how-it-works',
  },
  '/safety': {
    title: 'Safety Center | Kerodex',
    description: 'Kerodex safety guidance for private-party car buyers and sellers, including messaging, meetups, documents, and reports.',
    canonicalPath: '/safety',
  },
  '/about': {
    title: 'About Kerodex | Private-Party Car Marketplace',
    description: 'Kerodex is building a cleaner private-party car marketplace designed around trust, fair prices, and direct buyer-seller transactions.',
    canonicalPath: '/about',
  },
  '/contact': {
    title: 'Contact Kerodex | Kerodex',
    description: 'Contact Kerodex for marketplace support, seller questions, safety concerns, or general feedback.',
    canonicalPath: '/contact',
  },
  '/support': {
    title: 'Support | Kerodex',
    description: 'Get Kerodex support for account access, listings, verification, messaging, and marketplace safety.',
    canonicalPath: '/support',
  },
  '/prohibited-listings': {
    title: 'Prohibited Listings | Kerodex',
    description: 'Review what cannot be listed on Kerodex, including copied listings, misleading vehicle details, unsafe payment requests, and unauthorized inventory.',
    canonicalPath: '/prohibited-listings',
  },
  '/dealer-policy': {
    title: 'Dealer Policy | Kerodex',
    description: 'Kerodex is focused on private-party vehicle listings and limits dealer, broker, and commercial inventory.',
    canonicalPath: '/dealer-policy',
  },
  '/terms': {
    title: 'Terms of Service | Kerodex',
    description: 'Read the Kerodex Terms of Service for using the private-party car marketplace.',
    canonicalPath: '/terms',
  },
  '/privacy': {
    title: 'Privacy Policy | Kerodex',
    description: 'Read the Kerodex Privacy Policy for information about account, listing, and marketplace data.',
    canonicalPath: '/privacy',
  },
};

const sameAs = [
  'https://www.instagram.com/kerodexofficial',
  'https://www.tiktok.com/@kerodexofficial',
  'https://www.linkedin.com/company/kerodexofficial',
  'https://x.com/kerodexofficial',
];

function upsertMeta(selector: string, create: () => HTMLMetaElement, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, attrs: Record<string, string> = {}) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]${attrs.sizes ? `[sizes="${attrs.sizes}"]` : ''}`);
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    Object.entries(attrs).forEach(([key, value]) => element?.setAttribute(key, value));
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function homepageStructuredData() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: DEFAULT_IMAGE,
      email: 'founder@kerodexofficial.com',
      sameAs,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${SITE_URL}/cars?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];
}

export function RouteSeo() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    const isVehicle = pathname.startsWith('/vehicle/');
    const isBuyerGuide = pathname.startsWith('/buyer-guides/');
    const entry = seoByPath[pathname] || (isVehicle
      ? {
          title: 'Vehicle Listing | Kerodex',
          description: 'View a private-party vehicle listing on Kerodex with seller details, market guidance, and safety information.',
          canonicalPath: pathname,
        }
      : isBuyerGuide
        ? seoByPath['/buyer-guides']
        : seoByPath['/']);

    const canonical = `${SITE_URL}${entry.canonicalPath}`;
    document.title = entry.title;
    upsertMeta('meta[name="description"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      return meta;
    }, entry.description);
    upsertLink('canonical', canonical);

    upsertMeta('meta[property="og:title"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:title');
      return meta;
    }, entry.title);
    upsertMeta('meta[property="og:description"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:description');
      return meta;
    }, entry.description);
    upsertMeta('meta[property="og:url"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:url');
      return meta;
    }, canonical);
    upsertMeta('meta[property="og:site_name"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:site_name');
      return meta;
    }, SITE_NAME);
    upsertMeta('meta[property="og:type"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:type');
      return meta;
    }, isVehicle ? 'product' : 'website');
    upsertMeta('meta[property="og:image"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'og:image');
      return meta;
    }, DEFAULT_IMAGE);

    upsertMeta('meta[name="twitter:card"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'twitter:card');
      return meta;
    }, 'summary_large_image');
    upsertMeta('meta[name="twitter:title"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'twitter:title');
      return meta;
    }, entry.title);
    upsertMeta('meta[name="twitter:description"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'twitter:description');
      return meta;
    }, entry.description);
    upsertMeta('meta[name="twitter:image"]', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'twitter:image');
      return meta;
    }, DEFAULT_IMAGE);

    let schema = document.getElementById('kerodex-home-schema') as HTMLScriptElement | null;
    if (pathname === '/') {
      if (!schema) {
        schema = document.createElement('script');
        schema.id = 'kerodex-home-schema';
        schema.type = 'application/ld+json';
        document.head.appendChild(schema);
      }
      schema.textContent = JSON.stringify(homepageStructuredData());
    } else {
      schema?.remove();
    }
  }, [pathname]);

  return null;
}
