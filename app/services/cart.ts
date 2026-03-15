import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabaseClient';

const CART_KEY_PREFIX = '@fashaun:cart:';

export interface CartItemSnapshot {
  productId: string;
  brandId: string;
  brandName: string;
  productName: string;
  productImageUrl: string | null;
  productUrl: string | null;
  priceAmount: number | null;
  currencyCode: string;
  addedAt: string;
}

export interface CartItem extends CartItemSnapshot {
  livePriceAmount: number | null;
  liveCurrencyCode: string;
  hasPriceDrop: boolean;
  priceDropAmount: number | null;
}

function getCartStorageKey(userId: string): string {
  return `${CART_KEY_PREFIX}${userId}`;
}

async function readCartSnapshots(userId: string): Promise<CartItemSnapshot[]> {
  const raw = await AsyncStorage.getItem(getCartStorageKey(userId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as CartItemSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeCartSnapshots(userId: string, items: CartItemSnapshot[]): Promise<void> {
  await AsyncStorage.setItem(getCartStorageKey(userId), JSON.stringify(items));
}

export async function fetchCartSnapshots(userId: string): Promise<CartItemSnapshot[]> {
  const snapshots = await readCartSnapshots(userId);
  return snapshots.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
}

export async function addToCart(userId: string, item: Omit<CartItemSnapshot, 'addedAt'>): Promise<void> {
  const current = await readCartSnapshots(userId);
  const withoutProduct = current.filter((cartItem) => cartItem.productId !== item.productId);

  const next: CartItemSnapshot = {
    ...item,
    addedAt: new Date().toISOString(),
  };

  await writeCartSnapshots(userId, [next, ...withoutProduct]);
}

export async function removeFromCart(userId: string, productId: string): Promise<void> {
  const current = await readCartSnapshots(userId);
  const filtered = current.filter((item) => item.productId !== productId);
  await writeCartSnapshots(userId, filtered);
}

export async function fetchCartProductIds(userId: string): Promise<string[]> {
  const current = await readCartSnapshots(userId);
  return current.map((item) => item.productId);
}

export async function fetchCartItems(userId: string): Promise<CartItem[]> {
  const snapshots = await fetchCartSnapshots(userId);
  if (snapshots.length === 0) {
    return [];
  }

  const productIds = snapshots.map((item) => item.productId);

  const { data, error } = await supabase
    .from('products')
    .select('id, name, image_urls, product_url, price_amount, currency_code')
    .in('id', productIds);

  if (error) {
    throw new Error(`Failed to load cart products: ${error.message}`);
  }

  const liveById = new Map(
    (data ?? []).map((row) => [row.id as string, row])
  );

  return snapshots.map((snapshot) => {
    const live = liveById.get(snapshot.productId);
    const livePriceAmount = (live?.price_amount as number | null | undefined) ?? snapshot.priceAmount;
    const liveCurrencyCode =
      (live?.currency_code as string | null | undefined) ?? snapshot.currencyCode;

    const livePriceDrop =
      snapshot.priceAmount !== null &&
      livePriceAmount !== null &&
      livePriceAmount < snapshot.priceAmount
        ? Math.round((snapshot.priceAmount - livePriceAmount) * 100) / 100
        : null;

    return {
      ...snapshot,
      productName: (live?.name as string | undefined) ?? snapshot.productName,
      productImageUrl: (live?.image_urls as string[] | undefined)?.[0] ?? snapshot.productImageUrl,
      productUrl: (live?.product_url as string | null | undefined) ?? snapshot.productUrl,
      livePriceAmount,
      liveCurrencyCode,
      hasPriceDrop: livePriceDrop !== null,
      priceDropAmount: livePriceDrop,
    } as CartItem;
  });
}
