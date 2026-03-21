import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../providers/AuthProvider';
import { isAdminUser } from '../services/adminAccess';
import { AdminBrandReviewDetailScreen } from '../screens/AdminBrandReviewDetailScreen';
import { AdminReviewScreen } from '../screens/AdminReviewScreen';
import { BrandPageScreen } from '../screens/BrandPageScreen';
import { BrandRequestDetailsScreen } from '../screens/BrandRequestDetailsScreen';
import { BrandRequestsScreen } from '../screens/BrandRequestsScreen';
import { BrandSelectionScreen } from '../screens/BrandSelectionScreen';
import { BuyWebViewScreen } from '../screens/BuyWebViewScreen';
import { CartScreen } from '../screens/CartScreen';
import { HomeFeedScreen } from '../screens/HomeFeedScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PriceDropScreen } from '../screens/PriceDropScreen';
import { ProductDetailsScreen } from '../screens/ProductDetailsScreen';
import { PurchaseHistoryScreen } from '../screens/PurchaseHistoryScreen';
import { SavedScreen } from '../screens/SavedScreen';
import { TrendingScreen } from '../screens/TrendingScreen';
import { theme } from '../theme/theme';

export type RootStackParamList = {
  MainTabs: undefined;
  SideMenu: undefined;
  History: undefined;
  RequestBrands: undefined;
  Leaderboard: undefined;
  BrandRequestDetails: { requestId: string };
  AdminReview: undefined;
  AdminBrandReviewDetail: { brandId: string };
  Onboarding: undefined;
  HomeFeed: undefined;
  BrandSelection: undefined;
  BrandPage: { brandId: string };
  ProductDetails: { productId: string };
  BuyWebView: { productUrl: string };
  PurchaseHistory: undefined;
};

export type MainTabParamList = {
  Discovery: undefined;
  Trending: undefined;
  PriceDrop: undefined;
  Saved: undefined;
  Cart: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function HeaderMenuButton({ navigation }: { navigation: any }) {
  return (
    <Pressable style={styles.menuButtonWrap} onPress={() => navigation.navigate('SideMenu')}>
      <Text style={styles.menuButton}>Menu</Text>
    </Pressable>
  );
}

function MainTabsNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Discovery"
      screenOptions={({ navigation, route }) => ({
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerShadowVisible: false,
        headerLeft: () => <HeaderMenuButton navigation={navigation} />,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: keyof typeof Feather.glyphMap = 'circle';

          if (route.name === 'Discovery') {
            iconName = 'compass';
          } else if (route.name === 'Trending') {
            iconName = 'trending-up';
          } else if (route.name === 'PriceDrop') {
            iconName = 'tag';
          } else if (route.name === 'Saved') {
            iconName = 'heart';
          } else if (route.name === 'Cart') {
            iconName = 'shopping-bag';
          }

          return <Feather name={iconName} size={focused ? size + 1 : size} color={color} />;
        },
        tabBarStyle: {
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.overline,
          fontWeight: '600',
        },
      })}
    >
      <Tab.Screen name="Discovery" component={HomeFeedScreen} options={{ title: 'Discovery' }} />
      <Tab.Screen name="Trending" component={TrendingScreen} options={{ title: 'Trending' }} />
      <Tab.Screen name="PriceDrop" component={PriceDropScreen} options={{ title: 'Price Drop' }} />
      <Tab.Screen
        name="Saved"
        component={SavedScreen}
        options={{ title: 'Saved' }}
      />
      <Tab.Screen name="Cart" component={CartScreen} options={{ title: 'Cart' }} />
    </Tab.Navigator>
  );
}

function SideMenuScreen({ navigation }: { navigation: any }) {
  const { signOut, user } = useAuth();
  const isAdmin = isAdminUser(user?.email);

  return (
    <View style={styles.sideMenuContainer}>
      <Pressable
        style={styles.sideMenuItem}
        onPress={() => {
          navigation.goBack();
          navigation.navigate('RequestBrands');
        }}
      >
        <Text style={styles.sideMenuItemText}>Request Brand</Text>
      </Pressable>
      <Pressable
        style={styles.sideMenuItem}
        onPress={() => {
          navigation.goBack();
          navigation.navigate('Leaderboard');
        }}
      >
        <Text style={styles.sideMenuItemText}>Leaderboard</Text>
      </Pressable>
      {isAdmin ? (
        <Pressable
          style={styles.sideMenuItem}
          onPress={() => {
            navigation.goBack();
            navigation.navigate('AdminReview');
          }}
        >
          <Text style={styles.sideMenuItemText}>Admin Review</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={styles.sideMenuItem}
        onPress={() => {
          navigation.goBack();
          navigation.navigate('MainTabs', { screen: 'Discovery' });
        }}
      >
        <Text style={styles.sideMenuItemText}>Home</Text>
      </Pressable>
      <Pressable
        style={styles.sideMenuItem}
        onPress={() => {
          navigation.goBack();
          navigation.navigate('History');
        }}
      >
        <Text style={styles.sideMenuItemText}>History</Text>
      </Pressable>
      <Pressable
        style={styles.sideMenuItem}
        onPress={() => {
          navigation.goBack();
          void signOut();
        }}
      >
        <Text style={styles.sideMenuItemText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabsNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="SideMenu" component={SideMenuScreen} options={{ title: 'Menu' }} />
      <Stack.Screen
        name="History"
        component={PurchaseHistoryScreen}
        options={({ navigation }) => ({
          title: 'History',
          headerLeft: () => <HeaderMenuButton navigation={navigation} />,
        })}
      />
      <Stack.Screen name="RequestBrands" component={BrandRequestsScreen} options={{ title: 'Request Brand' }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
      <Stack.Screen name="BrandRequestDetails" component={BrandRequestDetailsScreen} options={{ title: 'Brand Request' }} />
      <Stack.Screen name="AdminReview" component={AdminReviewScreen} options={{ title: 'Admin Review' }} />
      <Stack.Screen name="AdminBrandReviewDetail" component={AdminBrandReviewDetailScreen} options={{ title: 'Review Brand' }} />

      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Welcome' }} />
      <Stack.Screen name="HomeFeed" component={HomeFeedScreen} options={{ title: 'Discovery' }} />
      <Stack.Screen name="BrandSelection" component={BrandSelectionScreen} options={{ title: 'Brands' }} />
      <Stack.Screen name="BrandPage" component={BrandPageScreen} options={{ title: 'Brand' }} />
      <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} options={{ title: 'Product Details' }} />
      <Stack.Screen name="BuyWebView" component={BuyWebViewScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="PurchaseHistory"
        component={PurchaseHistoryScreen}
        options={{ title: 'Purchase History' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    color: theme.colors.primary,
    fontSize: theme.typography.caption,
    fontWeight: '700',
  },
  menuButtonWrap: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  sideMenuContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  sideMenuItem: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    minHeight: theme.button.height,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  sideMenuItemText: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
});
