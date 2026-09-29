import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthContext';

export default function Index() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Redirect href="/auth" />;
  }
  return <Redirect href="/(tabs)" />;
}
