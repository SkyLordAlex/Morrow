import { Tabs } from 'expo-router';
import { CalendarDays, Inbox, Target, UserRound } from 'lucide-react-native';
import { colors, fonts } from '@/theme';

// The web app used a fixed sidebar with in-page anchor scrolling
// (Today / This week / Assignments). On iOS those become real tabs — each
// section gets its own scroll position and back stack, which is what users
// expect from a native app and what App Review looks for.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.sansBold,
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size }) => <Target size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="week"
        options={{
          title: 'This week',
          tabBarIcon: ({ color, size }) => (
            <CalendarDays size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: 'Assignments',
          tabBarIcon: ({ color, size }) => <Inbox size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <UserRound size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
