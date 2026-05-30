# Kerodex Enterprise Architecture Blueprint
## Full-Scale Private-Party Car Marketplace — 2026 Edition

> **Copy this entire document into a new AI chat to bootstrap your AWS/microservices backend implementation.**

---

## 1. Product Vision

Kerodex is a trust-first, private-party car marketplace combining:
- The visual polish of **Turo / Airbnb**
- The data richness of **CarGurus**
- The search power of **Autotrader**
- The trust layer of a fintech-grade platform
- Scalable to 10M+ users on AWS

---

## 2. High-Level Architecture

```
[Client: React Web + React Native Mobile]
         │
         ▼
[CloudFront CDN]  ──────────  [S3 Static Assets]
         │
         ▼
[AWS API Gateway]
         │
    ┌────┴──────────────────────────────────┐
    │           Microservices               │
    ├───────────────────────────────────────┤
    │  auth-service      (JWT, OAuth, MFA)  │
    │  vehicle-service   (CRUD, search)     │
    │  user-service      (profiles, trust)  │
    │  message-service   (inbox, WS)        │
    │  verify-service    (ID, VIN, fraud)   │
    │  payment-service   (Stripe, escrow)   │
    │  notification-svc  (email/SMS/push)   │
    │  search-service    (OpenSearch)       │
    │  analytics-service (events, funnels)  │
    │  admin-service     (moderation)       │
    └───────────────────────────────────────┘
         │
    ┌────┴────────────────────────────────────┐
    │           Data Layer                    │
    ├─────────────────────────────────────────┤
    │  RDS PostgreSQL     (primary store)     │
    │  ElastiCache Redis  (sessions, cache)   │
    │  Amazon OpenSearch  (vehicle search)    │
    │  S3                 (images, docs)      │
    │  DynamoDB           (messages, events)  │
    └─────────────────────────────────────────┘
         │
    ┌────┴────────────────────────────────────┐
    │         Async / Infrastructure          │
    ├─────────────────────────────────────────┤
    │  SQS + SNS          (event bus)         │
    │  Lambda             (async workers)     │
    │  ECS Fargate        (service hosting)   │
    │  EKS (optional)     (Kubernetes)        │
    │  CloudWatch         (logs + alerts)     │
    │  Secrets Manager    (credentials)       │
    └─────────────────────────────────────────┘
```

---

## 3. Tech Stack

### Frontend (Web)
```
React 18 + TypeScript
TanStack Router v1 (file-based routing)
TanStack Query v5 (data fetching + cache)
Tailwind CSS 3 + Radix UI primitives
Framer Motion (animations)
Mapbox GL JS (interactive map)
Leaflet (fallback / lightweight map)
Recharts (analytics dashboards)
React Hook Form + Zod (form validation)
```

### Frontend (Mobile)
```
Expo SDK 51 + React Native
Expo Router (navigation)
React Native Reanimated 3
React Native Maps
```

### Backend Services
```
Runtime:    Node.js 22 (ESM) or Go 1.22
Framework:  NestJS (Node) or Fiber (Go)
ORM:        Prisma (Node) or GORM (Go)
Auth:       Passport.js + JWT + OAuth2
Real-time:  Socket.io / Pusher / AWS API Gateway WebSockets
Queue:      BullMQ (Redis-backed) or AWS SQS
```

### Databases
```
Primary:    PostgreSQL 16 (RDS Multi-AZ)
Cache:      Redis 7 (ElastiCache cluster)
Search:     Amazon OpenSearch 2.x
Documents:  DynamoDB (messages, activity feeds)
Files:      S3 + CloudFront
```

### Infrastructure
```
Container:  Docker + ECR
Orchestration: ECS Fargate (simple) → EKS (scale)
CDN:        CloudFront
DNS:        Route53
SSL:        ACM (free certs)
Monitoring: CloudWatch + Grafana + Sentry
CI/CD:      GitHub Actions → ECR → ECS rolling deploy
IaC:        AWS CDK (TypeScript) or Terraform
```

---

## 4. Database Schema (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  phone_verified BOOLEAN DEFAULT false,
  email_verified BOOLEAN DEFAULT false,
  role TEXT DEFAULT 'buyer',  -- buyer | seller | admin | moderator
  trust_score INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in TIMESTAMPTZ
);

-- Vehicles / Listings
CREATE TABLE vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  trim TEXT,
  vin TEXT UNIQUE,
  price INTEGER NOT NULL,
  mileage INTEGER NOT NULL,
  body_type TEXT,
  fuel_type TEXT,
  drivetrain TEXT,
  exterior_color TEXT,
  interior_color TEXT,
  transmission TEXT DEFAULT 'automatic',
  condition TEXT DEFAULT 'used',
  location TEXT NOT NULL,
  latitude FLOAT,
  longitude FLOAT,
  description TEXT,
  images JSONB DEFAULT '[]',
  features JSONB DEFAULT '[]',
  status TEXT DEFAULT 'available',  -- available | sold | archived | flagged
  vin_verified BOOLEAN DEFAULT false,
  deal_score TEXT,  -- great | good | fair | overpriced
  market_price INTEGER,
  promoted_until TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved / Favorites
CREATE TABLE saved_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, vehicle_id)
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES users(id),
  receiver_id UUID REFERENCES users(id),
  vehicle_id UUID REFERENCES vehicles(id),
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trust & Verification
CREATE TABLE verification_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  doc_type TEXT,  -- gov_id | selfie | utility_bill
  s3_key TEXT NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending | approved | rejected
  provider TEXT,  -- internal | persona | stripe_identity
  provider_ref TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trust_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE,
  total INTEGER DEFAULT 0,
  email_verified INTEGER DEFAULT 0,
  phone_verified INTEGER DEFAULT 0,
  id_verified INTEGER DEFAULT 0,
  selfie_verified INTEGER DEFAULT 0,
  vin_count INTEGER DEFAULT 0,
  account_age_days INTEGER DEFAULT 0,
  completed_sales INTEGER DEFAULT 0,
  fraud_flags INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'unverified',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL,
  entity_type TEXT NOT NULL,  -- user | vehicle | message
  flag_type TEXT NOT NULL,
  severity TEXT DEFAULT 'low',
  reason TEXT,
  auto_detected BOOLEAN DEFAULT false,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID REFERENCES users(id),
  reviewee_id UUID REFERENCES users(id),
  vehicle_id UUID REFERENCES vehicles(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VIN Check Cache
CREATE TABLE vin_records (
  vin TEXT PRIMARY KEY,
  make TEXT,
  model TEXT,
  year INTEGER,
  trim TEXT,
  engine TEXT,
  fuel_type TEXT,
  drive_type TEXT,
  raw_nhtsa JSONB,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN DEFAULT false,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics Events
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,
  event TEXT NOT NULL,
  properties JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments / Billing
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  stripe_payment_intent TEXT,
  amount INTEGER,
  currency TEXT DEFAULT 'usd',
  type TEXT,  -- listing_boost | subscription | escrow
  status TEXT DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX ON vehicles(user_id);
CREATE INDEX ON vehicles(status);
CREATE INDEX ON vehicles(make, model, year);
CREATE INDEX ON vehicles(price);
CREATE INDEX ON vehicles(location);
CREATE INDEX ON saved_vehicles(user_id);
CREATE INDEX ON messages(sender_id, receiver_id, vehicle_id);
CREATE INDEX ON notifications(user_id, read);
CREATE INDEX ON analytics_events(event, created_at);
```

---

## 5. Microservice Contracts (REST API)

### Auth Service `/api/auth`
```
POST   /register          → { token, user }
POST   /login             → { token, user }
POST   /oauth/google      → redirect
POST   /oauth/apple       → redirect
POST   /refresh           → { token }
POST   /logout
GET    /me                → BlinkUser
PATCH  /me                → BlinkUser
POST   /phone/send-otp    → { sid }
POST   /phone/verify      → { verified: true }
POST   /mfa/setup         → { qrCode }
POST   /mfa/verify        → { token }
```

### Vehicle Service `/api/vehicles`
```
GET    /                  → Vehicle[]  (filters, sort, pagination)
POST   /                  → Vehicle
GET    /:id               → Vehicle
PATCH  /:id               → Vehicle
DELETE /:id
GET    /:id/similar       → Vehicle[]
POST   /:id/boost         → Vehicle
POST   /vin/:vin/decode   → VinResult  (cached, NHTSA fallback)
```

### Message Service `/api/messages`
```
GET    /threads           → Thread[]
GET    /threads/:id       → Message[]
POST   /                  → Message
PUT    /:id/read
DELETE /:id
WS     /ws                (Socket.io real-time)
```

### Verify Service `/api/verify`
```
POST   /id-upload         → { upload_url, record_id }
POST   /selfie-upload     → { upload_url, record_id }
GET    /status            → VerificationStatus
GET    /trust-score       → TrustScore
POST   /vin               → VinVerification
```

### Search Service `/api/search`
```
GET    /vehicles          → SearchResult (OpenSearch)
GET    /autocomplete      → string[]
GET    /nearby            → Vehicle[]  (geo radius)
POST   /index/:id         → (internal, index vehicle)
```

### Payment Service `/api/payments`
```
POST   /intent            → { client_secret }
POST   /boost             → { session_url }
POST   /subscription      → { session_url }
GET    /history           → Payment[]
POST   /webhook           → (Stripe webhook endpoint)
```

---

## 6. Fraud Detection Heuristics (V1 — No ML Required)

```typescript
interface FraudSignals {
  priceSuspiciouslyLow: boolean;    // > 40% below market
  duplicateVin: boolean;            // VIN used in another listing
  duplicateImages: boolean;         // perceptual hash match
  newAccount: boolean;              // account < 7 days old
  rapidRelisting: boolean;          // same VIN > 2x in 30 days
  scamPhrases: boolean;             // "wire transfer", "overseas military", etc.
  phoneInDescription: boolean;      // phone number in listing text
  suspiciousIpHistory: boolean;     // multiple accounts from same IP
}

function computeFraudScore(signals: FraudSignals): number {
  const weights: Record<keyof FraudSignals, number> = {
    priceSuspiciouslyLow: 30,
    duplicateVin: 40,
    duplicateImages: 35,
    newAccount: 15,
    rapidRelisting: 25,
    scamPhrases: 30,
    phoneInDescription: 10,
    suspiciousIpHistory: 20,
  };
  return Object.entries(signals).reduce(
    (sum, [k, v]) => sum + (v ? weights[k as keyof FraudSignals] : 0), 0
  );
}
// Score > 50 → auto-hold for review
// Score > 80 → auto-suspend
```

---

## 7. CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy Kerodex

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci && npm test

  build-push:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      - uses: aws-actions/amazon-ecr-login@v2
      - name: Build & push
        run: |
          docker build -t kerodex-api .
          docker tag kerodex-api:latest ${{ secrets.ECR_REGISTRY }}/kerodex-api:latest
          docker push ${{ secrets.ECR_REGISTRY }}/kerodex-api:latest

  deploy:
    needs: build-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy-task-definition@v1
        with:
          task-definition: task-definition.json
          service: kerodex-api-service
          cluster: kerodex-cluster
          wait-for-service-stability: true
```

---

## 8. Docker Compose (Local Dev)

```yaml
# docker-compose.yml
version: '3.9'
services:
  api:
    build: ./api
    ports: ["3001:3001"]
    environment:
      DATABASE_URL: postgres://kerodex:kerodex@db:5432/kerodex
      REDIS_URL: redis://redis:6379
      JWT_SECRET: dev-secret-change-in-prod
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
      AWS_REGION: us-east-1
    depends_on: [db, redis]

  web:
    build: ./web
    ports: ["3000:3000"]
    environment:
      VITE_API_URL: http://localhost:3001
    volumes:
      - ./web/src:/app/src

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: kerodex
      POSTGRES_PASSWORD: kerodex
      POSTGRES_DB: kerodex
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports: ["5432:5432"]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  opensearch:
    image: opensearchproject/opensearch:2.12.0
    environment:
      discovery.type: single-node
      plugins.security.disabled: "true"
    ports: ["9200:9200"]

volumes:
  pgdata:
```

---

## 9. AWS Infrastructure (CDK Snippet)

```typescript
// infrastructure/lib/kerodex-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';

export class KerodexStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'KerodexVpc', { maxAzs: 2 });

    // RDS PostgreSQL
    const db = new rds.DatabaseInstance(this, 'KerodexDb', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
      vpc,
      multiAz: true,
      allocatedStorage: 100,
      storageEncrypted: true,
      deletionProtection: true,
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'KerodexCluster', { vpc });

    // Fargate Service (API)
    const taskDef = new ecs.FargateTaskDefinition(this, 'ApiTask', {
      memoryLimitMiB: 2048,
      cpu: 1024,
    });
    taskDef.addContainer('ApiContainer', {
      image: ecs.ContainerImage.fromRegistry('YOUR_ECR_URI'),
      portMappings: [{ containerPort: 3001 }],
      environment: {
        NODE_ENV: 'production',
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'kerodex-api' }),
    });

    new ecs.FargateService(this, 'ApiService', {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 2,
      assignPublicIp: false,
    });
  }
}
```

---

## 10. Scaling Roadmap

### Phase 1 — MVP (0–10k users)
- Blink SDK (current) for rapid prototyping
- SQLite → PostgreSQL migration
- Blink Backend (Hono) for webhooks + Stripe
- Basic fraud heuristics
- Email + phone verification

### Phase 2 — Growth (10k–100k users)
- Migrate to NestJS microservices on ECS Fargate
- OpenSearch for vehicle search
- Redis session caching + listing cache
- Stripe for listing boosts + subscriptions
- Real ID verification (Persona or Stripe Identity)
- S3 + CloudFront for image hosting
- React Native mobile app

### Phase 3 — Scale (100k–1M users)
- Multi-region AWS (us-east + us-west)
- EKS (Kubernetes) for auto-scaling
- Kafka for event streaming
- ML fraud detection model (SageMaker)
- Dealer marketplace tier
- Mobile apps on App Store / Play Store

### Phase 4 — Enterprise (1M+ users)
- Data warehouse (Redshift / Snowflake)
- Real-time ML price recommendations
- AR vehicle preview (ARKit / ARCore)
- Blockchain title verification (optional)
- Logistics / transport integration
- Financing API partnerships

---

## 11. Monetization Model

| Revenue Stream | Description | Est. Take Rate |
|---|---|---|
| Listing Boost | Feature listing at top of search | $9.99–$29.99/week |
| Seller Pro | Priority badge, analytics, CRM | $19.99/month |
| Dealer Tier | Unlimited listings + tools | $149/month |
| Financing Lead | Referral on approved loans | 0.5% of loan value |
| Insurance Lead | Referral on bound policies | $15–$40/lead |
| Transaction Fee (future) | Verified escrow close | 1% (capped $500) |

---

## 12. Security Checklist

- [ ] All routes JWT-authenticated (except public listing browse)
- [ ] Rate limiting: 100 req/min per IP, 1000 req/min per auth user
- [ ] Input sanitization on all user content (DOMPurify client-side)
- [ ] S3 presigned uploads (never expose AWS keys to browser)
- [ ] EXIF stripping on image upload (Lambda or Sharp.js)
- [ ] License plate blurring (OpenCV or AWS Rekognition)
- [ ] Encrypted secrets in AWS Secrets Manager
- [ ] VPC isolation for RDS + Redis (no public exposure)
- [ ] CloudTrail audit logging enabled
- [ ] WAF rules for SQL injection, XSS, DDoS
- [ ] HTTPS everywhere (ACM + CloudFront)
- [ ] MFA support for admin accounts

---

## 13. Mobile App Structure (Expo)

```
mobile/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx         Home / Featured
│   │   ├── search.tsx        Search + Map
│   │   ├── messages.tsx      Inbox
│   │   ├── profile.tsx       Account
│   ├── vehicle/[id].tsx      Listing Detail
│   ├── sell.tsx              Create Listing
│   ├── verify.tsx            Verification
│   └── _layout.tsx
├── components/
│   ├── VehicleCard.tsx
│   ├── MapView.tsx
│   ├── TrustBadges.tsx
│   └── ImageGallery.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useVehicles.ts
│   └── useMessages.ts
├── lib/
│   ├── api.ts                Axios client
│   └── blink.ts              Blink SDK client
└── app.json
```

---

## 14. Environment Variables Reference

```bash
# Shared
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=kerodex-assets
CLOUDFRONT_URL=https://assets.kerodex.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Auth providers
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APPLE_CLIENT_ID=...
APPLE_CLIENT_SECRET=...

# ID Verification
PERSONA_API_KEY=...
STRIPE_IDENTITY_WEBHOOK=...

# Notifications
SENDGRID_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
EXPO_ACCESS_TOKEN=...  # push notifications

# Monitoring
SENTRY_DSN=...
```

---

*Built by Kerodex Engineering — Last updated 2026-05-29*
