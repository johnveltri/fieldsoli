import { color } from '@fieldsolo/design-system/lib/tokens';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ImageSourcePropType } from 'react-native';
import Svg, { Defs, G, LinearGradient, Mask, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fieldsoloLoadedFonts } from '@fieldsolo/design-system/expo/loadFieldSoloFonts';
import { createTextStyles, fg, bg, space } from '../theme/nativeTokens';

const cards: { title: string; subtitle?: string; image: ImageSourcePropType; summary: string; presentation?: 'bordered' | 'phone' | 'exportPhone' }[] = [
  { title: 'Unlimited invoices & estimates', subtitle: 'No monthly document limits.', image: require('../../assets/onboarding/card-01-invoice.png'), summary: 'Sample invoice with line items and amount due.' },
  { title: 'Track time & expenses', subtitle: 'Easily log materials and other job costs.', presentation: 'bordered', image: require('../../assets/onboarding/card-02-screen-door.png'), summary: 'Sample paid Screen door replacement job with time, revenue, cost and net earnings.' },
  { title: 'Simple. Fast.', subtitle: 'Capture now, organize later with quick actions & live visits.', presentation: 'phone', image: require('../../assets/onboarding/card-03-minimized-visit.png'), summary: 'Sample minimized active visit with title and elapsed time. This is a static screenshot.' },
  { title: 'Take your data with you.', presentation: 'exportPhone', subtitle: 'CSV export. No active subscription required.', image: require('../../assets/onboarding/card-04-export-excerpt.png'), summary: 'Job summary CSV preview showing job descriptions, revenue, total costs and net earnings.' },
  { title: 'See your job earnings.', subtitle: 'Understand profitability to inform future pricing', image: require('../../assets/onboarding/card-05-earnings.png'), summary: 'Sample earnings summary with recorded figures.' },
];

export function AuthWelcome({ onSignIn, onCreateAccount }: { onSignIn: () => void; onCreateAccount: () => void }) {
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const width = Math.min(window.width, 600);
  const artworkHeight = Math.max(160, Math.min(480, window.height * 0.48));
  const [page, setPage] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const [textHeights, setTextHeights] = useState<Record<number, number>>({});
  const [failedImages, setFailedImages] = useState<Record<number, boolean>>({});
  const list = useRef<FlatList>(null);
  const text = createTextStyles(fieldsoloLoadedFonts);

  const goTo = (index: number) => {
    // Instant paging respects reduced motion without another native dependency.
    list.current?.scrollToOffset({ offset: width * index, animated: false });
    setPage(index);
    AccessibilityInfo.announceForAccessibility(`${index + 1} of ${cards.length}. ${cards[index].title}`);
  };

  useEffect(() => {
    if (page === 0) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { goTo(page - 1); return true; });
    return () => subscription.remove();
  }, [page, width]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.column}>
        <View accessible accessibilityLabel="FieldSoli" style={styles.brand}>
          <Image source={require('../../assets/brand/fieldsoli-solo-notch-light.png')} style={styles.logo} />
          <View style={styles.wordmark}>
            <Text style={[text.titleH3, styles.foreground]}>FieldSoli</Text>
            <Text style={styles.trademark}>TM</Text>
          </View>
        </View>
        <FlatList
          key={width}
          ref={list}
          data={cards}
          keyExtractor={item => item.title}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={page}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          scrollEventThrottle={16}
          onScroll={event => {
            const index = Math.max(0, Math.min(cards.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
            setPage(index);
          }}
          renderItem={({ item, index }) => {
            // Measure the real text block so cards with subtitles, wrapping or
            // larger accessibility text all center within their remaining space.
            const stageHeight = Math.max(item.presentation === 'exportPhone' ? 280 : 160, cardHeight - 60 - (textHeights[index] ?? 100));
            const imageHeight = Math.min(artworkHeight, stageHeight - 32);
            const phoneHeight = Math.min(280, imageHeight * 0.78);
            const croppedPhoneHeight = phoneHeight * 0.75;
            const activityBottom = Math.max(12, imageHeight * 0.24 - (imageHeight - phoneHeight) / 2);
            const phoneCompositionHeight = Math.max(croppedPhoneHeight, (width - 88) * 132 / 588 + activityBottom);
            const framedWidth = Math.min(width - 82, imageHeight * 584 / 322);
            return (
            <View style={{ width, paddingHorizontal: 24 }}><ScrollView style={styles.cardSurface} onLayout={event => setCardHeight(event.nativeEvent.layout.height)} contentContainerStyle={styles.card} accessibilityElementsHidden={page !== index} importantForAccessibility={page !== index ? 'no-hide-descendants' : 'auto'}>
              <View style={{ width: '100%' }} onLayout={event => {
                const height = event.nativeEvent.layout.height;
                setTextHeights(value => value[index] === height ? value : { ...value, [index]: height });
              }}>
              <Text accessibilityRole="header" style={[text.headingH2, styles.title]}>{item.title}</Text>
              {item.subtitle ? <Text style={[text.body, styles.subtitle]}>{item.subtitle}</Text> : null}
              </View>
              <View style={{ height: stageHeight, width: width - 80, justifyContent: 'center', alignItems: 'center' }}>
              {!failedImages[index] ? (
                item.presentation === 'bordered' ? (
                  <View style={styles.imageCard}>
                      <Image source={item.image} resizeMode="contain" accessible accessibilityLabel={item.summary}
                        onError={() => setFailedImages(value => ({ ...value, [index]: true }))}
                        style={{ width: framedWidth, height: framedWidth * 322 / 584 }} />
                  </View>
                ) : item.presentation === 'exportPhone' ? (
                  <View style={{ width: width - 80, height: Math.min(imageHeight, 320), alignItems: 'center' }}>
                    <View accessible={false} importantForAccessibility="no-hide-descendants"
                      style={[styles.phoneTop, { width: (width - 80) * 0.84, height: '100%' }]}>
                      <View style={styles.exportPhoneScreen}>
                        <Image source={require('../../assets/onboarding/card-04-export-phone-screen.png')}
                          style={{ width: (width - 80) * 0.84 - 20, height: ((width - 80) * 0.84 - 20) * 2622 / 1206 }} />
                        <View style={styles.dynamicIsland} />
                      </View>
                    </View>
                    <View style={[styles.exportPreviewShadow, { width: width - 80, bottom: 0 }]}>
                      <View style={styles.exportPreviewClip}>
                        <Image source={item.image} resizeMode="contain" accessible accessibilityLabel={item.summary}
                          onError={() => setFailedImages(value => ({ ...value, [index]: true }))}
                          style={{ width: width - 82, height: (width - 82) * 600 / 1240 }} />
                      </View>
                    </View>
                  </View>
                ) : item.presentation === 'phone' ? (
                  <View style={{ width: width - 80, height: phoneCompositionHeight, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <View style={{ width: (width - 80) * 0.84, height: croppedPhoneHeight }}>
                    <Svg accessible={false} importantForAccessibility="no-hide-descendants"
                      width={(width - 80) * 0.84} height={croppedPhoneHeight} viewBox="0 70 270 210" preserveAspectRatio="none">
                      <Defs>
                        <LinearGradient id="phoneCropFade" x1="0" y1="0.25" x2="0" y2="1">
                          <Stop offset="0" stopColor="#fff" stopOpacity={0} />
                          <Stop offset="0.5" stopColor="#fff" stopOpacity={1} />
                          <Stop offset="1" stopColor="#fff" stopOpacity={1} />
                        </LinearGradient>
                        <Mask id="phoneCropMask" x="0" y="0" width="270" height="280" maskUnits="userSpaceOnUse">
                          <Rect width="270" height="280" fill="url(#phoneCropFade)" />
                        </Mask>
                      </Defs>
                      <G mask="url(#phoneCropMask)">
                        <Path d="M0 0H270V238Q270 280 228 280H42Q0 280 0 238Z" fill="#333942" />
                        <Path d="M7 0H263V238Q263 273 228 273H42Q7 273 7 238Z" fill="#171b21" />
                        <Path d="M10 0H260V238Q260 270 228 270H42Q10 270 10 238Z" fill={bg.canvasWarm} />
                        <Rect x="95" y="262" width="80" height="4" rx="2" fill={fg.primary} />
                      </G>
                    </Svg>
                    </View>
                    <View style={[styles.activityShadow, { width: width - 88, bottom: activityBottom }]}>
                      <Image source={item.image} resizeMode="contain" accessible accessibilityLabel={item.summary}
                        onError={() => setFailedImages(value => ({ ...value, [index]: true }))}
                        style={{ width: width - 88, height: (width - 88) * 132 / 588, borderRadius: 14 }} />
                    </View>
                  </View>
                ) : <Image source={item.image} resizeMode="contain" accessible accessibilityLabel={item.summary}
                  onError={() => setFailedImages(value => ({ ...value, [index]: true }))}
                  style={{ width: width - 80, height: imageHeight }} />
              ) : null}
              </View>
            </ScrollView></View>
          ); }}
        />
        <View style={styles.paging}>
          {cards.map((card, index) => (
            <Pressable key={card.title} accessibilityRole="button" accessibilityLabel={`Show card ${index + 1}: ${card.title}`}
              accessibilityState={{ selected: page === index }} onPress={() => goTo(index)} style={styles.dotTarget}>
              <View style={[styles.dot, index === page && styles.activeDot]} />
            </Pressable>
          ))}
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onCreateAccount} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><Text style={[text.bodyBold, { color: '#fff' }]}>Create account</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={onSignIn} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={[text.bodyBold, styles.foreground]}>Sign in</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: bg.canvasWarm, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: 600 },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 16 },
  wordmark: { flexDirection: 'row', alignItems: 'flex-start' },
  trademark: { fontFamily: 'PTSerif_400Regular', fontWeight: '400', fontSize: 6.4, lineHeight: 8, color: fg.primary, marginLeft: 3, marginTop: 0 },
  logo: { height: 32, width: 32 },
  foreground: { color: fg.primary },
  imageCard: { borderWidth: 1, borderColor: '#d6d6d6', borderRadius: 14, overflow: 'hidden', backgroundColor: '#fff' },
  phoneTop: {
    borderWidth: 7, borderBottomWidth: 0, borderColor: '#333942', borderTopLeftRadius: 42, borderTopRightRadius: 42,
    backgroundColor: '#171b21', overflow: 'hidden', padding: 3,
  },
  exportPhoneScreen: { flex: 1, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: bg.canvasWarm, overflow: 'hidden' },
  dynamicIsland: { position: 'absolute', top: 10, alignSelf: 'center', width: 70, height: 20, borderRadius: 12, backgroundColor: '#090a0b' },
  exportPreviewShadow: { position: 'absolute', borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
  exportPreviewClip: { borderRadius: 10, borderWidth: 1, borderColor: '#d6d6d6', overflow: 'hidden', backgroundColor: '#fff' },
  activityShadow: { position: 'absolute', borderRadius: 14, backgroundColor: fg.primary, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  cardSurface: { flex: 1, backgroundColor: '#fff', borderRadius: 20 },
  card: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 0 },
  title: { color: fg.primary, textAlign: 'center' },
  subtitle: { color: fg.secondary, textAlign: 'center', marginTop: 10 },
  paging: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  dotTarget: { paddingHorizontal: 4, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { height: 8, width: 8, borderRadius: 4, backgroundColor: fg.primary },
  activeDot: { width: 24 },
  actions: { paddingHorizontal: space('Spacing/24'), gap: 10 },
  primary: { backgroundColor: color('Brand/Primary'), borderRadius: 12, alignItems: 'center', padding: 14, minHeight: 48 },
  secondary: { borderColor: 'rgba(43,52,65,0.24)', borderWidth: 1, borderRadius: 12, alignItems: 'center', padding: 14, minHeight: 48 },
  pressed: { opacity: 0.8 },
});
