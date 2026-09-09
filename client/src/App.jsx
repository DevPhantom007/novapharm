import React, { lazy, Suspense, useEffect } from "react";
import { Toaster } from "./components/ui/sonner.jsx";
import { TooltipProvider } from "./components/ui/tooltip.jsx";
import { Route, Switch, useLocation } from "wouter";
import { Component } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "./lib/utils.js";
import { CartProvider } from "./contexts/CartContext.jsx";
import { FavoritesProvider } from "./contexts/FavoritesContext.jsx";
import { LanguageProvider } from "./contexts/LanguageContext.jsx";
import SiteLayout from "./components/SiteLayout.jsx";

import Home from "./pages/Home.jsx";
import Menu from "./pages/Menu.jsx";
import Promotions from "./pages/Promotions.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Legal from "./pages/Legal.jsx";
import Checkout from "./pages/Checkout.jsx";
import OrderStatus from "./pages/OrderStatus.jsx";
import Stores from "./pages/Stores.jsx";
const Backoffice = lazy(() => import("./pages/Backoffice.jsx"));
const AdminPanel = lazy(() => import("./pages/AdminPanel.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));

const SITE_URL = "https://novapharm.am";
const PAGE_METADATA = {
  "/": {
    title: "Nova Pharm — Դեղատուն Գյումրիում",
    description:
      "Nova Pharm՝ Գյումրիի 7 դեղատները մեկ կայքում։ Դեղեր, վիտամիններ և խնամքի միջոցներ՝ առցանց պատվերով։",
  },
  "/menu": {
    title: "Դեղեր և վիտամիններ — Nova Pharm",
    description:
      "Ընտրեք Nova Pharm-ի դեղերը, վիտամինները, աքսեսուարները և հարդեղագործական միջոցները։",
  },
  "/promotions": {
    title: "Ակցիաներ և զեղչեր — Nova Pharm",
    description: "Nova Pharm-ի ընթացիկ ակցիաներն ու զեղչված ապրանքները։",
  },
  "/product": {
    title: "Ապրանք — Nova Pharm",
    description:
      "Դիտեք Nova Pharm-ի ապրանքի տվյալները և նույն բաժնի այլ ապրանքները։",
  },
  "/stores": {
    title: "Nova Pharm-ի դեղատները Գյումրիում",
    description:
      "Գտեք Nova Pharm-ի 7 դեղատների հասցեները, աշխատանքային ժամերը և 2GIS ուղղությունները Գյումրիում։",
  },
};

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
            />
            <h2 className="text-xl mb-4">An unexpected error occurred.</h2>
            <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
              <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                {this.state.error?.stack}
              </pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer",
              )}
            >
              <RotateCcw size={16} />
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function setHeadMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([name, value]) =>
      element.setAttribute(name, value),
    );
    document.head.appendChild(element);
  }
  return element;
}

function usePageMetadata(location) {
  useEffect(() => {
    const cleanPath = location.split("?")[0] || "/";
    const metadata = cleanPath.startsWith("/product/")
      ? PAGE_METADATA["/product"]
      : PAGE_METADATA[cleanPath] || PAGE_METADATA["/"];
    const privateRoute =
      /^(\/admin|\/backoffice|\/checkout|\/order(?:\/|$))/.test(cleanPath);
    const canonicalHref = `${SITE_URL}${cleanPath === "/" ? "/" : cleanPath}`;
    const robotsContent = privateRoute
      ? "noindex, nofollow"
      : "index, follow, max-image-preview:large";

    document.title = metadata.title;
    setHeadMeta('meta[name="description"]', {
      name: "description",
    }).setAttribute("content", metadata.description);
    setHeadMeta('meta[name="robots"]', { name: "robots" }).setAttribute(
      "content",
      robotsContent,
    );

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalHref);
  }, [location]);
}

function Router() {
  const [location] = useLocation();
  usePageMetadata(location);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center text-sm text-muted-foreground">
          Բեռնվում է…
        </div>
      }
    >
      <Switch>
        <Route path="/">
          <SiteLayout>
            <Home />
          </SiteLayout>
        </Route>
        <Route path="/menu">
          <SiteLayout>
            <Menu />
          </SiteLayout>
        </Route>
        <Route path="/promotions">
          <SiteLayout>
            <Promotions />
          </SiteLayout>
        </Route>
        <Route path="/product/:id">
          <SiteLayout>
            <ProductDetail />
          </SiteLayout>
        </Route>
        <Route path="/legal/:page">
          <SiteLayout>
            <Legal />
          </SiteLayout>
        </Route>
        <Route path="/checkout">
          <SiteLayout>
            <Checkout />
          </SiteLayout>
        </Route>
        <Route path="/order/:id">
          <SiteLayout>
            <OrderStatus />
          </SiteLayout>
        </Route>
        <Route path="/stores">
          <SiteLayout>
            <Stores />
          </SiteLayout>
        </Route>
        <Route path="/backoffice" component={Backoffice} />
        <Route path="/admin" component={AdminPanel} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Toaster position="top-center" richColors />
        <CartProvider>
          <LanguageProvider>
            <FavoritesProvider>
              <Router />
            </FavoritesProvider>
          </LanguageProvider>
        </CartProvider>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
