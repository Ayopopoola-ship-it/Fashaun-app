import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppButton } from '../components/AppButton';
import { HeartButton } from '../components/HeartButton';
import { LoadingState } from '../components/LoadingState';
import { ScreenContainer } from '../components/ScreenContainer';
import { SectionLabel } from '../components/SectionLabel';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../providers/AuthProvider';
import { addToCart, fetchCartProductIds } from '../services/cart';
import { trackProductEvent } from '../services/interactions';
import { fetchProductDetailsById, ProductDetailsItem } from '../services/products';
import { isProductSaved, saveProduct, unsaveProduct } from '../services/saves';
import { theme } from '../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductDetails'>;

function formatPrice(amount: number | null, currencyCode: string): string {
  if (amount === null) {
    return 'Price unavailable';
  }

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}

export function ProductDetailsScreen({ route, navigation }: Props) {
  const { productId } = route.params;
  const { user } = useAuth();

  const [product, setProduct] = useState<ProductDetailsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingLink, setOpeningLink] = useState(false);
  const [saved, setSaved] = useState(false);
  const [inCart, setInCart] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const loadProduct = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const details = await fetchProductDetailsById(productId);
      setProduct(details);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load product details');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    if (!user || !product) {
      return;
    }

    void trackProductEvent({
      event: 'product_view',
      userId: user.id,
      brandId: product.brand_id,
      productId: product.id,
      metadata: {
        screen: 'product_details',
      },
      dedupeKey: `product_view:${user.id}:${product.id}`,
    });
  }, [product, user]);

  useEffect(() => {
    if (!user || !product) {
      setSaved(false);
      setInCart(false);
      return;
    }

    let active = true;

    void (async () => {
      try {
        const currentSaved = await isProductSaved({
          userId: user.id,
          productId: product.id,
        });

        if (active) {
          setSaved(currentSaved);
        }
      } catch {
        if (active) {
          setSaved(false);
        }
      }
    })();

    void (async () => {
      try {
        const cartIds = await fetchCartProductIds(user.id);
        if (active) {
          setInCart(cartIds.includes(product.id));
        }
      } catch {
        if (active) {
          setInCart(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [product, user]);

  const imageUrls = useMemo(() => product?.image_urls ?? [], [product?.image_urls]);

  async function onBuyPress(): Promise<void> {
    if (!product?.product_url) {
      return;
    }

    setOpeningLink(true);

    try {
      if (user) {
        try {
          await trackProductEvent({
            event: 'buy_click',
            userId: user.id,
            brandId: product.brand_id,
            productId: product.id,
            metadata: {
              screen: 'product_details',
            },
          });
        } catch {
          // Non-blocking analytics event for MVP.
        }
      }

      navigation.navigate('BuyWebView', {
        productUrl: product.product_url,
      });
    } catch {
      setError('Unable to open brand site link.');
    } finally {
      setOpeningLink(false);
    }
  }

  async function onSavePress(): Promise<void> {
    if (!user || !product) {
      return;
    }

    try {
      if (saved) {
        await unsaveProduct({
          userId: user.id,
          productId: product.id,
        });
        setSaved(false);
      } else {
        await saveProduct({
          userId: user.id,
          brandId: product.brand_id,
          productId: product.id,
        });
        setSaved(true);
      }
    } catch {
      setError(saved ? 'Unable to unsave product right now.' : 'Unable to save product right now.');
    }
  }

  async function onAddToCartPress(): Promise<void> {
    if (!user || !product || inCart) {
      return;
    }

    setAddingToCart(true);

    try {
      await addToCart(user.id, {
        productId: product.id,
        brandId: product.brand_id,
        brandName: product.brand_name,
        productName: product.name,
        productImageUrl: product.image_urls?.[0] ?? null,
        productUrl: product.product_url,
        priceAmount: product.price_amount,
        currencyCode: product.currency_code,
      });
      setInCart(true);
      Alert.alert('Added to Cart', `${product.name} has been added to your cart.`);
    } catch {
      setError('Unable to add this item to cart right now.');
    } finally {
      setAddingToCart(false);
    }
  }

  return (
    <ScreenContainer>
      {loading ? (
        <LoadingState label="Loading product" />
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => void loadProduct()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : product ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {imageUrls.length > 0 ? (
            <FlatList
              horizontal
              data={imageUrls}
              keyExtractor={(item, index) => `${item}-${index}`}
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => <Image source={{ uri: item }} style={styles.galleryImage} />}
              style={styles.gallery}
            />
          ) : (
            <View style={styles.galleryFallback}>
              <Text style={styles.galleryFallbackText}>No image available</Text>
            </View>
          )}

          <SectionLabel>{product.brand_name}</SectionLabel>
          <View style={styles.productNameRow}>
            <Text style={styles.productName}>{product.name}</Text>
            <HeartButton active={saved} onPress={() => void onSavePress()} />
          </View>
          <Text style={styles.priceText}>{formatPrice(product.price_amount, product.currency_code)}</Text>

          {product.sizes.length > 0 ? (
            <View style={styles.section}>
            <SectionLabel>Available Sizes</SectionLabel>
              <View style={styles.sizeWrap}>
                {product.sizes.map((size) => (
                  <View key={size} style={styles.sizeChip}>
                    <Text style={styles.sizeChipText}>{size}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {product.description ? (
            <View style={styles.section}>
              <SectionLabel>Description</SectionLabel>
              <Text style={styles.descriptionText}>{product.description}</Text>
            </View>
          ) : null}

          <View style={styles.ctaWrap}>
            <AppButton
              label={inCart ? 'In Cart' : 'Add to Cart'}
              onPress={() => void onAddToCartPress()}
              loading={addingToCart}
              disabled={inCart}
              variant={inCart ? 'secondary' : 'primary'}
            />
          </View>
          <View style={styles.ctaWrap}>
            <AppButton
              label="Buy on Brand Site"
              onPress={() => void onBuyPress()}
              disabled={!product.product_url}
              loading={openingLink}
              variant="secondary"
            />
          </View>
        </ScrollView>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: theme.typography.body,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  retryButtonText: {
    color: theme.colors.surface,
    fontWeight: '700',
    fontSize: theme.typography.caption,
  },
  content: {
    paddingBottom: theme.spacing.xl,
  },
  gallery: {
    marginBottom: theme.spacing.md,
  },
  galleryImage: {
    width: 320,
    height: 360,
    borderRadius: theme.radius.lg,
    marginRight: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  galleryFallback: {
    height: 280,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  galleryFallbackText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
  },
  productName: {
    color: theme.colors.text,
    fontSize: theme.typography.heading,
    fontWeight: '700',
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  productNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  priceText: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
    marginBottom: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.md,
  },
  sizeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  sizeChip: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
  },
  sizeChipText: {
    color: theme.colors.text,
    fontSize: theme.typography.caption,
    fontWeight: '600',
  },
  descriptionText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  ctaWrap: {
    marginTop: theme.spacing.sm,
  },
});
