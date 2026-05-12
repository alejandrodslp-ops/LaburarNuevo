import React,{useState,useEffect} from 'react';
import{View,Text,ScrollView,TouchableOpacity,StyleSheet,ActivityIndicator}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{supabase}from '../../services/supabase';
import{useApp}from '../../services/AppContext';

function CardBloqueada(){
  return(
    <View style={ss.card}>
      <View style={ss.cardHeader}>
        <View style={ss.anonAv}><Text style={ss.anonIcon}>🔒</Text></View>
        <View style={ss.cardInfo}>
          <View style={ss.bloque}/>
          <View style={[ss.bloque,{width:"60%",marginTop:6}]}/>
          <View style={[ss.bloque,{width:"40%",marginTop:6,backgroundColor:"#EDE8E2"}]}/>
        </View>
      </View>
      <View style={ss.bloqueRow}>
        <Text style={ss.bloqueTxt}>🔒 Suscribite para ver este perfil completo</Text>
      </View>
      <View style={ss.ratingRow}>
        <Text style={ss.stars}>★★★★★</Text>
        <View style={[ss.bloque,{width:30,marginLeft:6}]}/>
      </View>
    </View>
  );
}

export default function BuscarEmpresaScreen({navigation}){
  const{suscripcionActiva}=useApp();
  const[resultados,setResultados]=useState([]);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{cargar();},[]);

  async function cargar(){
    try{
      const{data}=await supabase.from('profiles')
        .select('id')
        .eq('perfil_activo',true)
        .limit(6);
      setResultados(data||[]);
    }catch(e){setResultados([]);}
    finally{setLoading(false);}
  }

  return(
    <SafeAreaView style={ss.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={ss.header}>
          <Text style={ss.titulo}>Vista previa</Text>
          <Text style={ss.sub}>Asi se ven los perfiles de trabajadores en Nexu</Text>
        </View>
        <View style={ss.banner}>
          <Text style={ss.bannerEmoji}>🔒</Text>
          <View style={{flex:1}}>
            <Text style={ss.bannerTit}>Activa tu suscripcion</Text>
            <Text style={ss.bannerDesc}>Para ver perfiles completos y contactar trabajadores necesitas una suscripcion activa.</Text>
          </View>
          <TouchableOpacity style={ss.bannerBtn} onPress={()=>navigation.getParent()?.navigate('BienvenidaEmpresa')}>
            <Text style={ss.bannerBtnTxt}>Ver planes</Text>
          </TouchableOpacity>
        </View>
        <View style={{paddingHorizontal:16}}>
          {loading
            ?<ActivityIndicator size="large" color="#3DA882" style={{marginTop:40}}/>
            :resultados.map((_,i)=><CardBloqueada key={i}/>)
          }
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  container:{flex:1,backgroundColor:'#FBF8F4'},
  header:{backgroundColor:'#FFFFFF',padding:16,paddingTop:24,borderBottomWidth:1,borderBottomColor:'#EDE8E2'},
  titulo:{fontSize:24,fontWeight:'900',color:'#1A1020',marginBottom:4},
  sub:{fontSize:14,color:'#A898B8'},
  banner:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#E6FBF5',margin:16,borderRadius:14,padding:14,borderWidth:1.5,borderColor:'#3DA882'},
  bannerEmoji:{fontSize:28},
  bannerTit:{fontSize:14,fontWeight:'800',color:'#1A1020',marginBottom:3},
  bannerDesc:{fontSize:12,color:'#5A4E6A',lineHeight:17},
  bannerBtn:{backgroundColor:'#3DA882',borderRadius:8,paddingHorizontal:12,paddingVertical:8},
  bannerBtnTxt:{color:'#FFFFFF',fontSize:12,fontWeight:'700'},
  card:{backgroundColor:'#FFFFFF',borderRadius:16,marginBottom:12,padding:16,borderWidth:1,borderColor:'#EDE8E2'},
  cardHeader:{flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:10},
  anonAv:{width:52,height:52,borderRadius:26,backgroundColor:'#F2EDE6',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#EDE8E2',flexShrink:0},
  anonIcon:{fontSize:24},
  cardInfo:{flex:1,justifyContent:'center'},
  bloque:{height:14,backgroundColor:'#D0C8DC',borderRadius:6,width:'80%'},
  bloqueRow:{backgroundColor:'#F0FDFA',borderRadius:8,padding:10,marginBottom:10},
  bloqueTxt:{fontSize:12,color:'#2DD4BF',fontWeight:'600'},
  ratingRow:{flexDirection:'row',alignItems:'center'},
  stars:{fontSize:12,color:'#F59E0B'},
});
