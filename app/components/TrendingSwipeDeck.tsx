import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { FadeInImage } from './FadeInImage';
import { HomeFeedItem } from '../services/feed';
import { theme } from '../theme/theme';

const SWIPE_THRESHOLD = 110;
const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

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

interface TrendingSwipeDeckProps {
  items: HomeFeedItem[];
  savedProductIds: string[];
  onOpenItem: (item: HomeFeedItem) => void;
  onToggleSave: (item: HomeFeedItem) => Promise<void>;
  onSwipeLeft: (item: HomeFeedItem) => Promise<void>;
  onSwipeRight: (item: HomeFeedItem) => Promise<void>;
}

export function TrendingSwipeDeck({
  items,
  savedProductIds,
  onOpenItem,
  onToggleSave,
  onSwipeLeft,
  onSwipeRight,
}: TrendingSwipeDeckProps) {
  const [index, setIndex] = useState(0);
  const [showSavedPulse, setShowSavedPulse] = useState(false);

  const position = useRef(new Animated.ValueXY()).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setIndex(0);
    position.setValue({ x: 0, y: 0 });
    pulse.setValue(0);
  }, [items, position, pulse]);

  useEffect(() => {
    const nextImage = items[index + 1]?.image_url;
    const secondNextImage = items[index + 2]?.image_url;
    if (nextImage) {
      void Image.prefetch(nextImage);
    }
    if (secondNextImage) {
      void Image.prefetch(secondNextImage);
    }
  }, [index, items]);

  const current = items[index];
  const next = items[index + 1];

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ['-10deg', '0deg', '10deg'],
  });

  const cardAnimatedStyle = {
    transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
  };

  const nextCardScale = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: [1, 0.96, 1],
    extrapolate: 'clamp',
  });

  const nextCardStyle = {
    transform: [{ scale: nextCardScale }],
  };

  const pulseStyle = {
    opacity: pulse.interpolate({
      inputRange: [0, 0.15, 0.6, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [
      {
        scale: pulse.interpolate({
          inputRange: [0, 1],
          outputRange: [0.92, 1.02],
        }),
      },
    ],
  };

  const advance = useCallback(async (direction: 'left' | 'right', item: HomeFeedItem, dy: number): Promise<void> => {
    const toX = direction === 'right' ? SCREEN_WIDTH * 1.2 : -SCREEN_WIDTH * 1.2;

    Animated.timing(position, {
      toValue: { x: toX, y: dy },
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      position.setValue({ x: 0, y: 0 });
      setIndex((prev) => prev + 1);
    });

    if (direction === 'right') {
      const wasSaved = savedProductIds.includes(item.id);
      if (!wasSaved) {
        await onToggleSave(item);
      }
      await onSwipeRight(item);
      setShowSavedPulse(true);
      pulse.setValue(0);
      Animated.timing(pulse, {
        toValue: 1,
        duration: 260,
        useNativeDriver: true,
      }).start(() => {
        setShowSavedPulse(false);
      });
    } else {
      await onSwipeLeft(item);
    }
  }, [onSwipeLeft, onSwipeRight, onToggleSave, position, pulse, savedProductIds]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 8 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          position.setValue({ x: gestureState.dx, y: gestureState.dy * 0.2 });
        },
        onPanResponderRelease: (_, gestureState) => {
          if (!current) {
            return;
          }

          if (gestureState.dx > SWIPE_THRESHOLD) {
            void advance('right', current, gestureState.dy * 0.2);
            return;
          }

          if (gestureState.dx < -SWIPE_THRESHOLD) {
            void advance('left', current, gestureState.dy * 0.2);
            return;
          }

          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        },
      }),
    [advance, current, position]
  );

  if (!current) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>No more products</Text>
        <Text style={styles.emptySubtitle}>You have reached the end of this trending stack.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {next ? (
        <Animated.View style={[styles.card, styles.nextCard, nextCardStyle]}>
          <SwipeCardContent item={next} onOpenItem={onOpenItem} />
        </Animated.View>
      ) : null}

      <Animated.View style={[styles.card, cardAnimatedStyle]} {...panResponder.panHandlers}>
        <SwipeCardContent item={current} onOpenItem={onOpenItem} />
      </Animated.View>

      {showSavedPulse ? (
        <Animated.View style={[styles.savedPulse, pulseStyle]}>
          <Text style={styles.savedPulseText}>Saved</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

function SwipeCardContent({ item, onOpenItem }: { item: HomeFeedItem; onOpenItem: (item: HomeFeedItem) => void }) {
  return (
    <Pressable style={styles.cardInner} onPress={() => onOpenItem(item)}>
      <View style={styles.imageWrap}>
        <FadeInImage uri={item.image_url} style={styles.image} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.brandName}>{item.brand_name}</Text>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.price}>{formatPrice(item.price_amount, item.currency_code)}</Text>
      </View>
      <View style={styles.hintRow}>
        <Text style={styles.hint}>Swipe left to skip</Text>
        <Text style={styles.hint}>Swipe right to save</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: theme.spacing.lg,
  },
  card: {
    position: 'absolute',
    width: '100%',
    maxHeight: SCREEN_HEIGHT - 190,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  nextCard: {
    opacity: 0.7,
  },
  cardInner: {
    width: '100%',
  },
  imageWrap: {
    width: '100%',
    height: SCREEN_HEIGHT - 360,
    backgroundColor: theme.colors.surfaceMuted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageFallbackText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
  },
  meta: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  brandName: {
    color: theme.colors.accent,
    fontSize: theme.typography.overline,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.tracking.wide,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  productName: {
    color: theme.colors.text,
    fontSize: theme.typography.heading,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  price: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  hint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.overline,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.tracking.wide,
    fontWeight: '600',
  },
  savedPulse: {
    position: 'absolute',
    top: 32,
    alignSelf: 'center',
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  savedPulseText: {
    color: theme.colors.accent,
    fontSize: theme.typography.overline,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.tracking.wide,
    fontWeight: '700',
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.heading,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
    textAlign: 'center',
  },
});
