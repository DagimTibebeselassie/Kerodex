import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';

interface StubPageProps {
  title: string;
  description?: string;
}

export function StubPage({ title, description }: StubPageProps) {
  return (
    <div className="px-6 py-20 max-w-screen-md mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors mb-12"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to home
      </Link>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground mb-3">
        Coming Soon
      </p>
      <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-4">{title}</h1>
      <p className="text-[14px] text-muted-foreground leading-relaxed max-w-md">
        {description ?? 'This page is under construction. Check back soon.'}
      </p>
    </div>
  );
}
