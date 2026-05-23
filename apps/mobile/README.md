# Kerodex Mobile

Mobile should be built with React Native + Expo once the web/API product shape settles.

## Proposed Structure

```text
apps/mobile
  app/
    (tabs)/
      index.tsx
      map.tsx
      saved.tsx
      messages.tsx
      sell.tsx
    listing/[id].tsx
  src/
    components/
    features/
      auth/
      listings/
      map/
      messaging/
      offers/
    services/
      api.ts
      realtime.ts
    store/
    theme/
```

## First Native Features

- Map-first browse screen with swipe-up listing drawer.
- Camera-first seller listing flow.
- Push notifications for messages, offers, and price alerts.
- Biometric unlock after OAuth/JWT session setup.
- Offline cache for saved listings and recent searches.
