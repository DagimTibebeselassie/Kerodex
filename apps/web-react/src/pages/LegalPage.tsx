import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

const updated = 'June 18, 2026';
const contactEmail = 'founder@kerodexofficial.com';

const termsSections = [
  {
    title: '1. Introduction',
    body: [
      'Kerodex is an online marketplace that allows users to create vehicle listings, communicate with other users, and facilitate private-party vehicle transactions.',
      'Kerodex does not buy, sell, own, inspect, broker, finance, or guarantee any vehicle listed on the platform. By accessing or using Kerodex, you agree to these Terms of Service.',
    ],
  },
  {
    title: '2. Eligibility',
    body: [
      'You must be at least 18 years old to use Kerodex. By creating an account, you represent that your information is accurate, that you have authority to list any vehicle you post, and that you will comply with applicable laws.',
    ],
  },
  {
    title: '3. User Accounts',
    body: [
      'You are responsible for maintaining account security, protecting your password, and all activity conducted under your account. Kerodex may suspend or terminate accounts that violate these Terms.',
    ],
  },
  {
    title: '4. Vehicle Listings',
    body: [
      'Sellers are solely responsible for the accuracy of vehicle descriptions, mileage, condition, maintenance records, ownership claims, pricing, images, and documents.',
      'By creating a listing, you certify that the information provided is accurate to the best of your knowledge.',
    ],
  },
  {
    title: '5. Verification Disclaimer',
    body: [
      'Kerodex may provide optional verification features including email verification, phone verification, VIN verification, identity verification, and documentation review.',
      'Verification does not guarantee ownership, vehicle condition, vehicle history, listing accuracy, or user trustworthiness. Users remain responsible for their own due diligence.',
    ],
  },
  {
    title: '6. Marketplace Disclaimer',
    body: [
      'Kerodex acts solely as a technology platform. Kerodex is not a vehicle dealer, broker, escrow service, inspection company, financing provider, or party to transactions between users.',
    ],
  },
  {
    title: '7. Buyer Responsibilities',
    body: [
      'Buyers are responsible for inspecting vehicles, verifying ownership, reviewing maintenance records, obtaining vehicle history reports, confirming title status, and confirming vehicle condition before completing any transaction.',
    ],
  },
  {
    title: '8. Seller Responsibilities',
    body: [
      'Sellers agree not to post misleading information, misrepresent vehicle condition, misrepresent ownership, upload fraudulent documents, advertise stolen vehicles, or violate applicable laws.',
    ],
  },
  {
    title: '9. Prohibited Activities',
    body: [
      'Users may not commit fraud, impersonate others, use stolen identities, upload malicious software, scrape platform data, interfere with platform operations, harass users, circumvent platform fees, or violate laws.',
    ],
  },
  {
    title: '10. User Content',
    body: [
      'Users retain ownership of content they upload. By uploading content, you grant Kerodex a non-exclusive, worldwide license to display, store, reproduce, and distribute that content to operate and promote the platform.',
    ],
  },
  {
    title: '11. No Warranty',
    body: [
      'The platform is provided as is and as available. Kerodex makes no warranties regarding vehicle condition, ownership, legality, safety, user identity, user conduct, or listing accuracy.',
    ],
  },
  {
    title: '12. Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, Kerodex shall not be liable for fraud, misrepresentation, vehicle defects, vehicle theft, personal injury, property damage, financial losses, or disputes between users resulting from use of the platform.',
    ],
  },
  {
    title: '13. Indemnification',
    body: [
      'You agree to defend and indemnify Kerodex against claims arising from your use of the platform, your listings, your transactions, your violation of these Terms, or your violation of any law.',
    ],
  },
  {
    title: '14. Account Suspension',
    body: [
      'Kerodex may suspend, restrict, or terminate any account at any time for violations of these Terms or conduct that may harm users or the platform.',
    ],
  },
  {
    title: '15. Changes to These Terms',
    body: [
      'Kerodex may modify these Terms at any time. Continued use of the platform after changes constitutes acceptance of the revised Terms.',
    ],
  },
  {
    title: '16. Governing Law',
    body: [
      'These Terms are governed by the laws of the State of Georgia, United States. Disputes shall be resolved in courts located in Georgia unless otherwise required by law.',
    ],
  },
];

const privacySections = [
  {
    title: '1. Information We Collect',
    body: [
      'Kerodex may collect account information such as name, email address, phone status, authentication provider, and account activity.',
      'Kerodex may also collect listing information, vehicle details, VIN data, uploaded images, maintenance records, messages, verification submissions, device information, IP address, and usage activity.',
    ],
  },
  {
    title: '2. How We Use Information',
    body: [
      'We use information to operate the marketplace, create and display listings, support messaging, verify accounts and listings, prevent fraud, improve safety, provide customer support, and improve Kerodex.',
    ],
  },
  {
    title: '3. Verification Providers',
    body: [
      "Kerodex uses Persona to provide identity verification services. Information submitted for identity verification may be processed by Persona in accordance with Persona's privacy policy, security practices, and applicable legal requirements.",
      'Kerodex may also use third-party providers for vehicle, VIN, ownership, fraud, and other trust-and-safety checks. Those providers may process information according to their own policies and applicable legal requirements.',
    ],
  },
  {
    title: '4. Uploaded Documents',
    body: [
      'Seller-uploaded documents and verification materials are intended for private review and trust workflows. Kerodex does not intend to publicly display private identity documents, title documents, or sensitive verification files.',
    ],
  },
  {
    title: '5. Messages',
    body: [
      'Kerodex may store messages between users so conversations can work across devices and so the platform can investigate fraud, safety concerns, or policy violations.',
    ],
  },
  {
    title: '6. Sharing Information',
    body: [
      'We may share information with service providers that help us operate Kerodex, including hosting, email, analytics, storage, verification, security, and database providers.',
      'We may also disclose information when required by law, to protect users, to prevent fraud, or to enforce our Terms.',
    ],
  },
  {
    title: '7. Data Security',
    body: [
      'We use reasonable safeguards to protect information. No system is perfectly secure, and users should avoid sharing unnecessary sensitive information in listings or messages.',
    ],
  },
  {
    title: '8. Data Retention',
    body: [
      'We retain information for as long as needed to operate Kerodex, support users, maintain safety and audit records, comply with legal obligations, and resolve disputes.',
    ],
  },
  {
    title: '9. Your Choices',
    body: [
      'You may update account details, remove saved vehicles, edit your listings, or request account assistance by contacting Kerodex.',
    ],
  },
  {
    title: '10. Contact',
    body: [
      `Questions about this Privacy Policy can be sent to ${contactEmail}.`,
    ],
  },
];

function LegalShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="px-4 md:px-6 py-14 max-w-4xl mx-auto">
      <div className="mb-10">
        <Link to="/" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
          Kerodex
        </Link>
        <h1 className="mt-6 text-3xl md:text-5xl font-black tracking-tight">{title}</h1>
        <p className="mt-4 text-[13px] md:text-[15px] text-muted-foreground leading-relaxed max-w-2xl">{intro}</p>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Last Updated: {updated}</p>
      </div>
      <div className="space-y-8">{children}</div>
      <div className="mt-12 pt-8 border-t border-border text-[12px] text-muted-foreground">
        Contact: <a href={`mailto:${contactEmail}`} className="text-foreground underline underline-offset-2">{contactEmail}</a>
      </div>
    </div>
  );
}

function LegalSection({ title, body }: { title: string; body: string[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[13px] font-black uppercase tracking-[0.15em]">{title}</h2>
      {body.map((text) => (
        <p key={text} className="text-[13px] md:text-[14px] text-muted-foreground leading-relaxed">{text}</p>
      ))}
    </section>
  );
}

export function TermsPage() {
  return (
    <LegalShell
      title="Terms of Service"
      intro="These terms explain the rules for using Kerodex as a private-party vehicle marketplace."
    >
      {termsSections.map((section) => <LegalSection key={section.title} {...section} />)}
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell
      title="Privacy Policy"
      intro="This policy explains what Kerodex collects, how it is used, and how marketplace trust and safety workflows handle data."
    >
      {privacySections.map((section) => <LegalSection key={section.title} {...section} />)}
    </LegalShell>
  );
}
