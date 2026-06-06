import React,{useEffect,useRef}from 'react';
import{View,Text,TouchableOpacity,StyleSheet,Modal,Animated,Share}from 'react-native';
import{LinearGradient}from 'expo-linear-gradient';
import{supabase}from '../services/supabase';

const BASE_URL='https://nexu.app/download';

export default function ActivacionExitosaModal({visible,onClose}){
  const slideAnim=useRef(new Animated.Value(400)).current;
  const fadeAnim=useRef(new Animated.Value(0)).current;

  useEffect(()=>{
    if(visible){
      Animated.parallel([
        Animated.timing(fadeAnim,{toValue:1,duration:240,useNativeDriver:true}),
        Animated.spring(slideAnim,{toValue:0,tension:80,friction:11,useNativeDriver:true}),
      ]).start();
    }else{
      Animated.parallel([
        Animated.timing(fadeAnim,{toValue:0,duration:180,useNativeDriver:true}),
        Animated.timing(slideAnim,{toValue:400,duration:200,useNativeDriver:true}),
      ]).start();
    }
  },[visible]);

  async function compartir(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      const{data}=await supabase.from('profiles').select('codigo_referido,pais').eq('id',user.id).single();
      const codigo=data?.codigo_referido||'';
      const link=codigo?`${BASE_URL}?r=${codigo}`:BASE_URL;
      const esBR=data?.pais==='BR';
      const mensaje=esBR
        ?`Milhares de trabalhadores já estão recebendo ofertas de emprego pelo Nexu. Não fique de fora — baixe o app grátis e ative seu perfil agora:\n${link}`
        :`Miles de trabajadores ya están recibiendo ofertas de empleo por empresas en Nexu. No te quedés afuera — descargá la app gratis y activá tu perfil ahora:\n${link}`;
      await Share.share({message:mensaje,title:'Nexu'});
    }catch(e){}
  }

  return(
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[ss.overlay,{opacity:fadeAnim}]}>
        <Animated.View style={[ss.sheet,{transform:[{translateY:slideAnim}]}]}>

          <View style={ss.handle}/>

          {/* Encabezado */}
          <View style={ss.top}>
            <LinearGradient colors={['#E8785A','#C85A3A']} start={{x:0,y:0}} end={{x:1,y:1}} style={ss.badge}>
              <Text style={ss.badgeEmoji}>✓</Text>
            </LinearGradient>
            <Text style={ss.titulo}>¡Perfil activado!</Text>
            <Text style={ss.sub}>Tu perfil ya es visible para los empleadores</Text>
          </View>

          {/* Días gratis */}
          <View style={ss.card}>
            <View style={ss.cardRow}>
              <View style={ss.cardDot}/>
              <View style={{flex:1}}>
                <Text style={ss.cardTit}>10 días gratis</Text>
                <Text style={ss.cardSub}>Tu perfil permanecerá activo y recibirás contactos durante este período</Text>
              </View>
              <Text style={ss.cardNum}>10</Text>
            </View>
          </View>

          {/* Extender período */}
          <View style={ss.refCard}>
            <Text style={ss.refTit}>Extiende tu período gratis</Text>
            <Text style={ss.refSub}>Puedes extender tu período de prueba compartiendo la app. Sumas 5 días por cada contacto que se registre, con un máximo de 3.</Text>
            <Text style={ss.refExtra}>(15 días más)</Text>
          </View>

          {/* Botones */}
          <TouchableOpacity style={ss.btnCompartir} onPress={compartir} activeOpacity={0.85}>
            <Text style={ss.btnCompartirTxt}>Enviar enlace a un contacto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ss.btnCerrar} onPress={onClose}>
            <Text style={ss.btnCerrarTxt}>Ahora no, lo hago después</Text>
          </TouchableOpacity>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const ss=StyleSheet.create({
  overlay:{
    flex:1,
    backgroundColor:'rgba(26,16,32,0.55)',
    justifyContent:'flex-end',
  },
  sheet:{
    backgroundColor:'#FFFFFF',
    borderTopLeftRadius:26,
    borderTopRightRadius:26,
    paddingBottom:36,
    shadowColor:'#1A1020',
    shadowOffset:{width:0,height:-4},
    shadowOpacity:0.14,
    shadowRadius:20,
    elevation:16,
  },
  handle:{
    width:38,height:4,borderRadius:2,
    backgroundColor:'#EDE8E2',
    alignSelf:'center',
    marginTop:12,marginBottom:4,
  },
  top:{
    alignItems:'center',
    paddingTop:16,paddingBottom:20,
    paddingHorizontal:24,
  },
  badge:{
    width:56,height:56,borderRadius:28,
    alignItems:'center',justifyContent:'center',
    marginBottom:14,
  },
  badgeEmoji:{fontSize:26,color:'#FFFFFF',fontWeight:'900'},
  titulo:{fontSize:22,fontWeight:'900',color:'#1A1020',letterSpacing:-0.4,marginBottom:6},
  sub:{fontSize:14,color:'#A898B8',textAlign:'center',lineHeight:20},

  card:{
    marginHorizontal:20,marginBottom:12,
    backgroundColor:'#FBF8F4',
    borderRadius:14,padding:16,
    borderWidth:1,borderColor:'#EDE8E2',
  },
  cardRow:{flexDirection:'row',alignItems:'center',gap:12},
  cardDot:{width:10,height:10,borderRadius:5,backgroundColor:'#3DA882',flexShrink:0},
  cardTit:{fontSize:15,fontWeight:'800',color:'#1A1020',marginBottom:3},
  cardSub:{fontSize:13,color:'#A898B8',lineHeight:18},
  cardNum:{fontSize:36,fontWeight:'900',color:'#3DA882',letterSpacing:-1,lineHeight:40},

  refCard:{
    marginHorizontal:20,marginBottom:16,
    backgroundColor:'#F0FDFA',
    borderRadius:14,padding:16,
    borderWidth:1,borderColor:'#99D6D0',
  },
  refTit:{fontSize:14,fontWeight:'800',color:'#0F766E',marginBottom:6,textAlign:'center'},
  refSub:{fontSize:13,color:'#E8785A',lineHeight:19,textAlign:'justify'},
  refExtra:{fontSize:15,fontWeight:'900',color:'#E8785A',textAlign:'center',marginTop:8},

  btnCompartir:{
    marginHorizontal:20,marginBottom:10,
    backgroundColor:'#2DD4BF',
    borderRadius:14,paddingVertical:14,
    alignItems:'center',
  },
  btnCompartirTxt:{color:'#FFFFFF',fontSize:15,fontWeight:'800'},
  btnCerrar:{alignItems:'center',paddingVertical:6},
  btnCerrarTxt:{fontSize:13,color:'#A898B8',fontWeight:'600'},
});
