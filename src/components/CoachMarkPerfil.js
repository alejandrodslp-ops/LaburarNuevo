import React,{useEffect,useRef} from 'react';
import{View,Text,TouchableOpacity,StyleSheet,Animated}from 'react-native';

export default function CoachMarkPerfil({visible,onDismiss,onIrACuenta}){
  const fadeAnim=useRef(new Animated.Value(0)).current;
  const slideAnim=useRef(new Animated.Value(-8)).current;

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
      <View style={ss.burbuja}>
        <View style={ss.fila}>
          <View style={ss.punto}/>
          <Text style={ss.txt}>
            Completá tu perfil para empezar a recibir{' '}
            <Text style={ss.negrita}>propuestas de trabajo</Text>
          </Text>
          <TouchableOpacity onPress={onDismiss} hitSlop={{top:10,bottom:10,left:10,right:10}}>
            <Text style={ss.x}>✕</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={ss.btn} onPress={onIrACuenta} activeOpacity={0.8}>
          <Text style={ss.btnTxt}>Ir a mi perfil →</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const ss=StyleSheet.create({
  wrap:{
    marginHorizontal:16,
    marginTop:8,
  },
  burbuja:{
    backgroundColor:'#FFFFFF',
    borderRadius:12,
    borderWidth:1,
    borderColor:'#D8EEEC',
    paddingHorizontal:14,
    paddingVertical:12,
    shadowColor:'#0F766E',
    shadowOffset:{width:0,height:3},
    shadowOpacity:0.08,
    shadowRadius:8,
    elevation:5,
    gap:10,
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
  btn:{
    backgroundColor:'#0F766E',
    borderRadius:8,
    paddingVertical:8,
    alignItems:'center',
  },
  btnTxt:{
    color:'#FFFFFF',
    fontSize:13,
    fontWeight:'700',
  },
});
