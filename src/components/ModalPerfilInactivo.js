import React,{useEffect,useRef} from 'react';
import{View,Text,TouchableOpacity,StyleSheet,Modal,Animated}from 'react-native';
import{LinearGradient}from 'expo-linear-gradient';

export default function ModalPerfilInactivo({visible,usd,onActivar,onCerrar}){
  const slideAnim=useRef(new Animated.Value(600)).current;
  const fadeAnim=useRef(new Animated.Value(0)).current;
  const scaleAnim=useRef(new Animated.Value(0.94)).current;

  useEffect(()=>{
    if(visible){
      Animated.parallel([
        Animated.timing(fadeAnim,{toValue:1,duration:260,useNativeDriver:true}),
        Animated.spring(slideAnim,{toValue:0,tension:68,friction:10,useNativeDriver:true}),
        Animated.spring(scaleAnim,{toValue:1,tension:68,friction:10,useNativeDriver:true}),
      ]).start();
    }else{
      Animated.parallel([
        Animated.timing(fadeAnim,{toValue:0,duration:200,useNativeDriver:true}),
        Animated.timing(slideAnim,{toValue:600,duration:220,useNativeDriver:true}),
      ]).start();
    }
  },[visible]);

  return(
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onCerrar}>
      <Animated.View style={[ss.overlay,{opacity:fadeAnim}]}>
        <Animated.View style={[ss.sheet,{transform:[{translateY:slideAnim},{scale:scaleAnim}]}]}>

          {/* ── Grab bar ── */}
          <View style={ss.handle}/>

          {/* ── Hero gradient ── */}
          <LinearGradient colors={['#1C2E4A','#0D1F35']} start={{x:0,y:0}} end={{x:1,y:1}} style={ss.hero}>
            {/* círculos decorativos de fondo */}
            <View style={ss.decCircle1}/>
            <View style={ss.decCircle2}/>

            <View style={ss.iconWrap}>
              <LinearGradient colors={['#E8785A','#C85A3A']} start={{x:0,y:0}} end={{x:1,y:1}} style={ss.iconGrad}>
                <Text style={ss.iconEmoji}>⏸️</Text>
              </LinearGradient>
            </View>

            <Text style={ss.heroTit}>Tu perfil está{'\n'}pausado</Text>
            <View style={ss.heroPill}>
              <View style={ss.heroPillDot}/>
              <Text style={ss.heroPillTxt}>Invisible para empleadores</Text>
            </View>
          </LinearGradient>

          {/* ── Cuerpo ── */}
          <View style={ss.body}>

            <Text style={ss.intro}>
              Esperamos que tu experiencia con{' '}
              <Text style={ss.nexuTxt}>Nexu</Text>
              {' '}haya sido de tu agrado.
            </Text>

            <View style={ss.destacado}>
              <Text style={ss.destacadoTxt}>
                No dejes que tus oportunidades lleguen{' '}
                <Text style={ss.destacadoAcento}>antes a otros.</Text>
                {' '}Por menos que un boleto de colectivo, tu perfil se mantiene activo{' '}
                <Text style={ss.destacadoDias}>60 días</Text>
                {' '}y todas las ofertas siguen llegando a tu celular.
              </Text>
            </View>

            {/* Badge precio */}
            <LinearGradient colors={['#1C2E4A','#243B55']} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.precioBadge}>
              <View>
                <Text style={ss.precioLabel}>PRECIO ÚNICO</Text>
                <Text style={ss.precioNum}>USD ${usd}</Text>
              </View>
              <View style={ss.precioDivider}/>
              <View>
                <Text style={ss.precioDias}>60 días</Text>
                <Text style={ss.precioSub}>un solo pago</Text>
              </View>
            </LinearGradient>

          </View>

          {/* ── Botón principal 3D ── */}
          <TouchableOpacity onPress={onActivar} activeOpacity={0.82} style={ss.btnWrap}>
            <LinearGradient colors={['#F08060','#E05030']} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btnGrad}>
              <Text style={ss.btnEmoji}>⚡</Text>
              <Text style={ss.btnTxt}>Reactivar ahora — USD ${usd}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── Botón secundario ── */}
          <TouchableOpacity style={ss.btnSec} onPress={onCerrar} activeOpacity={0.6}>
            <Text style={ss.btnSecTxt}>Ahora no, quizás después</Text>
          </TouchableOpacity>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const ss=StyleSheet.create({
  overlay:{
    flex:1,
    backgroundColor:'rgba(5,4,12,0.72)',
    justifyContent:'flex-end',
  },
  sheet:{
    backgroundColor:'#FFFFFF',
    borderTopLeftRadius:32,
    borderTopRightRadius:32,
    overflow:'hidden',
    shadowColor:'#000',
    shadowOffset:{width:0,height:-8},
    shadowOpacity:0.28,
    shadowRadius:32,
    elevation:24,
  },
  handle:{
    width:40,height:4,borderRadius:2,
    backgroundColor:'rgba(255,255,255,0.25)',
    alignSelf:'center',
    position:'absolute',top:10,zIndex:10,
  },

  /* Hero */
  hero:{
    alignItems:'center',
    paddingTop:36,paddingBottom:28,
    paddingHorizontal:24,
    position:'relative',
    overflow:'hidden',
  },
  decCircle1:{
    position:'absolute',top:-40,right:-40,
    width:160,height:160,borderRadius:80,
    backgroundColor:'rgba(232,120,90,0.12)',
  },
  decCircle2:{
    position:'absolute',bottom:-20,left:-30,
    width:120,height:120,borderRadius:60,
    backgroundColor:'rgba(45,212,191,0.08)',
  },
  iconWrap:{
    marginBottom:16,
    shadowColor:'#E8785A',
    shadowOffset:{width:0,height:6},
    shadowOpacity:0.5,
    shadowRadius:12,
    elevation:10,
  },
  iconGrad:{
    width:68,height:68,borderRadius:22,
    alignItems:'center',justifyContent:'center',
  },
  iconEmoji:{fontSize:32},
  heroTit:{
    fontSize:28,fontWeight:'900',color:'#FFFFFF',
    letterSpacing:-0.8,textAlign:'center',lineHeight:34,
    marginBottom:12,
  },
  heroPill:{
    flexDirection:'row',alignItems:'center',gap:6,
    backgroundColor:'rgba(239,68,68,0.18)',
    borderRadius:20,paddingHorizontal:14,paddingVertical:6,
    borderWidth:1,borderColor:'rgba(239,68,68,0.3)',
  },
  heroPillDot:{
    width:7,height:7,borderRadius:4,
    backgroundColor:'#EF4444',
  },
  heroPillTxt:{fontSize:12,fontWeight:'700',color:'#FCA5A5'},

  /* Body */
  body:{
    paddingHorizontal:20,paddingTop:20,paddingBottom:12,
  },
  intro:{
    fontSize:14,color:'#6B5F7A',lineHeight:21,marginBottom:12,
  },
  nexuTxt:{fontWeight:'800',color:'#1A3A5C'},
  destacado:{
    backgroundColor:'#FBF8F4',borderRadius:14,
    padding:14,marginBottom:14,
    borderLeftWidth:3,borderLeftColor:'#E8785A',
  },
  destacadoTxt:{fontSize:14,color:'#3D2A4A',lineHeight:22},
  destacadoAcento:{fontWeight:'800',color:'#E8785A'},
  destacadoDias:{fontWeight:'900',color:'#0F766E'},

  /* Precio */
  precioBadge:{
    flexDirection:'row',alignItems:'center',
    borderRadius:16,paddingVertical:14,paddingHorizontal:20,
    gap:16,marginBottom:6,
    shadowColor:'#1A2A3A',
    shadowOffset:{width:0,height:4},
    shadowOpacity:0.3,
    shadowRadius:8,
    elevation:6,
  },
  precioLabel:{fontSize:9,fontWeight:'700',color:'rgba(255,255,255,0.45)',letterSpacing:1.5,marginBottom:2},
  precioNum:{fontSize:28,fontWeight:'900',color:'#FFFFFF',letterSpacing:-0.5},
  precioDivider:{width:1,height:36,backgroundColor:'rgba(255,255,255,0.15)'},
  precioDias:{fontSize:18,fontWeight:'900',color:'#2DD4BF',letterSpacing:-0.3},
  precioSub:{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:1},

  /* Botón principal */
  btnWrap:{
    marginHorizontal:20,marginBottom:10,
    borderRadius:18,
    shadowColor:'#C85A3A',
    shadowOffset:{width:0,height:6},
    shadowOpacity:0.45,
    shadowRadius:12,
    elevation:8,
  },
  btnGrad:{
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,
    borderRadius:18,paddingVertical:17,
    borderBottomWidth:4,
    borderBottomColor:'#9E3820',
  },
  btnEmoji:{fontSize:18},
  btnTxt:{color:'#FFFFFF',fontSize:16,fontWeight:'900',letterSpacing:0.2},

  /* Botón secundario */
  btnSec:{
    alignItems:'center',paddingVertical:12,marginBottom:28,
  },
  btnSecTxt:{fontSize:13,color:'#B0A0C0',fontWeight:'600'},
});
