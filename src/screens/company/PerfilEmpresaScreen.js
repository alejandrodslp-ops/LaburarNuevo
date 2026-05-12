import React,{useState,useEffect} from 'react';
import{View,Text,ScrollView,TouchableOpacity,StyleSheet,Alert,Share}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{LinearGradient}from 'expo-linear-gradient';
import{supabase}from '../../services/supabase';
import{useApp}from '../../services/AppContext';

function Fila({icono,titulo,subtitulo,onPress,peligro}){
  return(
    <TouchableOpacity style={ss.fila} onPress={onPress} activeOpacity={0.7}>
      <View style={ss.filaIzq}>
        <View style={[ss.filaIcono,peligro&&{backgroundColor:'#FEF2F2'}]}>
          <Text style={{fontSize:16}}>{icono}</Text>
        </View>
        <View style={{flex:1}}>
          <Text style={[ss.filaTitulo,peligro&&{color:'#EF4444'}]}>{titulo}</Text>
          {subtitulo?<Text style={ss.filaSub}>{subtitulo}</Text>:null}
        </View>
      </View>
      <Text style={ss.filaFlecha}>›</Text>
    </TouchableOpacity>
  );
}

function Sec({titulo,children}){
  return(
    <View style={ss.seccion}>
      {titulo?<Text style={ss.seccionTit}>{titulo}</Text>:null}
      <View style={ss.seccionCard}>{children}</View>
    </View>
  );
}

function Sep(){return <View style={ss.sep}/>;}

export default function PerfilEmpresaScreen({navigation}){
  const{suscripcionActiva}=useApp();
  const[empresa,setEmpresa]=useState({nombre:'',rubro:'',ciudad:'',pais:'',email:''});

  useEffect(()=>{cargar();},[]);

  async function cargar(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      const{data}=await supabase.from('profiles').select('*').eq('id',user.id).single();
      if(data){
        setEmpresa({
          nombre:data.nombre||'Mi Empresa',
          rubro:data.rubro||'',
          ciudad:data.ciudad||'',
          pais:data.pais||'',
          email:user.email||'',
        });
      }
    }catch(e){console.log(e);}
  }

  function cerrarSesion(){
    Alert.alert('Cerrar sesion','Estas seguro?',[
      {text:'Cancelar',style:'cancel'},
      {text:'Cerrar sesion',style:'destructive',onPress:async()=>{await supabase.auth.signOut();}},
    ]);
  }

  return(
    <SafeAreaView style={ss.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#1A1F3A','#2D3561']} style={ss.header}>
          <View style={ss.avatarWrap}>
            <View style={ss.avatar}><Text style={{fontSize:44}}>🏢</Text></View>
          </View>
          <Text style={ss.nombre}>{empresa.nombre}</Text>
          {empresa.rubro?<Text style={ss.rubro}>{empresa.rubro}</Text>:null}
          {empresa.ciudad?<Text style={ss.zona}>📍 {[empresa.ciudad,empresa.pais].filter(Boolean).join(', ')}</Text>:null}
          <View style={[ss.subBadge,{backgroundColor:suscripcionActiva?'#3DA882':'#E8785A'}]}>
            <Text style={ss.subBadgeTxt}>{suscripcionActiva?'✅ Suscripcion activa':'⚡ Sin suscripcion'}</Text>
          </View>
        </LinearGradient>

        {!suscripcionActiva&&(
          <View style={ss.activarWrap}>
            <TouchableOpacity style={ss.activarBtn} onPress={()=>navigation.getParent()?.navigate('BienvenidaEmpresa')}>
              <Text style={ss.activarTxt}>Ver planes y suscribirme</Text>
            </TouchableOpacity>
          </View>
        )}

        <Sec titulo="MI EMPRESA">
          <Fila icono="🏢" titulo="Datos de la empresa" subtitulo={empresa.email} onPress={()=>Alert.alert('Proximamente')}/>
          <Sep/>
          <Fila icono="📍" titulo="Ubicacion" subtitulo={[empresa.ciudad,empresa.pais].filter(Boolean).join(', ')||'No configurada'} onPress={()=>Alert.alert('Proximamente')}/>
          <Sep/>
          <Fila icono="🏷️" titulo="Rubro" subtitulo={empresa.rubro||'No configurado'} onPress={()=>Alert.alert('Proximamente')}/>
        </Sec>

        <Sec titulo="GENERAL">
          <Fila icono="📤" titulo="Compartir Nexu" subtitulo="Invita a otros empresarios" onPress={()=>Share.share({message:'Descarga Nexu!'})}/>
          <Sep/>
          <Fila icono="❓" titulo="Ayuda y soporte" onPress={()=>Alert.alert('Proximamente')}/>
          <Sep/>
          <Fila icono="📋" titulo="Terminos y Condiciones" onPress={()=>Alert.alert('Proximamente')}/>
          <Sep/>
          <Fila icono="🔒" titulo="Politica de Privacidad" onPress={()=>Alert.alert('Proximamente')}/>
        </Sec>

        <Sec titulo=""><Fila icono="🚪" titulo="Cerrar sesion" onPress={cerrarSesion} peligro/></Sec>

        <Text style={ss.version}>Nexu v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  container:{flex:1,backgroundColor:'#F2EDE6'},
  header:{alignItems:'center',paddingHorizontal:16,paddingTop:24,paddingBottom:32},
  avatarWrap:{marginBottom:16},
  avatar:{width:96,height:96,borderRadius:48,backgroundColor:'#2D3561',alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'rgba(255,255,255,0.25)'},
  nombre:{fontSize:24,fontWeight:'900',color:'#FFFFFF',letterSpacing:-0.5,marginBottom:4,textAlign:'center'},
  rubro:{fontSize:14,color:'rgba(255,255,255,0.6)',marginBottom:4,textAlign:'center'},
  zona:{fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:12},
  subBadge:{borderRadius:20,paddingHorizontal:16,paddingVertical:6},
  subBadgeTxt:{color:'#FFFFFF',fontSize:12,fontWeight:'700'},
  activarWrap:{paddingHorizontal:16,paddingTop:16},
  activarBtn:{backgroundColor:'#3DA882',borderRadius:12,paddingVertical:14,alignItems:'center'},
  activarTxt:{color:'#FFFFFF',fontSize:14,fontWeight:'700'},
  seccion:{paddingHorizontal:16,paddingTop:16},
  seccionTit:{fontSize:10,fontWeight:'700',color:'#A898B8',letterSpacing:1,marginBottom:4,marginLeft:4},
  seccionCard:{backgroundColor:'#FFFFFF',borderRadius:16,borderWidth:1,borderColor:'#EDE8E2',overflow:'hidden'},
  fila:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:14,paddingHorizontal:16},
  filaIzq:{flexDirection:'row',alignItems:'center',gap:12,flex:1},
  filaIcono:{width:34,height:34,borderRadius:8,backgroundColor:'#F2EDE6',alignItems:'center',justifyContent:'center'},
  filaTitulo:{fontSize:14,fontWeight:'600',color:'#1A1020',marginBottom:1},
  filaSub:{fontSize:12,color:'#A898B8'},
  filaFlecha:{fontSize:22,color:'#A898B8',fontWeight:'300'},
  sep:{height:1,backgroundColor:'#EDE8E2',marginLeft:62},
  version:{textAlign:'center',fontSize:10,color:'#D0C8DC',paddingVertical:32},
});
