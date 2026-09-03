import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '@/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View style={styles.container}>
        <Text style={styles.title}>That page wandered off.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back to today</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  title: { fontFamily: fonts.serifSemi, fontSize: 26, color: colors.foreground },
  link: { paddingVertical: spacing.md },
  linkText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.primary },
});
