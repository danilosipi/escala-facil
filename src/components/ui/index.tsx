import Link from "next/link";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Início" },
  { href: "/funcionarios", label: "Funcionários" },
  { href: "/turnos", label: "Turnos" },
  { href: "/configuracoes", label: "Configurações" },
  { href: "/escala", label: "Escala" },
];

export function Navbar({ currentPath }: { currentPath?: string }) {
  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="text-xl font-bold text-slate-900">
            Escala Fácil
          </Link>
          <p className="text-sm text-slate-500">Gestão de escala de funcionários</p>
        </div>
        <nav className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                currentPath === link.href
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function PageContainer({
  children,
  title,
  description,
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <main className="mx-auto max-w-7xl flex-1 px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-slate-600">{description}</p>}
      </div>
      {children}
    </main>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-6 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
}) {
  const variants = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  return (
    <button
      className={cn(
        "rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200",
        className
      )}
      {...props}
    />
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-slate-700">
      {children}
    </label>
  );
}

export function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const variants = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
  };

  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", variants[variant])}>
      {children}
    </span>
  );
}

export function Alert({
  children,
  variant = "info",
}: {
  children: React.ReactNode;
  variant?: "info" | "warning" | "danger" | "success";
}) {
  const variants = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
    success: "border-green-200 bg-green-50 text-green-800",
  };

  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", variants[variant])}>{children}</div>
  );
}
