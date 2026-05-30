import NexuWatermark from '../components/NexuWatermark';
import React,{useState,useEffect} from 'react';
import{View,Text,ScrollView,TouchableOpacity,TextInput,StyleSheet,ActivityIndicator,Keyboard}from'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{supabase}from '../services/supabase';
import{usuarioEnPeriodoPrueba}from '../services/config';
import{useI18n}from '../services/I18nContext';
import{trItem,SERVICIOS_TR,PROFESIONES_TR,DISPS_TR}from '../data/oficios';

const CATS_DEF=[
  {id:'Niñera',             emoji:'👶'},
  {id:'Limpieza del hogar', emoji:'🧹'},
  {id:'Plomero/a',          emoji:'🔧'},
  {id:'Electricista',       emoji:'⚡'},
  {id:'Jardinero/a',        emoji:'🌿'},
  {id:'Cocinero/a',         emoji:'🍳'},
  {id:'Albañil',            emoji:'🏗️'},
  {id:'Pintor/a',           emoji:'🖌️'},
  {id:'Cuidado de animales',emoji:'🐾'},
  {id:'Chofer particular',  emoji:'🚗'},
  {id:'Mucama',             emoji:'🏠'},
  {id:'Carpintero/a',       emoji:'🪵'},
  {id:'Mecanico/a',         emoji:'🔩'},
  {id:'Medico/a',           emoji:'🩺'},
  {id:'Abogado/a',          emoji:'⚖️'},
];

const FILTROS_DEF=[
  {id:'Montevideo',      key:'filtro_montevideo'},
  {id:'Con referencias', key:'filtro_referencias'},
  {id:'Mejor rating',    key:'filtro_rating'},
  {id:'Disponible ya',   key:'filtro_disponible'},
];

const SUGERENCIAS=['Niñera','Limpieza','Plomero','Electricista','Jardinero','Cocinero','Albañil','Pintor','Animales','Chofer','Mucama','Carpintero','Mecanico','Guardia','Sereno','Mozo','Repostero','Costurero','Peluquero','Esteticista','Mudanzas','Delivery','Medico','Abogado','Contador','Ingeniero','Arquitecto','Psicologo','Enfermero','Veterinario','Docente','Programador','Montevideo','Pocitos','Carrasco','Malvin','Buceo','Centro','Tres Cruces','Punta Carretas','Punta del Este','Las Piedras','Salto','Paysandu','Rivera','Colonia'];
const ZONAS=['Montevideo','Pocitos','Carrasco','Malvin','Buceo','Centro','Tres Cruces','Punta Carretas','Punta del Este','Las Piedras','Salto','Paysandu','Rivera','Colonia'];

function trCat(id,idioma){
  return trItem(SERVICIOS_TR,id,idioma)||trItem(PROFESIONES_TR,id,idioma)||id;
}

function estrellas(r){const n=Math.round(r||0);return'★'.repeat(n)+'☆'.repeat(5-n);}

function Card({item,onContactar}){
  const{t,idioma}=useI18n();
  const nombre=item.nombre||'Trabajador';
  const oficio=(item.servicios&&item.servicios[0])||(item.profesiones&&item.profesiones[0])||'Profesional';
  const zona=[item.barrio,item.ciudad].filter(Boolean).join(', ')||'Uruguay';
  const tags=[...(item.servicios||[]).slice(0,2),...(item.especialidades||[]).slice(0,1)];
  const dispTr=trItem(DISPS_TR,item.disponibilidad,idioma)||item.disponibilidad||t('a_convenir');
  return(
    <View style={ss.card}>
      <View style={ss.cardHeader}>
        <View style={ss.anonAv}><Text style={ss.anonIcon}>👤</Text></View>
        <View style={ss.cardInfo}>
          <Text style={ss.cardNombre}>{nombre}</Text>
          <Text style={ss.cardOficio}>{trCat(oficio,idioma)}</Text>
          <Text style={ss.cardZona}>📍 {zona}</Text>
        </View>
        {item.referencias&&<View style={ss.refBadge}><Text style={ss.refTxt}>✓ Ref</Text></View>}
      </View>
      <View style={ss.privaRow}>
        <Text style={ss.privaIcon}>🔒</Text>
        <Text style={ss.privaTxt}>{t('buscar_privacidad_match')}</Text>
      </View>
      <View style={ss.ratingRow}>
        <Text style={ss.stars}>{estrellas(item.rating)}</Text>
        <Text style={ss.ratingNum}>{item.rating||0}</Text>
        <Text style={ss.ratingCount}>({item.total_valoraciones||0} {t('valoraciones')})</Text>
        <Text style={ss.disponib}>● {dispTr}</Text>
      </View>
      {tags.length>0&&(
        <View style={ss.tagsRow}>
          {tags.map((tag,i)=>(<View key={i} style={ss.tag}><Text style={ss.tagTxt}>{trCat(tag,idioma)}</Text></View>))}
        </View>
      )}
      <TouchableOpacity style={ss.btnContactar} onPress={()=>onContactar(item)}>
        <Text style={ss.btnContactarTxt}>{t('buscar_ver_perfil')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function BuscarScreen({navigation}){
  const{t,idioma}=useI18n();
  const[catActiva,setCatActiva]=useState(null);
  const[enPrueba,setEnPrueba]=useState(true);
  const[filtrosActivos,setFiltrosActivos]=useState([]);
  const[busqueda,setBusqueda]=useState('');
  const[sugs,setSugs]=useState([]);
  const[resultados,setResultados]=useState([]);
  const[loading,setLoading]=useState(false);
  const[total,setTotal]=useState(0);
  const[visDisp,setVisDisp]=useState(0);

  const CATS=CATS_DEF.map(c=>({...c,label:trCat(c.id,idioma)}));
  const FILTROS=FILTROS_DEF.map(f=>({...f,label:t(f.key)}));

  useEffect(()=>{ejecutar('','',catActiva,filtrosActivos);},[catActiva,filtrosActivos]);

  useEffect(()=>{
    const unsub=navigation.addListener('focus',cargarVisDisp);
    cargarVisDisp();
    return unsub;
  },[navigation]);

  async function cargarVisDisp(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      const{data}=await supabase.from('profiles').select('visualizaciones_disponibles').eq('id',user.id).single();
      if(data){
        const dbVal=data.visualizaciones_disponibles??0;
        setVisDisp(prev=>Math.max(dbVal,prev));
      }
    }catch(e){}
  }

  useEffect(()=>{
    async function checkPrueba(){
      try{
        const{data:{user}}=await supabase.auth.getUser();
        if(!user)return;
        const ok=await usuarioEnPeriodoPrueba(user.id);
        setEnPrueba(ok);
      }catch(e){setEnPrueba(true);}
    }
    checkPrueba();
  },[]);

  function onTexto(txt){
    setBusqueda(txt);
    if(txt.length>1){setSugs(SUGERENCIAS.filter(s=>s.toLowerCase().includes(txt.toLowerCase())).slice(0,6));}
    else{setSugs([]);}
  }

  function onSug(sug){
    setSugs([]);setBusqueda(sug);Keyboard.dismiss();
    if(ZONAS.includes(sug)){ejecutar(sug,'',catActiva,filtrosActivos);}
    else{ejecutar('',sug,catActiva,filtrosActivos);}
  }

  function onSubmit(){setSugs([]);if(ZONAS.includes(busqueda)){ejecutar(busqueda,'',catActiva,filtrosActivos);}else{ejecutar('',busqueda,catActiva,filtrosActivos);}}
  function onLimpiar(){setBusqueda('');setSugs([]);ejecutar('','',catActiva,filtrosActivos);}
  function toggleFiltro(f){const n=filtrosActivos.includes(f)?filtrosActivos.filter(x=>x!==f):[...filtrosActivos,f];setFiltrosActivos(n);}

  async function ejecutar(zona,oficio,cat,filtros){
    setLoading(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      let yaVistos=[];
      if(user){
        const{data:vis}=await supabase.from('visualizaciones').select('worker_id').eq('employer_id',user.id);
        yaVistos=(vis||[]).map(v=>v.worker_id);
      }
      let q=supabase.from('profiles')
        .select('id,nombre,apellido1,servicios,profesiones,especialidades,rating,total_valoraciones,ciudad,barrio,pais,disponibilidad,referencias,fecha_nac,idiomas,tipos_empleo,bio,anios_experiencia,sueldo_pretension_min,sueldo_pretension_max,sueldo_moneda,updated_at,perfil_visible')
        .eq('perfil_activo',true)
        .neq('id',user.id)
        .order('rating',{ascending:false});
      if(yaVistos.length>0)q=q.not('id','in',`(${yaVistos.join(',')})`)
      if(cat)q=q.contains('servicios',[cat]);
      if(oficio&&oficio.trim()){q=q.contains('servicios',[oficio]);}
      else if(zona&&zona.trim()){q=q.or('ciudad.ilike.%'+zona.trim()+'%,barrio.ilike.%'+zona.trim()+'%');}
      if(filtros.includes('Montevideo'))q=q.eq('ciudad','Montevideo');
      if(filtros.includes('Con referencias'))q=q.eq('referencias',true);
      if(filtros.includes('Mejor rating'))q=q.gte('rating',4.5);
      if(filtros.includes('Disponible ya'))q=q.eq('disponibilidad','Inmediata');
      const{data,error}=await q.limit(20);
      if(error)throw error;
      setResultados(data||[]);setTotal((data||[]).length);
    }catch(e){console.log(e.message);setResultados([]);setTotal(0);}
    finally{setLoading(false);}
  }

  async function onContactar(item){
    setResultados(prev=>prev.filter(r=>r.id!==item.id));
    if(visDisp>0){
      setVisDisp(v=>v-1);
      navigation.navigate('PerfilTrabajador',{perfil:item});
      return;
    }
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      const{data}=await supabase.from('profiles').select('visualizaciones_disponibles').eq('id',user.id).single();
      const saldoDB=data?.visualizaciones_disponibles??0;
      if(saldoDB>0){
        setVisDisp(saldoDB-1);
        navigation.navigate('PerfilTrabajador',{perfil:item});
      }else{
        setResultados(prev=>[item,...prev]);
        navigation.navigate('Pago',{perfil:item,gratis:enPrueba});
      }
    }catch(e){
      navigation.navigate('PerfilTrabajador',{perfil:item});
    }
  }

  const catActivaLabel=catActiva?trCat(catActiva,idioma):null;

  return(
    <SafeAreaView style={ss.container} edges={['top']}>
      <NexuWatermark/>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={ss.searchHeader}>
          <View style={ss.saldoRow}>
            <Text style={ss.searchTitle}>{t('buscar_que_necesitas')}</Text>
            {visDisp>0&&(
              <View style={ss.saldoBadge}>
                <Text style={ss.saldoTxt}>{visDisp===1?t('buscar_saldo_uno'):t('buscar_saldo_n',{n:visDisp})}</Text>
              </View>
            )}
          </View>
          <Text style={ss.searchSub}>{t('buscar_sub_empleador')}</Text>
          <View style={ss.searchBox}>
            <Text style={{fontSize:18,marginRight:8}}>🔍</Text>
            <TextInput style={ss.searchInput} placeholder={t('buscar_placeholder_oficio')} placeholderTextColor="#A898B8" value={busqueda} onChangeText={onTexto} onSubmitEditing={onSubmit} returnKeyType="search"/>
            {busqueda.length>0&&<TouchableOpacity onPress={onLimpiar}><Text style={{fontSize:16,color:'#A898B8',marginLeft:8}}>✕</Text></TouchableOpacity>}
          </View>
          {sugs.length>0&&(<View style={ss.suggBox}>{sugs.map((s,i)=>(<TouchableOpacity key={i} style={ss.suggItem} onPress={()=>onSug(s)}><Text style={ss.suggTxt}>🔍 {s}</Text></TouchableOpacity>))}</View>)}
          <View style={ss.privaBanner}>
            <Text>🔒</Text>
            <Text style={ss.privaBannerTxt}>{t('buscar_anonimo_banner')}</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ss.catsScroll} contentContainerStyle={{paddingHorizontal:16,gap:8}}>
          <TouchableOpacity style={[ss.catBtn,catActiva===null&&ss.catBtnA]} onPress={()=>setCatActiva(null)}>
            <Text style={ss.catEmoji}>🔍</Text>
            <Text style={[ss.catLabel,catActiva===null&&ss.catLabelA]}>{t('todos')}</Text>
          </TouchableOpacity>
          {CATS.map(cat=>(
            <TouchableOpacity key={cat.id} style={[ss.catBtn,catActiva===cat.id&&ss.catBtnA]} onPress={()=>{setCatActiva(catActiva===cat.id?null:cat.id);Keyboard.dismiss();}}>
              <Text style={ss.catEmoji}>{cat.emoji}</Text>
              <Text style={[ss.catLabel,catActiva===cat.id&&ss.catLabelA]}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ss.chipsScroll} contentContainerStyle={{paddingHorizontal:16,gap:6}}>
          {FILTROS.map(f=>(
            <TouchableOpacity key={f.id} style={[ss.chip,filtrosActivos.includes(f.id)&&ss.chipA]} onPress={()=>toggleFiltro(f.id)}>
              <Text style={[ss.chipText,filtrosActivos.includes(f.id)&&ss.chipTextA]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {loading?(
          <View style={{padding:40,alignItems:'center'}}>
            <ActivityIndicator size="large" color="#2DD4BF"/>
            <Text style={{color:'#A898B8',marginTop:8}}>{t('buscar_buscando')}</Text>
          </View>
        ):(
          <View style={{paddingHorizontal:16}}>
            <Text style={ss.contador}>
              {total===1?t('buscar_un_resultado'):t('buscar_n_resultados',{n:total})}
              {catActivaLabel?' · '+catActivaLabel:''}
            </Text>
            {resultados.length===0?(
              <View style={ss.empty}>
                <Text style={{fontSize:48,marginBottom:12}}>🔍</Text>
                <Text style={ss.emptyTit}>{t('buscar_sin_res_tit')}</Text>
                <Text style={ss.emptySub}>{t('buscar_sin_res_sub')}</Text>
              </View>
            ):(
              resultados.map(r=>(<Card key={r.id} item={r} onContactar={onContactar}/>))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  container:{flex:1,backgroundColor:'#FBF8F4'},
  searchHeader:{backgroundColor:'#FFFFFF',padding:16,paddingTop:24,borderBottomWidth:1,borderBottomColor:'#EDE8E2'},
  saldoRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:4},
  searchTitle:{fontSize:26,fontWeight:'900',color:'#1A1020',letterSpacing:-0.5},
  saldoBadge:{backgroundColor:'#F0FDFA',borderRadius:20,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:'#2DD4BF'},
  saldoTxt:{fontSize:12,fontWeight:'700',color:'#2DD4BF'},
  searchSub:{fontSize:14,color:'#A898B8',marginBottom:12},
  searchBox:{backgroundColor:'#FBF8F4',borderWidth:1.5,borderColor:'#EDE8E2',borderRadius:12,padding:10,flexDirection:'row',alignItems:'center',marginBottom:10},
  searchInput:{flex:1,fontSize:14,color:'#1A1020'},
  suggBox:{backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#EDE8E2',borderRadius:10,marginBottom:10,overflow:'hidden'},
  suggItem:{paddingHorizontal:14,paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#EDE8E2'},
  suggTxt:{fontSize:14,color:'#1A1020'},
  privaBanner:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:'#F0FDFA',borderRadius:10,padding:10,borderLeftWidth:3,borderLeftColor:'#2DD4BF'},
  privaBannerTxt:{fontSize:12,color:'#2DD4BF',fontWeight:'600',flex:1,lineHeight:18},
  catsScroll:{paddingVertical:8},
  catBtn:{alignItems:'center',gap:4,minWidth:64,backgroundColor:'#FFFFFF',borderRadius:12,paddingVertical:8,paddingHorizontal:8,borderWidth:1.5,borderColor:'#EDE8E2'},
  catBtnA:{borderColor:'#2DD4BF',backgroundColor:'#F0FDFA'},
  catEmoji:{fontSize:22},catLabel:{fontSize:10,fontWeight:'700',color:'#A898B8',textAlign:'center'},catLabelA:{color:'#2DD4BF'},
  chipsScroll:{paddingVertical:4},
  chip:{paddingHorizontal:14,paddingVertical:6,backgroundColor:'#FFFFFF',borderWidth:1.5,borderColor:'#EDE8E2',borderRadius:999},
  chipA:{backgroundColor:'#2DD4BF',borderColor:'#2DD4BF'},chipText:{fontSize:12,fontWeight:'700',color:'#5A4E6A'},chipTextA:{color:'#FFFFFF'},
  contador:{paddingVertical:8,fontSize:12,fontWeight:'600',color:'#A898B8'},
  card:{backgroundColor:'#FFFFFF',borderRadius:16,marginBottom:12,padding:16,borderWidth:1,borderColor:'#EDE8E2'},
  cardHeader:{flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:10},
  anonAv:{width:52,height:52,borderRadius:26,backgroundColor:'#F2EDE6',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#EDE8E2',flexShrink:0},
  anonIcon:{fontSize:24,opacity:0.4},cardInfo:{flex:1},
  cardNombre:{fontSize:16,fontWeight:'900',color:'#1A1020',marginBottom:2},
  cardOficio:{fontSize:13,color:'#5A4E6A',marginBottom:2},cardZona:{fontSize:12,color:'#A898B8'},
  refBadge:{backgroundColor:'#E6FBF5',borderRadius:6,paddingHorizontal:8,paddingVertical:3},refTxt:{color:'#2E9472',fontSize:10,fontWeight:'700'},
  privaRow:{flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#F0FDFA',borderRadius:8,padding:8,marginBottom:10},
  privaIcon:{fontSize:12},privaTxt:{fontSize:11,color:'#2DD4BF',fontWeight:'600',flex:1},
  ratingRow:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:8,flexWrap:'wrap'},
  stars:{fontSize:12,color:'#F59E0B'},ratingNum:{fontSize:13,fontWeight:'800',color:'#1A1020'},
  ratingCount:{fontSize:11,color:'#A898B8'},disponib:{fontSize:11,color:'#3DA882',fontWeight:'600',marginLeft:'auto'},
  tagsRow:{flexDirection:'row',flexWrap:'wrap',gap:6,marginBottom:12},
  tag:{backgroundColor:'#E6FBF5',paddingHorizontal:8,paddingVertical:3,borderRadius:5},tagTxt:{color:'#2E9472',fontSize:10,fontWeight:'700'},
  btnContactar:{backgroundColor:'#2DD4BF',borderRadius:10,paddingVertical:10,alignItems:'center'},
  btnContactarTxt:{color:'#FFFFFF',fontSize:13,fontWeight:'700'},
  empty:{alignItems:'center',padding:40},emptyTit:{fontSize:18,fontWeight:'800',color:'#1A1020',marginBottom:6},
  emptySub:{fontSize:14,color:'#A898B8',textAlign:'center'},
});
