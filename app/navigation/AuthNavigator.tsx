import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthSignInScreen } from '../screens/AuthSignInScreen';
import { BrandRequestDetailsScreen } from '../screens/BrandRequestDetailsScreen';

export type AuthStackParamList = {
  SignIn: undefined;
  BrandRequestDetails: { requestId: string };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="SignIn"
      screenOptions={{
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen name="SignIn" component={AuthSignInScreen} options={{ title: 'Welcome' }} />
      <Stack.Screen name="BrandRequestDetails" component={BrandRequestDetailsScreen} options={{ title: 'Brand Request' }} />
    </Stack.Navigator>
  );
}
