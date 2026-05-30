import React,{useState,useEffect,useCallback}from 'react';
import NexuWatermark from '../../components/NexuWatermark';
import{View,Text,StyleSheet,TouchableOpacity,FlatList,ActivityIndicator,Alert,Switch}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{supabase}from '../../services/supabase';

const C={coral:'#E8785A',teal:'#2DD4BF',blanco:'#FFFFFF',crema:'#FBF8F4',borde:'#EDE8E2',texto1:'#1A1020',texto2:'#5A4E6A',texto3:'#A898B8'};

function formatFecha(iso){
  if(!iso)return null;
  const d=new Date(iso);
  return d.toLocaleDateString('es-UY',{day:'2-digit',month:'2-digit',year:'2-digit'});
}

function OfertaCard({oferta,onPress,onToggle}){
  const activa=oferta.activa;
  return(
    <TouchableOpacity style={ss.card} onPress={onPress} activeOpacity={0.8}>
      <View style={ss.cardTop}>
        <View style={ss.cardLeft}>
          <Text style={ss.cardTitulo} numberOfLines={2}>{oferta.titulo}</Text>
          {oferta.cargo?<Text style={ss.cardCargo}>{oferta.cargo}</Text>:null}
        </View>
        <Switch
          value={activa}
          onValueChange={()=>onToggle(oferta)}
          trackColor={{false:'#EDE8E2',true:'#B8EDE8'}}
          thumbColor={activa?C.teal:'#A898B8'}
        />
      </View>
      <View style={ss.cardMeta}>
        {oferta.ciudad?<Text style={ss.metaTag}>📍 {oferta.ciudad}</Text>:null}
        {oferta.modalidad?<Text style={ss.metaTag}>{oferta.modalidad==='remoto'?'💻':oferta.modalidad==='hibrido'?'🔄':'🏢'} {oferta.modalidad}</Text>:null}
        {oferta.tipo_contrato?<Text style={ss.metaTag}>📋 {oferta.tipo_contrato.replace('_',' ')}</Text>:null}
      </View>
      <View style={ss.cardFooter}>
        <Text style={ss.statTxt}>👁 {oferta.vistas} vistas</Text>
        <Text style={ss.statTxt}>✉️ {oferta.postulaciones} contactos</Text>
        {oferta.fecha_cierre?<Text style={ss.statTxt}>⏳ Cierra {formatFecha(oferta.fecha_cierre)}</Text>:null}
        <View style={[ss.badge,activa?ss.badgeOn:ss.badgeOff]}>
          <Text style={[ss.badgeTxt,activa?ss.badgeTxtOn:ss.badgeTxtOff]}>{activa?'Activa':'Inactiva'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function OfertasEmpleadorScreen({navigation}){
  const[ofertas,setOfertas]=useState([]);
  const[loading,setLoading]=useState(true);

  const cargar=useCallback(async()=>{
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      const{data}=await supabase
        .from('ofertas')
        .select('*')
        .eq('employer_id',user.id)
        .order('created_at',{ascending:false});
      setOfertas(data||[]);
    }catch(e){console.log(e);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{cargar();},[cargar]);
  useEffect(()=>{const u=navigation.addListener('focus',cargar);return u;},[navigation,cargar]);

  async function toggleActiva(oferta){
    const nueva=!oferta.activa;
    setOfertas(prev=>prev.map(o=>o.id===oferta.id?{...o,activa:nueva}:o));
    const{error}=await supabase.from('ofertas').update({activa:nueva}).eq('id',oferta.id);
    if(error){
      setOfertas(prev=>prev.map(o=>o.id===oferta.id?{...o,activa:oferta.activa}:o));
      Alert.alert('Error','No se pudo actualizar la oferta.');
    }
  }

  function irACrear(){navigation.navigate('CrearOferta',{oferta:null});}
  function irAEditar(oferta){navigation.navigate('CrearOferta',{oferta});}

  return(
    <SafeAreaView style={ss.c} edges={['top']}>
      <NexuWatermark/>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={()=>navigation.goBack()}>
          <Text style={ss.back}>Volver</Text>
        </TouchableOpacity>
        <Text style={ss.htit}>Mis Ofertas</Text>
        <TouchableOpacity style={ss.addBtn} onPress={irACrear}>
          <Text style={ss.addTxt}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {loading?(
        <ActivityIndicator size="large" color={C.coral} style={{marginTop:40}}/>
      ):ofertas.length===0?(
        <View style={ss.empty}>
          <Text style={{fontSize:48,marginBottom:12}}>📋</Text>
          <Text style={ss.emptyTit}>Sin ofertas publicadas</Text>
          <Text style={ss.emptySub}>Publicá tu primera oferta y llegá a cientos de trabajadores calificados.</Text>
          <TouchableOpacity style={ss.emptyBtn} onPress={irACrear}>
            <Text style={ss.emptyBtnTxt}>Publicar oferta</Text>
          </TouchableOpacity>
        </View>
      ):(
        <FlatList
          data={ofertas}
          keyExtractor={o=>o.id}
          renderItem={({item})=><OfertaCard oferta={item} onPress={()=>irAEditar(item)} onToggle={toggleActiva}/>}
          contentContainerStyle={{padding:16,paddingBottom:32}}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:'#FBF8F4'},
  hdr:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:14,backgroundColor:C.blanco,borderBottomWidth:1,borderBottomColor:C.borde},
  back:{fontSize:14,fontWeight:'700',color:C.coral},
  htit:{fontSize:16,fontWeight:'800',color:C.texto1},
  addBtn:{backgroundColor:C.coral,borderRadius:20,paddingHorizontal:14,paddingVertical:7},
  addTxt:{color:C.blanco,fontSize:13,fontWeight:'700'},
  card:{backgroundColor:C.blanco,borderRadius:16,padding:16,marginBottom:12,borderWidth:1,borderColor:C.borde},
  cardTop:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',marginBottom:8},
  cardLeft:{flex:1,marginRight:12},
  cardTitulo:{fontSize:16,fontWeight:'800',color:C.texto1,lineHeight:22},
  cardCargo:{fontSize:12,color:C.texto3,marginTop:2,fontWeight:'600'},
  cardMeta:{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:10},
  metaTag:{fontSize:11,color:C.texto2,backgroundColor:'#F2EDE6',borderRadius:8,paddingHorizontal:8,paddingVertical:3,fontWeight:'600'},
  cardFooter:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:10},
  statTxt:{fontSize:11,color:C.texto3,fontWeight:'500'},
  badge:{borderRadius:8,paddingHorizontal:8,paddingVertical:3},
  badgeOn:{backgroundColor:'#E6FBF5'},badgeOff:{backgroundColor:'#F2EDE6'},
  badgeTxt:{fontSize:10,fontWeight:'700'},
  badgeTxtOn:{color:'#2E9472'},badgeTxtOff:{color:C.texto3},
  empty:{flex:1,alignItems:'center',justifyContent:'center',padding:40},
  emptyTit:{fontSize:18,fontWeight:'800',color:C.texto1,marginBottom:8,textAlign:'center'},
  emptySub:{fontSize:14,color:C.texto3,textAlign:'center',lineHeight:20,marginBottom:24},
  emptyBtn:{backgroundColor:C.coral,borderRadius:14,paddingHorizontal:24,paddingVertical:14},
  emptyBtnTxt:{color:C.blanco,fontSize:15,fontWeight:'800'},
});
