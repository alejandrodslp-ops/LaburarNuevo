import React,{useEffect,useRef} from 'react';
import{View,Text,TouchableOpacity,StyleSheet,Animated}from 'react-native';

export default function CoachMarkEditarBtn({visible,onDismiss}){
  const fadeAnim=useRef(new Animated.Value(0)).current;
  const slideAnim=useRef(new Animated.Value(-6)).current;

  useEffect(()=>{
    if(visible){
      Animated.parallel([
        Animated.timing(fadeAnim,{toValue:1,duration:220,useNativeDriver:true}),
        Animated.spring(slideAnim,{toValue:0,tension:120,friction:10,useNativeDriver:true}),
      ]).start();
    }else{
      Animated.timing(fadeAnim,{toValue:0,duration:140,useNativeDriver:true}).start();
    }
  },[visible]);

  if(!visible)return null;

  return(
    <Animated.View style={[ss.wrap,{opacity:fadeAnim,transform:[{translateY:slideAnim}]}]}>
      {/* Flecha hacia arriba */}
      <View style={ss.arrowWrap}>
        <View style={[ss.arrow,ss.arrowSombra]}/>
        <View style={ss.arrow}/>
      </View>
      {/* Cuerpo */}
      <View style={ss.burbuja}>
        <View style={ss.fila}>
          <View style={ss.punto}/>
          <Text style={ss.txt}>Tocá <Text style={ss.negrita}>Editar perfil</Text> para completar tu CV y empezar a recibir ofertas</Text>
          <TouchableOpacity onPress={onDismiss} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Text style={ss.x}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const ARROW=10;

const ss=StyleSheet.create({
  wrap:{
    marginHorizontal:16,
    marginTop:2,
  },
  arrowWrap:{
    alignSelf:'center',
    marginLeft:-60,
    width:ARROW*2,
    height:ARROW,
    marginBottom:-1,
  },
  arrow:{
    position:'absolute',
    width:0,height:0,
    borderLeftWidth:ARROW,borderRightWidth:ARROW,borderBottomWidth:ARROW,
    borderLeftColor:'transparent',borderRightColor:'transparent',borderBottomColor:'#FFFFFF',
  },
  arrowSombra:{
    borderBottomColor:'#D8EEEC',
    top:1,
  },
  burbuja:{
    backgroundColor:'#FFFFFF',
    borderRadius:12,
    borderWidth:1,
    borderColor:'#D8EEEC',
    paddingHorizontal:14,
    paddingVertical:11,
    shadowColor:'#0F766E',
    shadowOffset:{width:0,height:3},
    shadowOpacity:0.08,
    shadowRadius:8,
    elevation:5,
  },
  fila:{
    flexDirection:'row',
    alignItems:'center',
    gap:10,
  },
  punto:{
    width:6,height:6,borderRadius:3,
    backgroundColor:'#2DD4BF',
    flexShrink:0,
  },
  txt:{
    flex:1,
    fontSize:12,
    color:'#5A4E6A',
    lineHeight:18,
  },
  negrita:{
    fontWeight:'800',
    color:'#0F766E',
  },
  x:{fontSize:13,color:'#B0C0C0'},
});
