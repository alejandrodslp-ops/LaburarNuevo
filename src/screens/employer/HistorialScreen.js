import React,{useState,useEffect} from 'react';
import {logError} from '../../services/logError';
import{View,Text,ScrollView,TouchableOpacity,StyleSheet,ActivityIndicator}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{supabase}from '../../services/supabase';

const LIMITE_DIAS=30;

function calcularEdad(fechaNac){
  if(!fechaNac)return null;
  const p=fechaNac.split('/');
  if(p.length!==3)return null;
  const nac=new Date(p[2],p[1]-1,p[0]);
  const hoy=new Date();
  let edad=hoy.getFullYear()-nac.getFullYear();
  const m=hoy.getMonth()-nac.getMonth();
  if(m<0||(m===0&&hoy.getDate()<nac.getDate()))edad--;
  return edad;
}

function diasRestantes(fechaVis){
  if(!fechaVis)return LIMITE_DIAS;
  const diff=Math.ceil((new Date(fechaVis).getTime()+LIMITE_DIAS*86400000-Date.now())/86400000);
  return Math.max(0,diff);
}

function estrellas(r){const n=Math.round(r||0);return '★'.repeat(n)+'☆'.repeat(5-n);}

export default function HistorialScreen({navigation}){
  const[conectados,setConectados]=useState([]);
  const[recientes,setRecientes]=useState([]);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    cargar();
    const unsub=navigation.addListener('focus',cargar);
    return unsub;
  },[navigation]);

  async function cargar(){
    setLoading(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;

      // 1. Todas las visualizaciones del empleador
      const{data:vis,error:e1}=await supabase
        .from('visualizaciones')
        .select('worker_id, created_at')
        .eq('employer_id',user.id)
        .order('created_at',{ascending:false});

      if(e1){
        logError('Historial.visualizaciones',e1);
        return;
      }
      if(!vis||vis.length===0){
        setConectados([]);setRecientes([]);return;
      }

      // 2. Propuestas aceptadas de este empleador
      const{data:aceptadas}=await supabase
        .from('propuestas')
        .select('worker_id')
        .eq('employer_id',user.id)
        .eq('estado','aceptada');
      const aceptadasSet=new Set((aceptadas||[]).map(a=>a.worker_id));

      // 3. Filtrar: dentro de 30 días O propuesta aceptada
      const hace30=new Date(Date.now()-LIMITE_DIAS*86400000);
      const validas=vis.filter(v=>{
        const reciente=v.created_at?new Date(v.created_at)>=hace30:true;
        return reciente||aceptadasSet.has(v.worker_id);
      });

      if(validas.length===0){
        setConectados([]);setRecientes([]);return;
      }

      // 4. Perfiles de los trabajadores válidos
      const workerIds=validas.map(v=>v.worker_id);
      const{data:perfiles,error:e2}=await supabase
        .from('profiles')
        .select('id,nombre,apellido1,fecha_nac,ciudad,pais,servicios,profesiones,disponibilidad,rating,total_valoraciones,referencias,anios_experiencia,perfil_visible')
        .in('id',workerIds);

      if(e2)logError('Historial.perfiles',e2);

      const pm={};
      (perfiles||[]).forEach(p=>{pm[p.id]=p;});

      // 5. Separar en dos listas
      const listaConectados=[];
      const listaRecientes=[];

      for(const v of validas){
        const p=pm[v.worker_id];
        if(!p)continue;
        if(aceptadasSet.has(v.worker_id)){
          listaConectados.push({perfil:p,fecha:v.created_at});
        }else{
          listaRecientes.push({perfil:p,fecha:v.created_at,diasRestantes:diasRestantes(v.created_at)});
        }
      }

      setConectados(listaConectados);
      setRecientes(listaRecientes);
    }catch(e){logError('Historial',e);}
    finally{setLoading(false);}
  }

  const total=conectados.length+recientes.length;

  return(
    <SafeAreaView style={ss.c} edges={['top']}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={()=>navigation.goBack()}>
          <Text style={ss.back}>Volver</Text>
        </TouchableOpacity>
        <Text style={ss.htit}>Perfiles vistos</Text>
        <View style={{width:50}}/>
      </View>
      <ScrollView contentContainerStyle={{paddingBottom:40}} showsVerticalScrollIndicator={false}>
        {loading?(
          <ActivityIndicator size="large" color="#2DD4BF" style={{marginTop:40}}/>
        ):total===0?(
          <View style={ss.empty}>
            <Text style={{fontSize:48,marginBottom:12}}>📋</Text>
            <Text style={ss.emptyTit}>Sin historial</Text>
            <Text style={ss.emptySub}>Los perfiles que desbloquees apareceran aqui durante 30 dias.</Text>
          </View>
        ):(
          <>
            {conectados.length>0&&(
              <View style={ss.section}>
                <Text style={ss.sectionTit}>CONEXIONES ACTIVAS</Text>
                <Text style={ss.sectionSub}>El trabajador aceptó tu propuesta · sin vencimiento</Text>
                {conectados.map((h,i)=><CardPerfil key={'c'+i} h={h} tipo="conectado" navigation={navigation}/>)}
              </View>
            )}
            {recientes.length>0&&(
              <View style={ss.section}>
                <Text style={ss.sectionTit}>PERFILES VISTOS</Text>
                <Text style={ss.sectionSub}>Disponibles {LIMITE_DIAS} días · si no responden, la comunicación se cierra</Text>
                {recientes.map((h,i)=><CardPerfil key={'r'+i} h={h} tipo="reciente" navigation={navigation}/>)}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CardPerfil({h,tipo,navigation}){
  const p=h.perfil;
  const edad=calcularEdad(p.fecha_nac);
  const oficio=p.servicios?.[0]||p.profesiones?.[0]||'';
  const conectado=tipo==='conectado';
  const dr=h.diasRestantes;

  return(
    <TouchableOpacity style={[ss.card,conectado&&ss.cardConectado]} onPress={()=>navigation.navigate('PerfilTrabajador',{perfil:p})}>
      <View style={ss.cardHeader}>
        <View style={[ss.avatar,conectado&&ss.avatarConectado]}><Text style={{fontSize:24}}>👤</Text></View>
        <View style={{flex:1}}>
          <Text style={ss.nombre}>{p.nombre}{edad?' · '+edad+' años':''}</Text>
          <Text style={ss.oficio}>{oficio}</Text>
          <Text style={ss.zona}>📍 {[p.ciudad,p.pais].filter(Boolean).join(', ')}</Text>
        </View>
        {conectado
          ?<View style={ss.badgeConectado}><Text style={ss.badgeConectadoTxt}>✓ Conectado</Text></View>
          :p.referencias&&<View style={ss.ref}><Text style={ss.refTxt}>✓ Ref</Text></View>
        }
      </View>
      <View style={ss.cardFooter}>
        <Text style={ss.stars}>{estrellas(p.rating)}</Text>
        <Text style={ss.rating}>{p.rating||0}</Text>
        {conectado
          ?<Text style={ss.venceConectado}>Sin vencimiento</Text>
          :<Text style={[ss.vence,dr<=5&&ss.venceUrgente]}>
            {dr===0?'Vence hoy':dr===1?'Vence mañana':'Vence en '+dr+' días'}
          </Text>
        }
      </View>
    </TouchableOpacity>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:'#FBF8F4'},
  hdr:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:14,backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#EDE8E2'},
  back:{fontSize:14,fontWeight:'700',color:'#2DD4BF'},
  htit:{fontSize:16,fontWeight:'800',color:'#1A1020'},
  section:{paddingHorizontal:16,paddingTop:20},
  sectionTit:{fontSize:10,fontWeight:'700',color:'#A898B8',letterSpacing:1,marginBottom:4},
  sectionSub:{fontSize:11,color:'#A898B8',marginBottom:12,lineHeight:16},
  card:{backgroundColor:'#FFFFFF',borderRadius:14,marginBottom:10,padding:14,borderWidth:1,borderColor:'#EDE8E2'},
  cardConectado:{borderColor:'#3DA882',backgroundColor:'#F6FEF9'},
  cardHeader:{flexDirection:'row',gap:12,marginBottom:10},
  avatar:{width:48,height:48,borderRadius:24,backgroundColor:'#F2EDE6',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#EDE8E2'},
  avatarConectado:{borderColor:'#3DA882',backgroundColor:'#E6FBF5'},
  nombre:{fontSize:15,fontWeight:'800',color:'#1A1020',marginBottom:2},
  oficio:{fontSize:13,color:'#5A4E6A',marginBottom:2},
  zona:{fontSize:12,color:'#A898B8'},
  ref:{backgroundColor:'#E6FBF5',borderRadius:6,paddingHorizontal:8,paddingVertical:3,alignSelf:'flex-start'},
  refTxt:{color:'#2E9472',fontSize:10,fontWeight:'700'},
  badgeConectado:{backgroundColor:'#E6FBF5',borderRadius:8,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:'#3DA882'},
  badgeConectadoTxt:{color:'#2E9472',fontSize:11,fontWeight:'800'},
  cardFooter:{flexDirection:'row',alignItems:'center',gap:6},
  stars:{fontSize:12,color:'#F59E0B'},
  rating:{fontSize:13,fontWeight:'700',color:'#1A1020'},
  vence:{fontSize:11,color:'#A898B8',marginLeft:'auto'},
  venceUrgente:{color:'#E8785A',fontWeight:'700'},
  venceConectado:{fontSize:11,color:'#3DA882',fontWeight:'600',marginLeft:'auto'},
  empty:{alignItems:'center',padding:48},
  emptyTit:{fontSize:18,fontWeight:'800',color:'#1A1020',marginBottom:6},
  emptySub:{fontSize:14,color:'#A898B8',textAlign:'center',lineHeight:20},
});
