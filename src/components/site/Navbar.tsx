import { ArrowRight, Menu, Moon, Sun } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/site/Logo";
import { useTheme } from "@/components/site/theme";
import { Button } from "@/components/ui/button";
import { LangSwitch, useLang, translate } from "@/lib/i18n";

const links = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "Wisen AI", href: "#wisen-ai" },
];

export function Navbar() {
  const { dark, toggle } = useTheme();
  const { t } = useLang();
  const translate = t;
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#top" aria-label={translate("Wisen home")} className="shrink-0">
          <Logo />
        </a>

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {t(link.label)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitch />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={dark ? translate("Switch to light mode") : translate("Switch to dark mode")}
            className="rounded-full border border-border bg-background/70 shadow-sm"
          >
            {dark ? <Sun /> : <Moon />}
          </Button>
          <Button asChild variant="ghost" className="hidden h-10 px-4 sm:inline-flex">
            <a href="/login">{t("Log in")}</a>
          </Button>
          <Button asChild className="hidden h-10 rounded-md px-5 shadow-lg shadow-primary/15 sm:inline-flex">
            <a href="/register">
              {t("Get started")} <ArrowRight />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full border border-border md:hidden"
            aria-label={translate("Open menu")}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <Menu />
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-3 text-sm">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(link.label)}
              </a>
            ))}
            <a href="/login" onClick={() => setOpen(false)} className="py-1">
              {t("Log in")}
            </a>
            <Button asChild className="mt-2 h-11 w-full rounded-md">
              <a href="/register" onClick={() => setOpen(false)}>
                {t("Get started")} <ArrowRight />
              </a>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
}
