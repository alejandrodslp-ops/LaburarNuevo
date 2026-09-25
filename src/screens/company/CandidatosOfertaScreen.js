import React,{useState,useEffect,useCallback}from 'react';
import{View,Text,ScrollView,TouchableOpacity,StyleSheet,ActivityIndicator}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{supabase}from '../../services/supabase';

function estrellas(r){
  const n=Math.round(r||0);
  return '★'.repeat(n)+'☆'.repeat(5-n);
}

// El plan "Sudamerica" ($12) solo debe mostrar candidatos de la region (Latam+Caribe,
// misma lista que crear-pago usa para el tramo de precio de creditos, y que
// BuscarEmpresaScreen.js reusa igual) — "Mundial" y "Premium" no tienen esta
// restriccion. Filtro de UI; el enforcement real vive en consumir_visualizacion_empresa().
const PAISES_SA_NOMBRES=new Set([
  'uruguay','argentina','brasil','brazil','chile','paraguay','bolivia',
  'peru','colombia','mexico','ecuador','venezuela','cuba','costa rica',
  'panama','guatemala','el salvador','honduras','nicaragua',
  'republica dominicana',
]);
function esPaisSudamerica(raw){
  const n=(raw||'')
    .replace(/^[^\p{L}]+/u,'').trim()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase();
  return PAISES_SA_NOMBRES.has(n);
}

function CandidatoCard({item,onPress}){
  const oficio=item.servicios?.[0]||item.profesiones?.[0]||'Profesional';
  const zona=[item.barrio,item.ciudad,item.pais].filter(Boolean)[0]||'—';
  const tags=[...(item.servicios||[]).slice(0,2),...(item.especialidades||[]).slice(0,1)];
  return(
    <TouchableOpacity style={ss.card} onPress={onPress} activeOpacity={0.85}>
      <View style={ss.cardHeader}>
        <View style={ss.avatar}><Text style={ss.avatarIcon}>👤</Text></View>
        <View style={ss.cardInfo}>
          <Text style={ss.cardNombre}>{item.nombre||'Trabajador'}</Text>
          <Text style={ss.cardOficio}>{oficio}</Text>
          <Text style={ss.cardZona}>📍 {zona}</Text>
        </View>
        {item._match_score>=70&&(
          <View style={ss.matchBadge}><Text style={ss.matchTxt}>🎯 Buen match</Text></View>
        )}
      </View>
      <View style={ss.ratingRow}>
        <Text style={ss.stars}>{estrellas(item.rating)}</Text>
        <Text style={ss.ratingNum}>{(item.rating||0).toFixed(1)}</Text>
        <Text style={ss.ratingCount}>({item.total_valoraciones||0})</Text>
      </View>
      {tags.length>0&&(
        <View style={ss.tagsRow}>
          {tags.map((tag,i)=>(<View key={i} style={ss.tag}><Text style={ss.tagTxt}>{tag}</Text></View>))}
        </View>
      )}
    </TouchableOpacity>
  );
}

function LockedCard({onPress,suscripto}){
  return(
    <TouchableOpacity style={[ss.card,ss.lockedCard]} onPress={onPress} activeOpacity={0.9}>
      <View style={ss.lockedRow}>
        <View style={ss.lockCircle}><Text style={ss.lockIcon}>🔒</Text></View>
        <View style={{flex:1}}>
          <Text style={ss.lockTitle}>Perfil bloqueado</Text>
          <Text style={ss.lockSub}>{suscripto?'Volvé mañana o pasate a Premium':'Activá tu suscripción para ver este perfil'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CandidatosOfertaScreen({navigation,route}){
  const{ofertaId,titulo}=route.params||{};
  const[candidatos,setCandidatos]=useState([]);
  const[loading,setLoading]=useState(true);
  const[cupo,setCupo]=useState({restante_efectivo:0,suscripcion_activa:false,restante_semana:0});
  const[vistosIds,setVistosIds]=useState([]);

  const cargar=useCallback(async()=>{
    if(!ofertaId)return;
    setLoading(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;

      const[{data:matches},{data:cupoData},{data:vistos},{data:miPerfil}]=await Promise.all([
        supabase.from('oferta_matches').select('worker_id,score').eq('oferta_id',ofertaId).order('score',{ascending:false}),
        supabase.rpc('cupo_empresa_restante'),
        supabase.from('visualizaciones').select('worker_id').eq('employer_id',user.id),
        supabase.from('profiles').select('suscripcion_plan').eq('id',user.id).single(),
      ]);
      if(cupoData&&cupoData[0])setCupo(cupoData[0]);
      if(vistos)setVistosIds(vistos.map(v=>v.worker_id));
      const planSA=miPerfil?.suscripcion_plan==='membresia_sa';

      const workerIds=(matches||[]).map(m=>m.worker_id);
      if(workerIds.length===0){setCandidatos([]);return;}

      // oferta_matches.worker_id referencia profiles(id), no hay embed directo
      // posible con perfiles_publicos (es una vista) — se hace en 2 pasos, mismo
      // patron que notificar-matches-ofertas/index.ts.
      const{data:perfiles}=await supabase
        .from('perfiles_publicos')
        .select('id,nombre,apellido1,servicios,profesiones,especialidades,rating,estrellas,total_valoraciones,total_calificaciones,ciudad,barrio,pais,disponibilidad,referencias,fecha_nac,idiomas,tipos_empleo,bio,anios_experiencia,sueldo_pretension_min,sueldo_pretension_max,sueldo_moneda,updated_at,perfil_visible')
        .in('id',workerIds)
        .eq('rol','worker')
        .eq('perfil_activo',true);

      const scoreById=Object.fromEntries((matches||[]).map(m=>[m.worker_id,m.score]));
      let items=(perfiles||[])
        .map(p=>({...p,_match_score:scoreById[p.id]||0}))
        .sort((a,b)=>b._match_score-a._match_score);
      if(planSA)items=items.filter(p=>esPaisSudamerica(p.pais));
      setCandidatos(items);
    }catch(e){
      setCandidatos([]);
    }finally{
      setLoading(false);
    }
  },[ofertaId]);

  useEffect(()=>{cargar();},[cargar]);
  useEffect(()=>{const u=navigation.addListener('focus',cargar);return u;},[navigation,cargar]);

  function irAPerfil(item){
    navigation.navigate('PerfilTrabajador',{perfil:item});
  }

  function verPlanes(){
    navigation.navigate('BienvenidaEmpresa');
  }

  // Mismo cupo compartido con la busqueda manual (BuscarEmpresaScreen) — ver
  // un candidato desde aca consume el mismo cupo diario/semanal.
  const yaVistosIds=new Set(vistosIds);
  const nuevosDisponibles=cupo.restante_efectivo;
  let nuevosUsados=0;
  const visibles=candidatos.filter(item=>{
    if(yaVistosIds.has(item.id))return true;
    if(nuevosUsados<nuevosDisponibles){nuevosUsados++;return true;}
    return false;
  });
  const bloqueados=candidatos.length-visibles.length;

  return(
    <SafeAreaView style={ss.container} edges={['top']}>
      <View style={ss.header}>
        <TouchableOpacity onPress={()=>navigation.goBack()}>
          <Text style={ss.back}>Volver</Text>
        </TouchableOpacity>
        <Text style={ss.titulo}>Candidatos</Text>
        {titulo?<Text style={ss.sub} numberOfLines={1}>{titulo}</Text>:null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {bloqueados>0&&(
          <TouchableOpacity style={ss.gateBanner} onPress={verPlanes} activeOpacity={0.9}>
            <View style={{flex:1}}>
              <Text style={ss.gateTitle}>+{bloqueados} candidatos más disponibles</Text>
              <Text style={ss.gateSub}>
                {cupo.suscripcion_activa
                  ?(cupo.restante_efectivo===0
                      ?'Alcanzaste tus perfiles de hoy — volvé mañana o pasate a Premium para no tener tope'
                      :`Te quedan ${cupo.restante_efectivo} perfiles nuevos hoy, o pasate a Premium para no tener tope`)
                  :(cupo.restante_semana===0
                      ?'Volvé la próxima semana o activá tu suscripción'
                      :'Activá tu suscripción para ver más perfiles por día')}
              </Text>
            </View>
            <View style={ss.gateBtn}><Text style={ss.gateBtnTxt}>Ver planes →</Text></View>
          </TouchableOpacity>
        )}

        {loading?(
          <ActivityIndicator size="large" color="#3DA882" style={{marginTop:40}}/>
        ):(
          <View style={{paddingHorizontal:16,paddingTop:16,paddingBottom:32}}>
            {visibles.map(item=>(
              <CandidatoCard key={item.id} item={item} onPress={()=>irAPerfil(item)}/>
            ))}
            {bloqueados>0&&Array.from({length:Math.min(2,bloqueados)}).map((_,i)=>(
              <LockedCard key={'lock-'+i} onPress={verPlanes} suscripto={cupo.suscripcion_activa}/>
            ))}
            {candidatos.length===0&&!loading&&(
              <View style={ss.empty}>
                <Text style={ss.emptyIcon}>🕓</Text>
                <Text style={ss.emptyTit}>Todavía sin candidatos</Text>
                <Text style={ss.emptySub}>Te avisamos apenas encontremos trabajadores que encajen con esta búsqueda.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  container:{flex:1,backgroundColor:'#FBF8F4'},
  header:{backgroundColor:'#FFFFFF',paddingHorizontal:16,paddingTop:14,paddingBottom:14,borderBottomWidth:1,borderBottomColor:'#EDE8E2'},
  back:{fontSize:14,fontWeight:'700',color:'#E8785A',marginBottom:8},
  titulo:{fontSize:20,fontWeight:'900',color:'#1A1020'},
  sub:{fontSize:13,color:'#A898B8',marginTop:2},

  gateBanner:{flexDirection:'row',alignItems:'center',marginHorizontal:16,marginTop:16,marginBottom:0,backgroundColor:'#FFF8E6',borderRadius:14,padding:14,borderWidth:1.5,borderColor:'#F59E0B'},
  gateTitle:{fontSize:14,fontWeight:'800',color:'#1A1020',marginBottom:2},
  gateSub:{fontSize:12,color:'#5A4E6A'},
  gateBtn:{backgroundColor:'#F59E0B',borderRadius:8,paddingHorizontal:12,paddingVertical:8},
  gateBtnTxt:{color:'#FFFFFF',fontSize:12,fontWeight:'700'},

  card:{backgroundColor:'#FFFFFF',borderRadius:16,marginBottom:12,padding:16,borderWidth:1,borderColor:'#EDE8E2'},
  cardHeader:{flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:10},
  avatar:{width:50,height:50,borderRadius:25,backgroundColor:'#F2EDE6',alignItems:'center',justifyContent:'center',flexShrink:0},
  avatarIcon:{fontSize:22},
  cardInfo:{flex:1},
  cardNombre:{fontSize:16,fontWeight:'800',color:'#1A1020',marginBottom:2},
  cardOficio:{fontSize:14,color:'#3DA882',fontWeight:'600',marginBottom:3},
  cardZona:{fontSize:12,color:'#A898B8'},
  matchBadge:{backgroundColor:'#E6FBF5',paddingHorizontal:8,paddingVertical:4,borderRadius:8},
  matchTxt:{fontSize:11,color:'#3DA882',fontWeight:'700'},
  ratingRow:{flexDirection:'row',alignItems:'center',gap:4,marginBottom:8},
  stars:{fontSize:12,color:'#F59E0B'},
  ratingNum:{fontSize:13,fontWeight:'700',color:'#1A1020'},
  ratingCount:{fontSize:12,color:'#A898B8'},
  tagsRow:{flexDirection:'row',flexWrap:'wrap',gap:6},
  tag:{backgroundColor:'#F2EDE6',paddingHorizontal:10,paddingVertical:4,borderRadius:8},
  tagTxt:{fontSize:12,color:'#5A4E6A',fontWeight:'600'},

  lockedCard:{borderStyle:'dashed',borderColor:'#D0C8DC',backgroundColor:'#FAFAFA'},
  lockedRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:4},
  lockCircle:{width:44,height:44,borderRadius:22,backgroundColor:'#F2EDE6',alignItems:'center',justifyContent:'center'},
  lockIcon:{fontSize:20},
  lockTitle:{fontSize:14,fontWeight:'700',color:'#5A4E6A',marginBottom:3},
  lockSub:{fontSize:12,color:'#A898B8'},

  empty:{alignItems:'center',paddingVertical:60},
  emptyIcon:{fontSize:48,marginBottom:12},
  emptyTit:{fontSize:18,fontWeight:'800',color:'#1A1020',marginBottom:6},
  emptySub:{fontSize:14,color:'#A898B8',textAlign:'center',paddingHorizontal:20,lineHeight:20},
});
