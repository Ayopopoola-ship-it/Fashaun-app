import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../providers/AuthProvider';
import { BrandPageScreen } from '../screens/BrandPageScreen';
import { BrandSelectionScreen } from '../screens/BrandSelectionScreen';
import { BuyWebViewScreen } from '../screens/BuyWebViewScreen';
import { CartScreen } from '../screens/CartScreen';
import { HomeFeedScreen } from '../screens/HomeFeedScreen';
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
      screenOptions={({ navigation }) => ({
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerShadowVisible: false,
        headerLeft: () => <HeaderMenuButton navigation={navigation} />,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
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
  const { signOut } = useAuth();

  return (
    <View style={styles.sideMenuContainer}>
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
