import { Link } from '@tanstack/react-router';
import { BasicButton as Button } from '@/components/BasicButton';
import { ArrowLeft, Search } from 'lucide-react';

export function NotFoundPage() {
  return (
    <main className="min-h-[calc(100vh-56px)] bg-background">
      <section className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-muted-foreground">404</p>
        <h1 className="mt-5 max-w-2xl text-4xl font-semibold tracking-tight md:text-6xl">
          This road does not go anywhere.
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">
          The page you entered is not available on Kerodex. You can go back home, browse cars, or search for the vehicle you had in mind.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link to="/">
            <Button className="h-11 gap-2 px-6 text-[12px] font-bold uppercase tracking-widest">
              <ArrowLeft className="h-4 w-4" /> Back Home
            </Button>
          </Link>
          <Link to="/cars">
            <Button variant="outline" className="h-11 gap-2 px-6 text-[12px] font-bold uppercase tracking-widest">
              <Search className="h-4 w-4" /> Browse Cars
            </Button>
          </Link>
        </div>
        <div className="mt-14 h-px w-24 bg-border" />
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Kerodex private-party marketplace
        </p>
      </section>
    </main>
  );
}
