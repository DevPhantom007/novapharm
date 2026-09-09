
import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ShoppingCart,
  Heart,
  Menu,
  X,
  Store as StoreIcon,
  HeartPulse,
  Trash2,
  Globe,
  Phone,
  Mail,
  MapPin,
} from "lucide-react";
import { Button } from "../components/ui/button.jsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.jsx";
import { useLanguage } from "../contexts/LanguageContext.jsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog.jsx";
import { useCart } from "../contexts/CartContext.jsx";
import { useFavorites } from "../contexts/FavoritesContext.jsx";
import {
  STORES,
  formatPrice,
  CONTACT_PHONE,
  HOTLINE_PHONE,
} from "../data/store.js";
import { productName, useProductsQuery } from "../data/useProducts.js";
import NovaLogo from "./NovaLogo.jsx";

function Wordmark({ footer = false, dark = false }) {
  return (
    <span
      className={`font-display text-lg sm:text-2xl font-semibold tracking-tight leading-none whitespace-nowrap ${footer ? "text-2xl font-bold" : ""}`}
    >
      <span
        className={`${footer || dark ? "text-emerald-200" : "text-primary"} italic`}
      >
        NOVA
      </span>
      <span className="text-carrot not-italic">PHARM</span>
    </span>
  );
}

function LanguageSwitcher({ dark = false, compact = false }) {
  const { lang, setLang, langs } = useLanguage();
  const current = langs.find((l) => l.code === lang) || langs[0];

  if (compact) {
    return (
      <div className="flex gap-1.5">
        {langs.map((l) => (
          <button
            key={l.code}
            onClick={() => setLang(l.code)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              l.code === lang
                ? "bg-emerald-500 text-white"
                : dark
                  ? "text-white/70 hover:text-emerald-300 hover:bg-white/10"
                  : "text-foreground/60 hover:text-foreground hover:bg-secondary"
            }`}
          >
            {l.short}
          </button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={
            dark
              ? "rounded-full h-9 px-3 gap-1.5 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-emerald-300 shrink-0"
              : "rounded-full h-9 px-3 gap-1.5 border-primary/30 shrink-0"
          }
        >
          <Globe
            className={
              dark ? "w-4 h-4 text-emerald-300" : "w-4 h-4 text-primary"
            }
          />
          <span className="text-xs font-semibold">{current.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={
          dark
            ? "rounded-xl bg-[oklch(0.25_0.04_165)] text-white border-white/10"
            : "rounded-xl"
        }
      >
        {langs.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className={
              dark
                ? `gap-2 text-white/90 hover:!bg-emerald-500/30 hover:!text-emerald-200 focus:!bg-emerald-500/30 focus:!text-emerald-200 [&:hover]:!bg-emerald-500/30 [&:hover]:!text-emerald-200 ${l.code === lang ? "!bg-emerald-500/40 !text-emerald-200 font-semibold" : ""}`
                : `gap-2 ${l.code === lang ? "bg-secondary font-semibold" : ""}`
            }
          >
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function SiteLayout({ children }) {
  const [location] = useLocation();
  const { total, count, enriched, updateQty } = useCart();
  const { lang, t } = useLanguage();
  const { products } = useProductsQuery();
  const { favorites, removeFavorite } = useFavorites();
  const favoriteProducts = products.filter(product => favorites.includes(String(product.id)));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [favoritesOpen, setFavoritesOpen] = useState(false);

  const NAV = [
    { href: "/", label: t("nav.home") },
    { href: "/menu", label: t("nav.menu") },
    { href: "/promotions", label: t("nav.promotions") },
    { href: "/stores", label: t("nav.stores") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[linear-gradient(180deg,oklch(0.99_0.008_165),white_28%,oklch(0.985_0.012_75))]">
      <header className="sticky top-0 z-50 bg-[linear-gradient(120deg,oklch(0.4_0.09_165),oklch(0.32_0.08_165)_55%,oklch(0.4_0.09_165))] shadow-[0_10px_30px_-18px_rgba(10,50,36,0.6)]">
        <div className="container flex min-h-16 items-center justify-between gap-2 py-2 sm:min-h-[4.6rem]">
          <Link
            href="/"
            className="group flex min-w-0 shrink-0 items-center gap-2 sm:gap-3"
          >
            <NovaLogo className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 drop-shadow-sm transition-transform duration-300 group-hover:rotate-[-4deg] group-hover:scale-105" />
            <span><Wordmark dark /></span>
          </Link>

          <div className="hidden min-w-0 flex-1 justify-center lg:flex">
            <nav className="flex min-w-0 items-center gap-1">
              {NAV.map((item) => {
                const active = location === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
                      active
                        ? "bg-white/18 text-emerald-200 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25)]"
                        : "text-white/90 hover:-translate-y-0.5 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <LanguageSwitcher dark />
            <Dialog open={favoritesOpen} onOpenChange={setFavoritesOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t("favorites.title")}
                  title={t("favorites.title")}
                  className="relative h-10 w-10 shrink-0 rounded-full border-white/25 bg-white/10 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white hover:bg-white hover:text-primary hover:shadow-[0_10px_20px_-12px_rgba(0,0,0,0.4)] [&_svg]:text-emerald-200 [&:hover_svg]:text-primary"
                >
                  <Heart className="h-4 w-4" />
                  {favorites.length > 0 && (
                    <span
                      aria-label={`${favorites.length} ${t("favorites.title")}`}
                      className="absolute -right-1 -top-1 min-w-5 h-5 rounded-full bg-carrot px-1 text-center text-[11px] font-extrabold leading-5 text-white shadow-sm"
                    >
                      {favorites.length}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(92vw,32rem)] max-h-[85vh] overflow-hidden rounded-2xl p-0">
                <DialogHeader className="border-b px-5 pb-3 pt-5">
                  <DialogTitle className="font-display text-lg">{t("favorites.title")}</DialogTitle>
                </DialogHeader>
                <div className="max-h-[65vh] overflow-y-auto px-5 py-4">
                  {favoriteProducts.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12 text-center text-muted-foreground">
                      <div className="grid h-16 w-16 place-items-center rounded-full bg-carrot/10">
                        <Heart className="h-8 w-8 text-carrot" />
                      </div>
                      <p className="font-semibold text-foreground">{t("favorites.emptyTitle")}</p>
                      <p className="max-w-xs text-sm">{t("favorites.emptyDesc")}</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {favoriteProducts.map(product => (
                        <div key={product.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-white p-3">
                          <Link href={`/product/${product.id}`} onClick={() => setFavoritesOpen(false)} className="flex min-w-0 flex-1 items-center gap-3">
                            <img src={product.image} alt={productName(product, lang)} className="h-14 w-14 shrink-0 rounded-xl border border-border/60 bg-muted/30 object-contain p-1.5" />
                            <span className="min-w-0">
                              <span className="block line-clamp-2 text-sm font-bold text-foreground">{productName(product, lang)}</span>
                              <span className="mt-1 block text-sm font-extrabold tabular-nums text-primary">{formatPrice(product.price)}</span>
                            </span>
                          </Link>
                          <Button type="button" variant="ghost" size="icon" aria-label={t("favorites.remove")} title={t("favorites.remove")} onClick={() => removeFavorite(product.id)} className="h-9 w-9 shrink-0 text-carrot hover:bg-carrot/10 hover:text-carrot">
                            <Heart className="h-4 w-4 fill-current" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={cartOpen} onOpenChange={setCartOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  aria-label={t("cart.title")}
                  className="relative h-10 w-10 shrink-0 justify-center rounded-full border-white/25 bg-white/10 p-0 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-white hover:bg-white hover:text-primary hover:shadow-[0_10px_20px_-12px_rgba(0,0,0,0.4)] [&_svg]:text-emerald-200 [&:hover_svg]:text-primary"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {count > 0 && (
                    <span
                      aria-label={`${count} ${t("cart.title")}`}
                      className="absolute -right-1 -top-1 min-w-5 h-5 rounded-full bg-carrot px-1 text-center text-[11px] font-extrabold leading-5 text-white shadow-sm"
                    >
                      {count}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(92vw,32rem)] max-h-[85vh] flex flex-col p-0 overflow-hidden top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 data-[state=open]:zoom-in-90 data-[state=open]:animate-in duration-200 rounded-2xl">
                <DialogHeader className="px-5 pt-5 pb-3 border-b">
                  <DialogTitle className="font-display text-lg">
                    {t("cart.title")}
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-5 py-3">
                  {enriched.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center gap-4 text-muted-foreground py-10">
                      <div className="w-20 h-20 rounded-full bg-[oklch(0.95_0.03_165)] flex items-center justify-center">
                        <ShoppingCart className="w-10 h-10 text-primary/60" />
                      </div>
                      <div>
                        <p className="text-base font-semibold text-foreground">
                          {t("cart.emptyTitle")}
                        </p>
                        <p className="text-sm mt-1">{t("cart.emptyDesc")}</p>
                      </div>
                      <Link href="/menu" onClick={() => setCartOpen(false)}>
                        <Button className="rounded-full h-12 px-8 text-base font-semibold gap-2 mt-1 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                          <ShoppingCart className="w-5 h-5" />{" "}
                          {t("cart.goToMenu")}
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {enriched.map((item) => (
                        <div
                          key={item.productId}
                          className="flex gap-4 rounded-xl border p-4"
                        >
                          <img
                            src={item.product.image}
                            alt={productName(item.product, lang)}
                            className="w-20 h-20 rounded-lg object-contain shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-base font-semibold truncate">
                                {productName(item.product, lang)}
                              </p>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                                onClick={() => updateQty(item.productId, 0)}
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between mt-3 w-full">
                              <div className="flex items-center gap-2 border rounded-full px-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 rounded-full"
                                  onClick={() =>
                                    updateQty(item.productId, item.qty - 1)
                                  }
                                >
                                  −
                                </Button>
                                <span className="text-base font-semibold w-8 text-center tabular-nums">
                                  {item.qty}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 rounded-full"
                                  onClick={() =>
                                    updateQty(item.productId, item.qty + 1)
                                  }
                                >
                                  +
                                </Button>
                              </div>
                              <span className="text-base font-bold tabular-nums">
                                {formatPrice(item.subtotal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {enriched.length > 0 && (
                  <div className="border-t px-5 py-4 space-y-3">
                    <div className="flex justify-between text-base">
                      <span className="text-muted-foreground">
                        {t("cart.subtotal")}
                      </span>
                      <span className="font-bold tabular-nums">
                        {formatPrice(total)}
                      </span>
                    </div>
                    <Link href="/checkout" onClick={() => setCartOpen(false)}>
                      <Button className="w-full rounded-full h-11">
                        {t("cart.checkout")}
                      </Button>
                    </Link>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white hover:bg-white/10 hover:text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-white/15 bg-[oklch(0.32_0.08_165)] animate-in slide-in-from-top duration-200">
            <nav className="container py-3 flex flex-col gap-1.5">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`px-4 py-3 rounded-2xl text-base font-bold transition-all duration-200 ${
                    location === item.href
                      ? "bg-white/18 text-emerald-200"
                      : "text-white/90 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="relative overflow-hidden bg-[linear-gradient(135deg,oklch(0.22_0.045_165),oklch(0.16_0.03_165))] text-white pt-16 pb-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-carrot/10 blur-3xl" />
        <div className="container">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <NovaLogo className="w-10 h-10 shrink-0" />
                <Wordmark footer />
              </div>
              <p className="text-sm text-white/60 leading-relaxed max-w-xs">
                {t("footer.desc")}
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-lg">{t("footer.links")}</h4>
              <nav className="flex flex-col gap-2 text-sm text-white/60">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="hover:text-emerald-300 transition-colors"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-lg">{t("footer.contact")}</h4>
              <div className="space-y-3 text-sm text-white/60">
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-emerald-300" />
                  <a
                    href={`tel:${CONTACT_PHONE}`}
                    className="hover:text-white transition-colors"
                  >
                    {CONTACT_PHONE}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-emerald-300" />
                  <a
                    href={`tel:${HOTLINE_PHONE}`}
                    className="flex items-baseline gap-2 hover:text-white transition-colors"
                  >
                    <span className="font-semibold text-white/90">
                      {t("footer.hotline")}
                    </span>
                    <span>{HOTLINE_PHONE}</span>
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-emerald-300" />
                  <span>{t("footer.address")}</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-lg">{t("footer.hours")}</h4>
              <p className="text-sm text-white/60 leading-relaxed">
                {t("hero.hours")}
              </p>
              <div className="pt-2">
                <LanguageSwitcher dark compact />
              </div>
            </div>
          </div>

          <div className="mb-8 border-t border-white/10 pt-7">
            <h4 className="font-bold text-sm text-white/90">
              {t("footer.legal")}
            </h4>
            <nav className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/60">
              <Link
                href="/legal/privacy"
                className="hover:text-emerald-300 transition-colors"
              >
                {t("footer.privacy")}
              </Link>
              <Link
                href="/legal/terms"
                className="hover:text-emerald-300 transition-colors"
              >
                {t("footer.terms")}
              </Link>
              <Link
                href="/legal/delivery"
                className="hover:text-emerald-300 transition-colors"
              >
                {t("footer.delivery")}
              </Link>
              <Link
                href="/legal/company"
                className="hover:text-emerald-300 transition-colors"
              >
                {t("footer.company")}
              </Link>
            </nav>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-center items-center gap-4 text-xs text-white/40">
            <p>© 2026 NOVAPHARM. {t("footer.rights")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
