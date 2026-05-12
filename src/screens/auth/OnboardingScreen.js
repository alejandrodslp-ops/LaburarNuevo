import React,{useState,useRef} from 'react';
import{View,Text,StyleSheet,TouchableOpacity,Dimensions,ScrollView}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{LinearGradient}from 'expo-linear-gradient';
const{width}=Dimensions.get('window');
const SLIDES=[
{emoji:'👋',color1:'#C17A5E',color2:'#A86448',titulo:'Bienvenido a Nexu',desc:'La app que conecta personas con trabajo y personas que necesitan ayuda. Simple, rápido y desde tu celular.'},
{emoji:'🔒',color1:'#2DD4BF',color2:'#4E6098',titulo:'Tu privacidad primero',desc:'Cuando buscás un servicio, el trabajador aparece de forma anónima. Solo ves sus habilidades y valoraciones, sin fotos ni nombres hasta que decidís contactarlo.'},
{emoji:'⚡',color1:'#4A9E80',color2:'#3A8E70',titulo:'Las oportunidades te encuentran',desc:'Activá tu perfil y las oportunidades te encuentran directo en tu celular, sin gastar tiempo ni dinero buscando.\n\nIdeal si ya tenés trabajo y buscás algo mejor, o si sos estudiante y querés trabajar medio horario.\n\nDiscreción total. Sin suscripciones automáticas.'},
{emoji:'📍',color1:'#6E8AA8',color2:'#5E7A98',titulo:'Cerca de ti',desc:'Encontrá trabajadores en tu zona o publicá tus servicios al mundo.\n\nComo trabajador, vos elegís en qué zonas o ciudades estás dispuesto a trabajar.'},
{emoji:'🏛️',color1:'#8A6E52',color2:'#7A5E42',titulo:'Concursa',desc:'Analizamos tu perfil y datos contra los llamados públicos abiertos y te avisamos cuando cumplís los requisitos. Gratis, incluido en tu perfil.'},
];
export default function OnboardingScreen({navigation}){
const[actual,setActual]=useState(0);
const scrollRef=useRef(null);
function siguiente(){if(actual<SLIDES.length-1){const next=actual+1;scrollRef.current?.scrollTo({x:next*width,animated:true});setActual(next);}else{navigation.replace('RoleSelect');}}
function saltar(){navigation.replace('RoleSelect');}
const slide=SLIDES[actual];
return(
<View style={ss.c}>
<ScrollView ref={scrollRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEnabled={false} style={{flex:1}}>
{SLIDES.map((s,i)=>(<LinearGradient key={i} colors={[s.color1,s.color2]} style={ss.slide}><SafeAreaView style={ss.inner} edges={['top']}>{i<SLIDES.length-1&&(<TouchableOpacity style={ss.skip} onPress={saltar}><Text style={ss.skipTxt}>Saltar</Text></TouchableOpacity>)}<View style={ss.bubble}><Text style={ss.emoji}>{s.emoji}</Text></View><View style={ss.tw}><Text style={ss.titulo}>{s.titulo}</Text><Text style={ss.desc}>{s.desc}</Text></View></SafeAreaView></LinearGradient>))}
</ScrollView>
<View style={ss.footer}>
<View style={ss.dots}>{SLIDES.map((_,i)=>(<View key={i} style={[ss.dot,i===actual&&ss.da]}/>))}</View>
<TouchableOpacity style={ss.nb} onPress={siguiente}><LinearGradient colors={[slide.color1,slide.color2]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.ng}><Text style={ss.nt}>{actual===SLIDES.length-1?'¡Empezar! →':'Siguiente →'}</Text></LinearGradient></TouchableOpacity>
</View>
</View>);}
const ss=StyleSheet.create({
c:{flex:1,backgroundColor:'#2DD4BF'},slide:{width,flex:1},
inner:{flex:1,alignItems:'center',justifyContent:'center',paddingHorizontal:32,paddingBottom:140},
skip:{position:'absolute',top:56,right:24,paddingHorizontal:16,paddingVertical:8,backgroundColor:'rgba(255,255,255,0.18)',borderRadius:20},
skipTxt:{color:'rgba(255,255,255,0.8)',fontSize:13,fontWeight:'600'},
bubble:{width:130,height:130,borderRadius:65,backgroundColor:'rgba(255,255,255,0.18)',alignItems:'center',justifyContent:'center',marginBottom:36,borderWidth:2,borderColor:'rgba(255,255,255,0.22)'},
emoji:{fontSize:60},tw:{alignItems:'center'},
titulo:{fontSize:26,fontWeight:'900',color:'#FFFFFF',textAlign:'center',letterSpacing:-0.5,marginBottom:16,lineHeight:32},
desc:{fontSize:15,color:'rgba(255,255,255,0.88)',textAlign:'center',lineHeight:24},
footer:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#FFFFFF',paddingHorizontal:24,paddingTop:20,paddingBottom:44,borderTopLeftRadius:28,borderTopRightRadius:28},
dots:{flexDirection:'row',justifyContent:'center',gap:6,marginBottom:16},
dot:{width:6,height:6,borderRadius:3,backgroundColor:'#EDE8E2'},
da:{width:20,backgroundColor:'#C17A5E'},
nb:{borderRadius:14,overflow:'hidden'},ng:{paddingVertical:16,alignItems:'center'},
nt:{color:'#FFFFFF',fontSize:16,fontWeight:'800'},
});
