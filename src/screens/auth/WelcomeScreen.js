import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, PlayfairDisplay_700Bold_Italic } from '@expo-google-fonts/playfair-display';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { supabase } from '../../services/supabase';

const REGION_CONTINENTE = {
  UY:'latam',AR:'latam',BR:'latam',CL:'latam',PY:'latam',BO:'latam',
  PE:'latam',CO:'latam',MX:'latam',EC:'latam',VE:'latam',CU:'latam',
  CR:'latam',PA:'latam',GT:'latam',SV:'latam',HN:'latam',NI:'latam',DO:'latam',
  ES:'europa',PT:'europa',FR:'europa',DE:'europa',IT:'europa',GB:'europa',
  SE:'europa',NO:'europa',BE:'europa',NL:'europa',CH:'europa',AT:'europa',
  PL:'europa',CZ:'europa',HU:'europa',RO:'europa',FI:'europa',DK:'europa',
  IE:'europa',GR:'europa',
  JP:'asia',IN:'asia',CN:'asia',KR:'asia',TH:'asia',VN:'asia',
  ID:'asia',PH:'asia',MY:'asia',SG:'asia',HK:'asia',TW:'asia',PK:'asia',
  AU:'oceania',NZ:'oceania',
};

const CONTINENTE_CONFIG = {
  latam:   { label:'América Latina', paises:['UY','AR','BR','CL','PY','BO','PE','CO','MX','EC','VE','CU','CR','PA','GT','SV','HN','NI','DO'] },
  europa:  { label:'Europa',         paises:['ES','PT','FR','DE','IT','GB','SE','NO'] },
  asia:    { label:'Asia',           paises:['JP','IN'] },
  oceania: { label:'Oceanía',        paises:['AU'] },
  mundo:   { label:'el mundo',       paises:[] },
};

function detectarContinente() {
  const region = Localization.getLocales?.()?.[0]?.regionCode || Localization.region || '';
  return REGION_CONTINENTE[region] || 'mundo';
}

export default function WelcomeScreen({ navigation }) {
  const continente = detectarContinente();
  const config = CONTINENTE_CONFIG[continente] || CONTINENTE_CONFIG.latam;

  const [total, setTotal] = useState(null);
  const [paises, setPaises] = useState(null);
  const [fontsLoaded] = useFonts({ PlayfairDisplay_700Bold_Italic });

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const numAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem('welcome_visto').then(visto => {
      if (visto) navigation.replace('RoleSelect');
    });

    const pf = config.paises;
    const baseCount = supabase.from('concursos').select('*',{count:'estimated',head:true}).eq('activo',true);
    const basePais  = supabase.from('concursos').select('pais',{count:'estimated',head:false}).eq('activo',true);
    Promise.all([
      pf.length ? baseCount.in('pais',pf) : baseCount,
      pf.length ? basePais.in('pais',pf)  : basePais,
    ]).then(([{count},{data}])=>{
      if(count) setTotal(count);
      if(data) setPaises(new Set(data.map(r=>r.pais)).size);
    });

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!total) return;
    Animated.timing(numAnim, {
      toValue: total,
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [total]);

  async function comenzar() {
    await AsyncStorage.setItem('welcome_visto', '1');
    navigation.replace('RoleSelect');
  }

  return (
    <LinearGradient colors={['#0D1117', '#1A2640', '#0D1F2D']} style={ss.container}>
      <SafeAreaView style={ss.safe} edges={['top', 'bottom']}>
        <Animated.View style={[ss.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          <View style={ss.logoWrap}>
            <View style={ss.logoBox}>
              <View style={{position:'relative'}}>
                <Text style={ss.logoTxt}>Nexu</Text>
                <Text style={ss.logoPuzzle}>🧩</Text>
              </View>
            </View>
          </View>

          <Text style={[ss.tagline, fontsLoaded && { fontFamily: 'PlayfairDisplay_700Bold_Italic' }]}>
            Todos los llamados públicos{'\n'}de {config.label},{'\n'}en un solo lugar.
          </Text>

          <View style={ss.counterCard}>
            <View style={ss.counterRow}>
              <Animated.Text style={ss.counterNum}>
                {numAnim.interpolate({
                  inputRange: [0, total || 1],
                  outputRange: ['0', (total || 0).toLocaleString('es')],
                })}
              </Animated.Text>
              <Text style={ss.counterPlus}>+</Text>
            </View>
            <Text style={ss.counterLabel}>llamados activos hoy</Text>
            <Text style={ss.counterSub}>actualizado a diario</Text>
          </View>

          <View style={ss.benefits}>
            {[
              { icon: '🎯', txt: 'La app cruza tu perfil con los llamados abiertos' },
              { icon: '🔔', txt: 'Te avisamos cuando cumplís los requisitos' },
              { icon: '🔒', txt: 'Tu privacidad primero — contacto solo si vos aceptás' },
            ].map((b, i) => (
              <View key={i} style={ss.benefitRow}>
                <Text style={ss.benefitIcon}>{b.icon}</Text>
                <Text style={ss.benefitTxt}>{b.txt}</Text>
              </View>
            ))}
          </View>

        </Animated.View>

        <Animated.View style={[ss.footer, { opacity: fadeAnim }]}>
          <TouchableOpacity style={ss.btn} onPress={comenzar} activeOpacity={0.88}>
            <LinearGradient
              colors={['#E8785A', '#D4614A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={ss.btnGrad}
            >
              <Text style={ss.btnTxt}>Comenzar gratis →</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={ss.footerNote}>10 días gratis · Sin tarjeta de crédito</Text>
        </Animated.View>

      </SafeAreaView>
    </LinearGradient>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, justifyContent: 'space-between' },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 20, justifyContent: 'center' },

  logoWrap: { flexDirection: 'column', alignItems: 'flex-start', marginBottom: 32 },
  logoBox: { backgroundColor: '#0D1117', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 2.5, borderColor: '#E8785A' },
  logoTxt: { fontSize: 38, fontWeight: '900', color: '#E8785A', letterSpacing: -1, fontStyle: 'normal' },
  logoPuzzle: { fontSize: 16, position: 'absolute', bottom: 2, right: -8 },
  logo: { fontSize: 32, fontWeight: '900', color: '#E8785A', letterSpacing: -1 },

  tagline: {
    fontSize: 30, color: '#FFFFFF', lineHeight: 40,
    letterSpacing: -0.5, marginBottom: 32,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2,
  },

  counterCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20, padding: 24, marginBottom: 32,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  counterRow: { flexDirection: 'row', alignItems: 'flex-end' },
  counterNum: { fontSize: 52, fontWeight: '900', color: '#FFFFFF', letterSpacing: -2, lineHeight: 58 },
  counterPlus: { fontSize: 32, fontWeight: '900', color: '#2DD4BF', marginBottom: 6, marginLeft: 4 },
  counterLabel: { fontSize: 14, color: 'rgba(255,255,255,0.75)', fontWeight: '600', marginTop: 6, textAlign: 'center' },
  counterSub: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4, textAlign: 'center' },

  benefits: { gap: 14 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  benefitTxt: { fontSize: 14, color: 'rgba(255,255,255,0.80)', lineHeight: 20, flex: 1 },

  footer: { paddingHorizontal: 28, paddingBottom: 12, gap: 12 },
  btn: { borderRadius: 14, overflow: 'hidden' },
  btnGrad: { paddingVertical: 17, alignItems: 'center' },
  btnTxt: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  footerNote: { textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: '500' },
});
