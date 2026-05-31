import React,{useState,useRef,useEffect} from 'react';
import{View,Text,StyleSheet,TouchableOpacity,Dimensions,ScrollView}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{LinearGradient}from 'expo-linear-gradient';
import{useFonts,PlayfairDisplay_700Bold_Italic}from '@expo-google-fonts/playfair-display';
import{useI18n}from '../../services/I18nContext';
import{supabase}from '../../services/supabase';
const{width}=Dimensions.get('window');
const SLIDES_WORKER=[
{emoji:'👋',color1:'#2DD4BF',color2:'#4E6098',titulo:'Bienvenido a Nexu',desc:'10 días gratis · Sin necesidad de tarjeta\n\n45 segundos es todo lo que necesitas.\nCompleta tu perfil y empieza a recibir trabajos pensados para ti, cerca de tu zona, acorde a tus habilidades y experiencia.\n\nComparte la app con amigos que también quieran recibir ofertas:\n5 días gratis más por cada uno.\nHasta 3 amigos → 25 días gratis.',promo:'🔥 Promoción solo por este mes'},
{emoji:'🔒',color1:'#C17A5E',color2:'#A86448',titulo:'Tu privacidad primero',desc:'El empleador solo podrá ver tu nombre de pila, datos profesionales y valoraciones.\n\nTu perfil completo, únicamente si manifestás interés por una oferta y aceptás el contacto.\n\nIdeal si tenés trabajo y estás evaluando opciones para mejorar de forma discreta, o sos estudiante buscando trabajo de medio horario.\n\nTambién analizamos tu perfil y lo cruzamos con llamados públicos abiertos — te avisamos cuando cumplís los requisitos.'},
];

const SLIDES_EMPLOYER=[
{emoji:'👥',color1:'#1C2B3A',color2:'#0F1E2C',titulo:'Encuentra a la persona que necesitas',desc:'El personal o especialista que necesitás,\na un clic de distancia.\n\nFiltrá por zona, habilidades y disponibilidad.\nContacto directo, sin intermediarios ni complicaciones.'},
{emoji:'🔒',color1:'#C17A5E',color2:'#A86448',titulo:'La privacidad está primero',desc:'Cada trabajador muestra solo su nombre de pila, habilidades y valoración — nada más.\n\nFotos y datos completos solo cuando vos decidís dar el siguiente paso.\n\nSimple, seguro y sin compromisos.'},
];
export default function OnboardingScreen({navigation,route}){
const{t}=useI18n();
const[actual,setActual]=useState(0);
const scrollRef=useRef(null);
const[fontsLoaded]=useFonts({PlayfairDisplay_700Bold_Italic});
const role=(route.params?.role)||'worker';
const SLIDES=role==='employer'?SLIDES_EMPLOYER:SLIDES_WORKER;
const[totalOportunidades,setTotalOportunidades]=useState(null);
useEffect(()=>{
  supabase.from('concursos').select('*',{count:'exact',head:true}).then(({count})=>{
    if(count)setTotalOportunidades(count);
  });
},[]);
function siguiente(){if(actual<SLIDES.length-1){const next=actual+1;scrollRef.current?.scrollTo({x:next*width,animated:true});setActual(next);}else{navigation.replace('Register',{role});}}
function saltar(){navigation.replace('Register',{role});}
const slide=SLIDES[actual];
return(
<View style={ss.c}>
<ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEnabled={false} style={{flex:1}}>
{SLIDES.map((s,i)=>(<LinearGradient key={i} colors={[s.color1,s.color2]} style={ss.slide}><SafeAreaView style={ss.inner} edges={['top']}>{i===0&&role==='worker'&&<>
  <Text style={[ss.tagline,fontsLoaded&&{fontFamily:'PlayfairDisplay_700Bold_Italic'}]}>Haz que las oportunidades te encuentren</Text>
  {totalOportunidades&&<View style={ss.contadorWrap}>
    <Text style={ss.contadorNum}>{totalOportunidades.toLocaleString('es')}+</Text>
    <Text style={ss.contadorLbl}>oportunidades laborales activas hoy</Text>
  </View>}
</>}{i<SLIDES.length-1&&(<TouchableOpacity style={ss.skip} onPress={saltar}><Text style={ss.skipTxt}>{t('saltar')}</Text></TouchableOpacity>)}<View style={ss.bubble}><Text style={ss.emoji}>{s.emoji}</Text></View><View style={ss.tw}><Text style={ss.titulo}>{s.titulo}</Text><Text style={ss.desc}>{s.desc}</Text>{s.promo&&<Text style={ss.promo}>{s.promo}</Text>}</View></SafeAreaView></LinearGradient>))}
</ScrollView>
<View style={ss.footer}>
<View style={ss.dots}>{SLIDES.map((_,i)=>(<View key={i} style={[ss.dot,i===actual&&ss.da]}/>))}</View>
<TouchableOpacity style={ss.nb} onPress={siguiente}><LinearGradient colors={[slide.color1,slide.color2]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.ng}><Text style={ss.nt}>{actual===SLIDES.length-1?t('empezar'):t('siguiente')}</Text></LinearGradient></TouchableOpacity>
</View>
</View>);}
const ss=StyleSheet.create({
c:{flex:1,backgroundColor:'#2DD4BF'},slide:{width,flex:1},
inner:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:32,paddingBottom:175},
skip:{position:'absolute',top:56,right:24,paddingHorizontal:16,paddingVertical:8,backgroundColor:'rgba(255,255,255,0.18)',borderRadius:20},
skipTxt:{color:'rgba(255,255,255,0.8)',fontSize:13,fontWeight:'600'},
bubble:{width:100,height:100,borderRadius:50,backgroundColor:'rgba(255,255,255,0.18)',alignItems:'center',justifyContent:'center',marginBottom:28,borderWidth:2,borderColor:'rgba(255,255,255,0.22)'},
emoji:{fontSize:46},tw:{alignItems:'center'},
titulo:{fontSize:26,fontWeight:'900',color:'#FFFFFF',textAlign:'center',letterSpacing:-0.5,marginBottom:16,lineHeight:32},
desc:{fontSize:15,color:'rgba(255,255,255,0.88)',textAlign:'center',lineHeight:24},
promo:{fontSize:14,fontWeight:'800',color:'#FF5F40',textAlign:'center',marginTop:14,letterSpacing:0.3},
footer:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#FFFFFF',paddingHorizontal:24,paddingTop:20,paddingBottom:44,borderTopLeftRadius:28,borderTopRightRadius:28},
dots:{flexDirection:'row',justifyContent:'center',gap:6,marginBottom:16},
dot:{width:6,height:6,borderRadius:3,backgroundColor:'#EDE8E2'},
da:{width:20,backgroundColor:'#C17A5E'},
nb:{borderRadius:14,overflow:'hidden'},ng:{paddingVertical:16,alignItems:'center'},
nt:{color:'#FFFFFF',fontSize:16,fontWeight:'800'},
tagline:{textAlign:'center',fontSize:24,color:'#FFF5E0',letterSpacing:-0.3,lineHeight:32,marginTop:72,marginBottom:16,paddingHorizontal:4,textShadowColor:'rgba(0,0,0,0.2)',textShadowOffset:{width:0,height:1},textShadowRadius:4},
contadorWrap:{alignItems:'center',marginBottom:20,backgroundColor:'rgba(255,255,255,0.15)',borderRadius:16,paddingVertical:10,paddingHorizontal:24,borderWidth:1,borderColor:'rgba(255,255,255,0.25)'},
contadorNum:{fontSize:36,fontWeight:'900',color:'#FFFFFF',letterSpacing:-1},
contadorLbl:{fontSize:12,color:'rgba(255,255,255,0.85)',fontWeight:'600',marginTop:2},
descargaNexu:{position:'absolute',bottom:198,left:0,right:0,textAlign:'center',fontSize:14,fontWeight:'700',color:'rgba(255,255,255,0.8)',letterSpacing:1},
gratis:{position:'absolute',bottom:155,left:0,right:0,textAlign:'center',fontSize:26,fontWeight:'900',color:'#FFFFFF',letterSpacing:-0.5},
});
