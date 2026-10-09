import {
  Apple,
  Bookmark,
  CalendarDays,
  CookingPot,
  Ellipsis,
  History,
  Languages,
  LogOut,
  ScanBarcode,
  Search,
  Target,
  UserRound,
} from "lucide-react";
import type { PrimaryNavigationId } from "@/components/layout/primary-navigation";

// Presentation stays separate from the server-safe route metadata.
const navigationIcons = {
  today: CalendarDays,
  foodSearch: Search,
  barcodeLookup: ScanBarcode,
  reusableFoods: History,
  myFoods: Apple,
  savedMeals: Bookmark,
  recipes: CookingPot,
  profileTargets: Target,
  account: UserRound,
  more: Ellipsis,
  language: Languages,
  signOut: LogOut,
};

export function NavigationIcon({
  id,
}: {
  id: PrimaryNavigationId | "more" | "language" | "signOut";
}) {
  const Icon = navigationIcons[id];
  return <Icon aria-hidden="true" className="navigation-icon" focusable="false" size={20} strokeWidth={1.8} />;
}
