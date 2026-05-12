import React,{useEffect,useRef} from 'react';
import{View,Text,TouchableOpacity,StyleSheet,Modal,Animated,TouchableWithoutFeedback}from 'react-native';

const TAIL=13;

export default function CoachMarkPerfil({visible,onDismiss,onIrACuenta}){
  const fadeAnim=useRef(new Animated.Value(0)).current;
  const slideAnim=useRef(new Animated.Value(8)).current;

  useEffect(()=>{
    if(visible){
      Animated.parallel([
        Animated.timing(fadeAnim,{toValue:1,duration:240,useNativeDriver:true}),
        Animated.spring(slideAnim,{toValue:0,tension:100,friction:10,useNativeDriver:true}),
      ]).start();
    }else{
      Animated.timing(fadeAnim,{toValue:0,duration:160,useNativeDriver:true})
        .start(()=>slideAnim.setValue(8));
    }
  },[visible]);

  const PUNTOS=[
    'Cuanto más completo esté, más ofertas recibirás según tus habilidades y profesión',
    'Los empleadores solo ven tus datos laborales hasta que vos aceptés su interés',
    'Tus datos personales permanecen privados en todo momento',
  ];

  return(
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onDismiss}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={StyleSheet.absoluteFill}/>
      </TouchableWithoutFeedback>

      <Animated.View style={[ss.wrap,{opacity:fadeAnim,transform:[{translateY:slideAnim}]}]}>

        <View style={ss.burbuja}>

          <View style={ss.header}>
            <Text style={ss.titulo}>Completá tu perfil</Text>
            <TouchableOpacity onPress={onDismiss} hitSlop={{top:12,bottom:12,left:12,right:12}}>
              <Text style={ss.x}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={ss.puntos}>
            {PUNTOS.map((txt,i)=>(
              <View key={i} style={ss.punto}>
                <View style={ss.puntoDot}/>
                <Text style={ss.puntoTxt}>{txt}</Text>
              </View>
            ))}
          </View>

          <View style={ss.footer}>
            <TouchableOpacity style={ss.btnCuenta} onPress={onIrACuenta} activeOpacity={0.82}>
              <Text style={ss.btnCuentaTxt}>Completar mi CV  →</Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* Cola apuntando al tab Cuenta (derecha) */}
        <View style={ss.colaWrap}>
          <View style={[ss.cola,ss.colaFondo]}/>
          <View style={ss.cola}/>
        </View>

      </Animated.View>
    </Modal>
  );
}

const ss=StyleSheet.create({
  wrap:{
    position:'absolute',
    bottom:80,
    left:14,
    right:14,
  },

  burbuja:{
    backgroundColor:'#FFFFFF',
    borderRadius:16,
    borderWidth:1,
    borderColor:'#E0EEEE',
    shadowColor:'#0F766E',
    shadowOffset:{width:0,height:5},
    shadowOpacity:0.10,
    shadowRadius:16,
    elevation:11,
  },

  header:{
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'space-between',
    paddingHorizontal:18,
    paddingTop:16,
    paddingBottom:10,
    borderBottomWidth:1,
    borderBottomColor:'#F0F5F5',
  },
  titulo:{fontSize:15,fontWeight:'800',color:'#1A1020',letterSpacing:-0.2},
  x:{fontSize:14,color:'#B0C0C0'},

  puntos:{
    paddingHorizontal:18,
    paddingTop:12,
    paddingBottom:4,
    gap:9,
  },
  punto:{flexDirection:'row',alignItems:'flex-start',gap:9},
  puntoDot:{
    width:5,height:5,borderRadius:3,
    backgroundColor:'#2DD4BF',
    marginTop:7,flexShrink:0,
  },
  puntoTxt:{flex:1,fontSize:13,color:'#5A4E6A',lineHeight:19},

  footer:{
    paddingHorizontal:14,
    paddingVertical:12,
    alignItems:'flex-end',
  },
  btnCuenta:{
    backgroundColor:'#2DD4BF',
    borderRadius:10,
    paddingVertical:10,
    paddingHorizontal:18,
  },
  btnCuentaTxt:{fontSize:13,fontWeight:'800',color:'#FFFFFF'},

  colaWrap:{
    alignSelf:'flex-end',
    marginRight:22,
    marginTop:-(TAIL/2)-1,
    width:TAIL,
    height:TAIL,
  },
  cola:{
    position:'absolute',
    width:TAIL,height:TAIL,
    backgroundColor:'#FFFFFF',
    borderRightWidth:1,
    borderBottomWidth:1,
    borderColor:'#E0EEEE',
    transform:[{rotate:'45deg'}],
  },
  colaFondo:{
    backgroundColor:'transparent',
    borderColor:'transparent',
    shadowColor:'#0F766E',
    shadowOffset:{width:1,height:2},
    shadowOpacity:0.08,
    shadowRadius:3,
    elevation:4,
  },
});
