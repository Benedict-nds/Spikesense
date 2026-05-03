import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { getBackgroundsForMode, getDashboardBackgroundKeys } from '@/constants/backgroundImages';

const CROSSFADE_MS = 1200;

export type BackgroundSlideshowProps = {
  mode?: string;
  screen?: string;
  images?: ImageSourcePropType[];
  rotate?: boolean;
  intervalMs?: number;
  /** Used with overlayVariant when overlayColor is not set. */
  overlayOpacity?: number;
  /** Solid overlay color wins over overlayVariant + overlayOpacity. */
  overlayColor?: string;
  overlayVariant?: 'dark' | 'light' | 'auto';
  blurRadius?: number;
  children?: React.ReactNode;
};

function overlayFromVariant(
  variant: 'dark' | 'light' | 'auto',
  opacity: number
): string {
  if (variant === 'light') return `rgba(255,255,255,${opacity})`;
  return `rgba(0,0,0,${opacity})`;
}

function logSuspiciousBackground(screen?: string, mode?: string, keys: string[]) {
  if (!__DEV__) return;
  const sheetName = ['w', 'e', 'r', 't', 'z', '1'].join('');
  const hay = `${screen ?? ''} ${mode ?? ''} ${keys.join(' ')}`.toLowerCase();
  if (
    hay.includes(sheetName) ||
    hay.includes('cluster') ||
    hay.includes('sheet') ||
    hay.includes('full_sheet') ||
    hay.includes('2x5')
  ) {
    console.warn('[FRONTEND][BACKGROUND_WARNING_FULL_SHEET]', { screen, mode, imageKey: keys[0] ?? null });
  }
}

export default function BackgroundSlideshow({
  mode,
  screen,
  images: imagesProp,
  rotate = true,
  intervalMs = 12000,
  overlayOpacity = 0.45,
  overlayColor: overlayColorProp,
  overlayVariant = 'auto',
  blurRadius = 0,
  children,
}: BackgroundSlideshowProps) {
  const resolved = useMemo(() => {
    const raw = imagesProp?.length ? imagesProp : getBackgroundsForMode(mode, screen);
    return raw.length ? raw : [];
  }, [imagesProp, mode, screen]);

  const overlayBackgroundColor = useMemo(() => {
    if (overlayColorProp) return overlayColorProp;
    const v = overlayVariant === 'auto' ? 'dark' : overlayVariant;
    return overlayFromVariant(v, overlayOpacity);
  }, [overlayColorProp, overlayVariant, overlayOpacity]);

  const n = resolved.length;
  const [bottomIdx, setBottomIdx] = useState(0);
  const [topIdx, setTopIdx] = useState(0);
  const cross = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animatingRef = useRef(false);
  const topIdxRef = useRef(0);
  const nRef = useRef(0);

  useEffect(() => {
    nRef.current = n;
    const t1 = n > 1 ? 1 % n : 0;
    topIdxRef.current = t1;
    setBottomIdx(0);
    setTopIdx(t1);
    cross.setValue(0);
  }, [resolved, n, cross]);

  useEffect(() => {
    if (!__DEV__) return;
    const keys = getDashboardBackgroundKeys(screen);
    console.log('[FRONTEND][BACKGROUND_SELECTED]', {
      screen: screen ?? null,
      mode: mode ?? null,
      keys,
      rotate,
    });
    logSuspiciousBackground(screen, mode, keys);
  }, [mode, screen, rotate]);

  useEffect(() => {
    if (!rotate || n <= 1) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const runFade = () => {
      if (animatingRef.current) return;
      animatingRef.current = true;
      cross.setValue(0);
      Animated.timing(cross, {
        toValue: 1,
        duration: CROSSFADE_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        animatingRef.current = false;
        if (!finished) return;
        const nr = nRef.current;
        if (nr < 2) return;
        const t = topIdxRef.current;
        setBottomIdx(t);
        const nt = (t + 1) % nr;
        topIdxRef.current = nt;
        setTopIdx(nt);
        cross.setValue(0);
        timerRef.current = setTimeout(runFade, intervalMs);
      });
    };

    timerRef.current = setTimeout(runFade, intervalMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [rotate, n, intervalMs, cross]);

  const bottomOpacity = cross.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const topOpacity = cross;

  const fallbackColor = '#1a1f2e';

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {n === 0 ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: fallbackColor }]} />
        ) : (
          <>
            <Animated.View style={[styles.layer, { opacity: bottomOpacity }]}>
              <Image
                source={resolved[bottomIdx]}
                style={styles.image}
                resizeMode="cover"
                blurRadius={blurRadius}
              />
            </Animated.View>
            {n > 1 ? (
              <Animated.View style={[styles.layer, { opacity: topOpacity }]}>
                <Image
                  source={resolved[topIdx]}
                  style={styles.image}
                  resizeMode="cover"
                  blurRadius={blurRadius}
                />
              </Animated.View>
            ) : null}
          </>
        )}
        <View
          style={[styles.overlay, { backgroundColor: overlayBackgroundColor }]}
          pointerEvents="none"
        />
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
  layer: {
    ...StyleSheet.absoluteFillObject,
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
    zIndex: 1,
  },
});
