import { translate, useLang } from '@/lib/i18n';
import { Logo } from "@/components/site/Logo";

const columns: { title: string; links: string[] }[] = [
  { title: "Product", links: ["How it works", "Question Bank", "Wisen AI", "Features"] },
  { title: "Resources", links: ["FAQ", "Help", "Contact"] },
  { title: "Company", links: ["About", "Founder"] },
  { title: "Legal", links: ["Privacy Policy", "Terms of Service"] },
];

export function Footer() {
  useLang();
  return (
    <footer className="relative z-10 border-t border-border bg-background px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 border-b border-border pb-14 md:grid-cols-[1.5fr_repeat(4,1fr)]">
          <div>
            <Logo className="h-11 w-auto" />
            <p className="mt-5 max-w-xs font-display text-2xl leading-tight">
               {translate("Study smarter.")} <br />
               {translate("Remember longer.")} </p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.15em]">{translate(column.title)}</h2>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {column.links.map((link) => (
                  <li key={link}>
                    <a href="#top" className="transition-colors hover:text-primary">
                      {translate(link)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="pt-7 text-xs text-muted-foreground">{translate("© 2026 Wisen. Built for medical students.")}</p>
      </div>
    </footer>
  );
}
