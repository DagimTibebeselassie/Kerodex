const focusItems = [
  'Private-party listings only',
  'Clear vehicle information',
  'Location-based search',
  'Buyer and seller messaging',
  'Saved vehicles',
  'Seller tools',
  'Vehicle verification features',
  'Safety notices',
  'Scam and suspicious-message detection',
  'Reporting tools',
  'A cleaner experience than traditional listing sites',
];

export function AboutPage() {
  return (
    <div className="animate-fade-in px-4 md:px-6 py-14 max-w-5xl mx-auto">
      <section className="max-w-3xl mb-16">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-5">About Kerodex</p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-[0.96] mb-6">
          A better private-party car marketplace.
        </h1>
        <p className="text-[15px] md:text-[17px] text-muted-foreground leading-relaxed">
          Kerodex was created to solve a problem that almost every used car buyer and seller runs into: the private car market is valuable, but it is messy, unorganized, and hard to trust.
        </p>
      </section>

      <div className="grid lg:grid-cols-[1fr_0.82fr] gap-14">
        <article className="space-y-10 text-[14px] text-muted-foreground leading-relaxed">
          <section className="space-y-4">
            <p>
              When someone sells a car to a dealership or trades it in, they often receive far less than what the car is actually worth. That same car may later be listed by the dealer for thousands of dollars more. On the other side, buyers looking for affordable used cars are often forced to deal with dealer markups, extra fees, pressure tactics, and listings that do not always reflect the true cost of the vehicle.
            </p>
            <p className="text-foreground text-xl md:text-2xl font-bold leading-snug">
              Sellers should be able to earn more, and buyers should be able to pay less.
            </p>
            <p>
              Kerodex is a private-party car marketplace designed to connect real vehicle owners directly with real buyers. Instead of building another marketplace crowded with dealership inventory, Kerodex focuses on owner-to-buyer listings, transparent communication, and tools that make private car sales easier to navigate.
            </p>
            <p>
              Our goal is not just to list cars. Our goal is to make private-party car buying feel safer, more organized, and more trustworthy.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Why Kerodex Exists</h2>
            <p>
              The traditional used car market leaves a large gap between trade-in values and dealer retail prices. Sellers often accept lower offers because selling privately can feel inconvenient, risky, or overwhelming. Buyers often pay more because finding trustworthy private listings can be time-consuming and uncertain.
            </p>
            <p>
              Kerodex exists to close that gap. By giving private sellers a better place to list their vehicles and giving buyers a better way to find them, Kerodex helps both sides benefit from a more direct transaction.
            </p>
            <p>
              For sellers, that means a better chance of earning more than a trade-in offer. For buyers, that means access to private-party vehicles without unnecessary dealer markups.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Our Mission</h2>
            <p>
              Kerodex’s mission is to make private car sales more accessible, transparent, and fair.
            </p>
            <p>
              We believe private sellers should not have to lose thousands of dollars just because selling on their own feels difficult. We also believe buyers should have better access to vehicles being sold directly by owners, without having to sort through endless dealership listings and inflated prices.
            </p>
            <p>
              Kerodex is here to make the private-party market easier for normal people to use.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Our Vision</h2>
            <p>
              Our long-term vision is to become the trusted place for private car transactions.
            </p>
            <p>
              We want Kerodex to be more than a website where people post cars. We want it to become a platform that helps people understand pricing, verify listings, communicate safely, and complete private car sales with more confidence.
            </p>
            <p>
              The used car market does not need another dealer-heavy marketplace. It needs a better private-party marketplace. That is what Kerodex is building.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Our Promise</h2>
            <p>
              Kerodex is still growing, but our direction is clear. We are building for real buyers and real sellers. We are focused on transparency, practical tools, and a better experience for people who want to buy or sell a car without going through a dealership.
            </p>
            <p className="text-foreground text-xl font-black">More for sellers. Less for buyers.</p>
          </section>
        </article>

        <aside className="space-y-5">
          <div className="border border-border p-6 bg-background sticky top-24">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.18em] mb-5">What We’re Building</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed mb-6">
              Kerodex is being built as a modern marketplace for private car sales. Trust is one of the biggest challenges in private car sales, so safety and transparency are part of the product from the beginning.
            </p>
            <div className="grid gap-px bg-border border border-border">
              {focusItems.map((item) => (
                <div key={item} className="bg-background px-4 py-3 text-[12px] font-medium">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
