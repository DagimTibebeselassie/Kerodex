import { Link } from '@tanstack/react-router';
import { Shield, MessageSquare, MapPin, FileText, Flag, AlertTriangle } from 'lucide-react';

const safetySections = [
  {
    icon: <MessageSquare className="h-4 w-4" />,
    title: 'Messaging safety',
    body: 'Keep conversations inside Kerodex. Do not send deposits or payments before seeing the vehicle and documents in person.'
  },
  {
    icon: <MapPin className="h-4 w-4" />,
    title: 'Meetup guidance',
    body: 'Meet in a public, well-lit place, during daylight when possible, and bring another person if you can.'
  },
  {
    icon: <FileText className="h-4 w-4" />,
    title: 'Document checks',
    body: 'Verify the title, VIN, seller identity, vehicle condition, and maintenance records before completing a purchase.'
  },
  {
    icon: <Flag className="h-4 w-4" />,
    title: 'Report concerns',
    body: 'Report suspicious listings, copied photos, payment pressure, VIN mismatches, harassment, or unsafe behavior.'
  }
];

export function SafetyCenterPage() {
  return (
    <div className="animate-fade-in px-4 md:px-6 py-12 max-w-4xl mx-auto">
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-5">
          <Shield className="h-4 w-4" />
          Kerodex Safety Center
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Buy and sell with clearer guardrails.</h1>
        <p className="text-[14px] text-muted-foreground leading-relaxed max-w-2xl">
          Kerodex uses verification tools and automated checks to reduce fake listings and suspicious activity. These tools do not guarantee that a seller owns a vehicle, that a vehicle is problem-free, or that a transaction is safe. Buyers and sellers are responsible for verifying documents, inspecting vehicles, and using safe judgment before completing a transaction.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-px border border-border bg-border mb-10">
        {safetySections.map((section) => (
          <section key={section.title} className="bg-background p-6">
            <div className="flex items-center gap-2 text-foreground mb-3">
              {section.icon}
              <h2 className="text-[13px] font-bold uppercase tracking-widest">{section.title}</h2>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="border border-border bg-muted/30 p-5 flex gap-3">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-[13px] font-bold mb-2">When something feels off</h2>
          <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
            Stop the conversation, do not send money, and report the user or listing so Kerodex can review it.
          </p>
          <Link to="/search" className="text-[12px] font-bold uppercase tracking-widest underline underline-offset-4">
            Browse listings
          </Link>
        </div>
      </div>
    </div>
  );
}
