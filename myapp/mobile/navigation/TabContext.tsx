import { createContext, useContext } from 'react';

// -----------------------------------------------------------------------------
// Types (defined here to avoid require cycles: screens import TabContext, not TabNavigator)
// -----------------------------------------------------------------------------

export type TabId = 'Home' | 'Explore' | 'Shop' | 'Cart' | 'Profile';

export type MarketDetailParams = {
  marketId: string;
  name: string;
  location: string;
  rating: number;
  description: string;
};

export type ShopDetailParams = { shopId: string };

export type CategoryShopsParams = { categoryId: string; categoryLabel: string };

export type TabContextValue = {
  switchToTab: (t: TabId) => void;
  openMarketDetail: (p: MarketDetailParams) => void;
  openShopDetail: (p: ShopDetailParams) => void;
  openCategoryShops: (p: CategoryShopsParams) => void;
  openConversations: () => void;
  openSearchResults: (query?: string) => void;
  goBack: () => void;
};

// -----------------------------------------------------------------------------
// Context & hook
// -----------------------------------------------------------------------------

const TabNavigatorContext = createContext<TabContextValue | null>(null);

export function useTabNavigator(): TabContextValue {
  const ctx = useContext(TabNavigatorContext);
  return (
    ctx ?? {
      switchToTab: () => {},
      openMarketDetail: () => {},
      openShopDetail: () => {},
      openCategoryShops: () => {},
      openConversations: () => {},
      openSearchResults: () => {},
      goBack: () => {},
    }
  );
}

export { TabNavigatorContext };
