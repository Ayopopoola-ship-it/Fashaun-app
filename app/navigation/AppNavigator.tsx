import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BrandSelectionScreen } from '../screens/BrandSelectionScreen';
import { HomeFeedScreen } from '../screens/HomeFeedScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { ProductDetailsScreen } from '../screens/ProductDetailsScreen';
import { PurchaseHistoryScreen } from '../screens/PurchaseHistoryScreen';

export type RootStackParamList = {
  Onboarding: undefined;
  HomeFeed: undefined;
  BrandSelection: undefined;
  ProductDetails: undefined;
  PurchaseHistory: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Onboarding"
      screenOptions={{
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ title: 'Welcome' }} />
      <Stack.Screen name="HomeFeed" component={HomeFeedScreen} options={{ title: 'Home Feed' }} />
      <Stack.Screen name="BrandSelection" component={BrandSelectionScreen} options={{ title: 'Brands' }} />
      <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} options={{ title: 'Product Details' }} />
      <Stack.Screen
        name="PurchaseHistory"
        component={PurchaseHistoryScreen}
        options={{ title: 'Purchase History' }}
      />
    </Stack.Navigator>
  );
}
