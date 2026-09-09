import { Heart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button.jsx";
import { useFavorites } from "../contexts/FavoritesContext.jsx";
import { useLanguage } from "../contexts/LanguageContext.jsx";

export default function FavoriteButton({ product, size = "default", className = "" }) {
  const { t } = useLanguage();
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(product.id);

  const handleToggle = event => {
    event.preventDefault();
    event.stopPropagation();
    toggleFavorite(product.id);
    toast.success(
      active
        ? `${t("favorites.removed")}: ${t("favorites.title")}`
        : `${t("favorites.saved")}: ${t("favorites.title")}`,
    );
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={size === "small" ? "icon" : "default"}
      aria-pressed={active}
      aria-label={active ? t("favorites.remove") : t("favorites.add")}
      title={active ? t("favorites.remove") : t("favorites.add")}
      onClick={handleToggle}
      className={`rounded-xl border-white/80 bg-white/95 text-primary shadow-md backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-carrot/50 hover:bg-carrot/10 hover:text-carrot active:scale-95 ${active ? "border-carrot/50 bg-carrot/10 text-carrot" : ""} ${size === "small" ? "h-10 w-10" : "h-11 gap-2 px-3"} ${className}`}
    >
      <Heart className={`h-4 w-4 ${active ? "fill-current" : ""}`} strokeWidth={2.1} />
      {size !== "small" && <span className="hidden text-xs font-bold sm:inline">{active ? t("favorites.savedShort") : t("favorites.addShort")}</span>}
    </Button>
  );
}
