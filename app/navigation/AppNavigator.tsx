import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DrawerContentScrollView, DrawerItem, createDrawerNavigator } from '@react-navigation/drawer';
import { DrawerActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

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
  MainApp: undefined;
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

type AppDrawerParamList = {
  MainTabs: undefined;
  History: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const Drawer = createDrawerNavigator<AppDrawerParamList>();

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
        headerLeft: () => (
          <Text
            style={styles.menuButton}
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            Menu
          </Text>
        ),
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

function AppDrawerContent(props: any) {
  const { signOut } = useAuth();
  const activeRouteName = props.state?.routeNames?.[props.state?.index] ?? 'MainTabs';

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      <DrawerItem
        label="History"
        focused={activeRouteName === 'History'}
        onPress={() => props.navigation.navigate('History')}
        labelStyle={styles.drawerItemLabel}
      />
      <View style={styles.drawerDivider} />
      <DrawerItem
        label="Sign Out"
        onPress={() => {
          void signOut();
        }}
        labelStyle={styles.drawerSignOutLabel}
      />
    </DrawerContentScrollView>
  );
}

function AppDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <AppDrawerContent {...props} />}
      screenOptions={{
        drawerActiveTintColor: theme.colors.primary,
        drawerInactiveTintColor: theme.colors.text,
        drawerLabelStyle: {
          fontSize: theme.typography.body,
        },
      }}
    >
      <Drawer.Screen
        name="MainTabs"
        component={MainTabsNavigator}
        options={{ title: 'Discovery', headerShown: false }}
      />
      <Drawer.Screen
        name="History"
        component={PurchaseHistoryScreen}
        options={({ navigation }) => ({
          title: 'History',
          headerTitleAlign: 'center',
          headerLeft: () => (
            <Text
              style={styles.menuButton}
              onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
            >
              Menu
            </Text>
          ),
        })}
      />
    </Drawer.Navigator>
  );
}

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="MainApp"
      screenOptions={{
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen name="MainApp" component={AppDrawerNavigator} options={{ headerShown: false }} />

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
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  drawerContent: {
    flex: 1,
    paddingTop: theme.spacing.md,
  },
  drawerDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  drawerSignOutLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  drawerItemLabel: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
});
