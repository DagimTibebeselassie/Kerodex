import React from 'react';
import { Toaster as HotToaster, toast as hotToast } from 'react-hot-toast';

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => {
    const variants = {
      default: 'bg-foreground text-background hover:opacity-90',
      outline: 'border border-border bg-background text-foreground hover:bg-muted',
      ghost: 'bg-transparent text-foreground hover:bg-muted',
      destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
    };
    const sizes = {
      default: 'h-10 px-4',
      sm: 'h-8 px-3',
      lg: 'h-11 px-6',
      icon: 'h-10 w-10 p-0',
    };
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full border border-input bg-background px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

type SelectProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
};

export function Select({ value, onValueChange, children, className }: SelectProps) {
  const options: React.ReactElement[] = [];
  let triggerClass = '';

  function collect(nodes: React.ReactNode) {
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child)) return;
      if (child.type === SelectTrigger) {
        triggerClass = (child.props as any).className || '';
      }
      if (child.type === SelectItem) {
        options.push(child);
        return;
      }
      collect((child.props as any).children);
    });
  }

  collect(children);

  return (
    <select
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
      className={cn(
        'h-10 w-full border border-border bg-background px-3 text-[13px] text-foreground outline-none focus:border-foreground',
        triggerClass,
        className
      )}
    >
      {options}
    </select>
  );
}

export function SelectTrigger({ children }: React.HTMLAttributes<HTMLButtonElement>) {
  return <>{children}</>;
}

export function SelectContent({ children }: React.HTMLAttributes<HTMLDivElement>) {
  return <>{children}</>;
}

export function SelectValue() {
  return null;
}

export function SelectItem({ value, children }: React.OptionHTMLAttributes<HTMLOptionElement>) {
  return <option value={value}>{children}</option>;
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium', className)}
      {...props}
    />
  );
}

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return <hr className={cn('border-0 border-t border-border', className)} {...props} />;
}

export function KerodexUIProvider({ children }: { children?: React.ReactNode; theme?: string }) {
  return <>{children}</>;
}

function ToastBody({ message, kind }: { message: string; kind: 'success' | 'error' | 'loading' | 'blank' | 'custom' }) {
  const accent = kind === 'error' ? 'bg-destructive' : kind === 'success' ? 'bg-emerald-500' : 'bg-foreground';
  return (
    <div className="relative overflow-hidden border border-border bg-background text-foreground px-4 py-3 shadow-lg min-w-[260px] max-w-sm">
      <p className="text-[13px] font-medium pr-1">{message}</p>
      <div className="absolute bottom-0 left-0 h-[2px] w-full bg-muted">
        <div className={cn('h-full kerodex-toast-progress', accent)} />
      </div>
    </div>
  );
}

export function Toaster({ position = 'top-right' }: { position?: 'top-right' | 'top-center' | 'bottom-right' }) {
  return (
    <HotToaster
      position={position}
      toastOptions={{ duration: 3000 }}
      gutter={10}
    >
      {(item) => (
        <ToastBody
          message={String(item.message || '')}
          kind={item.type}
        />
      )}
    </HotToaster>
  );
}

export const toast = {
  success: (message: string, options?: any) => hotToast.success(message, { duration: 3000, ...options }),
  error: (message: string, options?: any) => hotToast.error(message, { duration: options?.duration ?? 4200, ...options }),
  loading: (message: string, options?: any) => hotToast.loading(message, options),
  dismiss: (id?: string) => hotToast.dismiss(id),
};

export function Dialog({ open, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; children?: React.ReactNode }) {
  return open ? <>{children}</> : null;
}

export function DialogContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div className={cn('bg-background border border-border shadow-2xl', className)} {...props}>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('font-bold tracking-tight', className)} {...props} />;
}

export function StatGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className} {...props} />;
}

export function Stat({ label, value, icon, className }: { label: string; value: string; icon?: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4 text-muted-foreground">
        <span className="text-[11px] font-bold uppercase tracking-widest">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-black tracking-tight">{value}</div>
    </div>
  );
}

export function DataTable({ data, columns, className }: { data: any[]; columns: any[]; className?: string }) {
  return (
    <div className={cn('overflow-x-auto border border-border', className)}>
      <table className="w-full text-left">
        <thead className="bg-muted/60">
          <tr>
            {columns.map((column) => (
              <th key={column.accessorKey || column.header} className="px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={row.id || rowIndex} className="border-t border-border">
              {columns.map((column) => (
                <td key={column.accessorKey || column.header} className="px-4 py-3">
                  {column.cell
                    ? column.cell({ row: { original: row } })
                    : String(row[column.accessorKey] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, description, icon, action, className }: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6', className)}>
      {icon && <div className="mb-4">{icon}</div>}
      <h3 className="text-[15px] font-bold mb-1">{title}</h3>
      {description && <p className="text-[13px] text-muted-foreground mb-5 max-w-sm">{description}</p>}
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}
