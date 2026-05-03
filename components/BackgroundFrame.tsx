import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { getStaticBackgroundForScreen } from '@/constants/backgroundImages';

export type BackgroundFrameProps = {
  screen?: string;
  mode?: string;
  /** When set, skips registry lookup. */
  source?: ImageSourcePropType;
  overlayOpacity?: number;
  /** Dark = multiply black; light = wash white (calm name step). Ignored when overlayColor is set. */
  overlayTint?: 'dark' | 'light';
  /** When set, used as the full scrim color (takes precedence over overlayTint + overlayOpacity). */
  overlayColor?: string;
  /** Optional hint for parent layouts (foreground palette); not applied to children here. */
  contentTone?: 'light' | 'dark';
  children: React.ReactNode;
};

/**
 * Static full-screen background + overlay for onboarding (no rotation).
 */
export default function BackgroundFrame({
  screen,
  mode,
  source,
  overlayOpacity = 0.4,
  overlayTint = 'dark',
  overlayColor: overlayColorProp,
  children,
}: BackgroundFrameProps) {
  const img = source ?? getStaticBackgroundForScreen(screen, mode);
  const overlayColor =
    overlayColorProp ??
    (overlayTint === 'light'
      ? `rgba(255,255,255,${overlayOpacity})`
      : `rgba(0,0,0,${overlayOpacity})`);

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Image source={img} style={styles.image} resizeMode="cover" />
        <View style={[styles.overlay, { backgroundColor: overlayColor }]} pointerEvents="none" />
      </View>
      <View style={styles.foreground} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  foreground: {
    flex: 1,
  },
});
