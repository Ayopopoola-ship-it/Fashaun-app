import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AuthSignInScreen } from '../screens/AuthSignInScreen';

export type AuthStackParamList = {
  SignIn: undefined;
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
    </Stack.Navigator>
  );
}
