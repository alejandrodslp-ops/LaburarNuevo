import React,{useState,useEffect} from 'react';
import{View,Text,ScrollView,TouchableOpacity,StyleSheet,Alert}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{LinearGradient}from 'expo-linear-gradient';
import{supabase}from '../../services/supabase';

function calcularActividad(updatedAt){
  if(!updatedAt)return null;
  const dias=Math.floor((new Date()-new Date(updatedAt))/(1000*60*60*24));
  if(dias===0)return 'Activo hoy';
  if(dias===1)return 'Activo ayer';
  if(dias<7)return 'Activo hace '+dias+' dias';
  if(dias<30)return 'Activo hace '+Math.floor(dias/7)+' semanas';
  return 'Activo hace '+Math.floor(dias/30)+' meses';
}

function calcularEdad(fechaNac){
  if(!fechaNac)return null;
  const parts=fechaNac.split('/');
  if(parts.length!==3)return null;
  const nac=new Date(parts[2],parts[1]-1,parts[0]);
  const hoy=new Date();
  let edad=hoy.getFullYear()-nac.getFullYear();
  const m=hoy.getMonth()-nac.getMonth();
  if(m<0||(m===0&&hoy.getDate()<nac.getDate()))edad--;
  return edad;
}

function estrellas(r){
  const n=Math.round(r||0);
  return '★'.repeat(n)+'☆'.repeat(5-n);
}

export default function PerfilTrabajadorScreen({navigation,route}){
  const{perfil}=route.params||{};
  const[enviando,setEnviando]=useState(false);
  const[enviado,setEnviado]=useState(false);
  const[visDisp,setVisDisp]=useState(0);

  useEffect(()=>{
    registrarVisualizacion();
    cargarVisualizaciones();
  },[]);

  async function cargarVisualizaciones(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      const{data}=await supabase.from('profiles').select('visualizaciones_disponibles').eq('id',user.id).single();
      if(data)setVisDisp(data.visualizaciones_disponibles||0);
    }catch(e){}
  }

  async function registrarVisualizacion(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user||!perfil?.id)return;

      // Si ya fue registrada esta visualización (ej: viene del historial), no cobrar de nuevo
      const{data:existente}=await supabase
        .from('visualizaciones')
        .select('employer_id')
        .eq('employer_id',user.id)
        .eq('worker_id',perfil.id)
        .maybeSingle();
      if(existente)return;

      await supabase.from('visualizaciones').insert({employer_id:user.id,worker_id:perfil.id});
      await supabase.rpc('sumar_visualizaciones',{employer_id:user.id,cantidad:-1});
      const{data:w}=await supabase.from('profiles').select('vistas').eq('id',perfil.id).single();
      await supabase.from('profiles').update({vistas:(w?.vistas||0)+1}).eq('id',perfil.id);
    }catch(e){}
  }

  const edad=calcularEdad(perfil?.fecha_nac);
  const servicios=(perfil?.servicios||[]).slice(0,4);
  const actividad=calcularActividad(perfil?.updated_at);
  const aniosExp=perfil?.anios_experiencia;
  const sueldoMin=perfil?.sueldo_pretension_min;
  const sueldoMax=perfil?.sueldo_pretension_max;
  const sueldoMoneda=perfil?.sueldo_moneda||'USD';
  const profesiones=(perfil?.profesiones||[]).slice(0,2);
  const idiomas=(perfil?.idiomas||[]);
  const disponibilidad=perfil?.disponibilidad||'A convenir';
  const tipos=(perfil?.tipos_empleo||[]);

  async function enviarInteres(){
    setEnviando(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;

      // Cargar datos del perfil del empleador
      const{data:empProfile}=await supabase.from('profiles')
        .select('nombre,apellido1')
        .eq('id',user.id).single();
      const empleadorNombre=empProfile
        ?(empProfile.apellido1?`${empProfile.nombre} ${empProfile.apellido1[0]}.`:empProfile.nombre)
        :'Empleador';

      // Cargar oferta más reciente del empleador
      const{data:ofertas}=await supabase.from('ofertas')
        .select('titulo,empleo,lugar,carga_horaria,sueldo_tipo,sueldo_min,sueldo_max,descripcion')
        .eq('employer_id',user.id)
        .order('created_at',{ascending:false})
        .limit(1);
      const ofertaSnapshot=ofertas?.[0]||null;

      // Crear propuesta
      const{error}=await supabase.from('propuestas').insert({
        employer_id:user.id,
        worker_id:perfil.id,
        employer_nombre:empleadorNombre,
        oferta:ofertaSnapshot,
        estado:'pendiente',
      });
      if(error)throw error;

      // Incrementar contactos en el perfil del trabajador
      const{data:w}=await supabase.from('profiles').select('contactos').eq('id',perfil.id).single();
      await supabase.from('profiles').update({contactos:(w?.contactos||0)+1}).eq('id',perfil.id);

      // Notificar al trabajador por push
      supabase.functions.invoke('notificar-propuesta',{
        body:{worker_id:perfil.id,employer_nombre:empleadorNombre},
      }).catch(()=>{});

      setEnviado(true);
      Alert.alert(
        'Propuesta enviada',
        'El trabajador ahora tiene acceso a tu publicación laboral y podrá ponerse en contacto.',
        [{text:'Seguir buscando',onPress:()=>navigation.goBack()}]
      );
    }catch(e){
      Alert.alert('Error al enviar',e?.message||e?.toString()||'Error desconocido');
    }finally{setEnviando(false);}
  }

  return(
    <SafeAreaView style={ss.c} edges={['top']}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={()=>navigation.goBack()}>
          <Text style={ss.back}>Volver</Text>
        </TouchableOpacity>
        <Text style={ss.htit}>Perfil del trabajador</Text>
        <View style={{width:50}}/>
      </View>
      <ScrollView contentContainerStyle={{paddingBottom:48}} showsVerticalScrollIndicator={false}>

        <LinearGradient colors={['#1C2E2C','#0E1E1C']} style={ss.hero}>
          <View style={ss.avatar}><Text style={{fontSize:40}}>👤</Text></View>
          <Text style={ss.nombre}>{perfil?.nombre||'Trabajador'}</Text>
          {edad&&<Text style={ss.sub}>{edad} años · {perfil?.ciudad||''}</Text>}
          <View style={ss.ratingRow}>
            <Text style={ss.stars}>{estrellas(perfil?.rating)}</Text>
            <Text style={ss.ratingNum}>{perfil?.rating||0}</Text>
            <Text style={ss.ratingCount}>({perfil?.total_valoraciones||0} valoraciones)</Text>
          </View>
          {perfil?.referencias&&(
            <View style={ss.refBadge}><Text style={ss.refTxt}>✓ Tiene referencias laborales</Text></View>
          )}
          {actividad&&<Text style={ss.actividad}>🟢 {actividad}</Text>}
        </LinearGradient>

        <View style={ss.sec}>
          <Text style={ss.stit}>DISPONIBILIDAD</Text>
          <View style={ss.card}>
            <View style={ss.row}>
              <Text style={ss.rowIcon}>📅</Text>
              <View>
                <Text style={ss.rowTit}>Disponibilidad</Text>
                <Text style={ss.rowVal}>{disponibilidad}</Text>
              </View>
            </View>
            {tipos.length>0&&(
              <View style={[ss.row,{marginTop:10}]}>
                <Text style={ss.rowIcon}>💼</Text>
                <View style={{flex:1}}>
                  <Text style={ss.rowTit}>Tipo de empleo</Text>
                  <Text style={ss.rowVal}>{tipos.join(', ')}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {(aniosExp||sueldoMin||sueldoMax)&&(
          <View style={ss.sec}>
            <Text style={ss.stit}>EXPERIENCIA Y PRETENSION</Text>
            <View style={ss.card}>
              {aniosExp&&(
                <View style={ss.row}>
                  <Text style={ss.rowIcon}>📊</Text>
                  <View>
                    <Text style={ss.rowTit}>Anos de experiencia</Text>
                    <Text style={ss.rowVal}>{aniosExp} {aniosExp===1?'ano':'anos'}</Text>
                  </View>
                </View>
              )}
              {(sueldoMin||sueldoMax)&&(
                <View style={[ss.row,{marginTop:aniosExp?10:0}]}>
                  <Text style={ss.rowIcon}>💰</Text>
                  <View>
                    <Text style={ss.rowTit}>{tipos.includes('Por tarea')||tipos.includes('Temporal')?'Presupuesto':'Pretension salarial'}</Text>
                    <Text style={ss.rowVal}>
                      {tipos.includes('Por tarea')||tipos.includes('Temporal')
                        ?'Presupuesto a acordar · consultar sin compromiso'
                        :sueldoMin&&sueldoMax?sueldoMoneda+' '+sueldoMin+' - '+sueldoMax:sueldoMin?'Desde '+sueldoMoneda+' '+sueldoMin:'Hasta '+sueldoMoneda+' '+sueldoMax}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {(servicios.length>0||profesiones.length>0)&&(
          <View style={ss.sec}>
            <Text style={ss.stit}>SERVICIOS Y PROFESIONES</Text>
            <View style={ss.tagsWrap}>
              {[...servicios,...profesiones].map((t,i)=>(
                <View key={i} style={ss.tag}><Text style={ss.tagTxt}>{t}</Text></View>
              ))}
            </View>
          </View>
        )}

        {idiomas.length>0&&(
          <View style={ss.sec}>
            <Text style={ss.stit}>IDIOMAS</Text>
            <View style={ss.tagsWrap}>
              {idiomas.map((t,i)=>(<View key={i} style={[ss.tag,{backgroundColor:"#E6FBF5",borderColor:"#3DA882"}]}><Text style={[ss.tagTxt,{color:"#2E9472"}]}>{t}</Text></View>))}
            </View>
          </View>
        )}

        {perfil?.bio&&(
          <View style={ss.sec}>
            <Text style={ss.stit}>DESCRIPCION</Text>
            <View style={ss.card}>
              <Text style={ss.bioTxt}>{perfil.bio}</Text>
            </View>
          </View>
        )}

        <View style={ss.privaNota}>
          <Text style={ss.privaNotaTxt}>🔒 Los datos de contacto del trabajador se revelan solo si acepta tu mensaje de interes.</Text>
        </View>

        <View style={{paddingHorizontal:16,marginTop:8}}>
          {enviado?(
            <View style={ss.enviadoCard}>
              <Text style={ss.enviadoTxt}>✅ Mensaje de interes enviado</Text>
              <Text style={ss.enviadoSub}>Te notificaremos cuando el trabajador responda.</Text>
            </View>
          ):(
            <TouchableOpacity style={ss.btnW} onPress={enviarInteres} disabled={enviando}>
              <LinearGradient colors={['#E8785A','#D4614A']} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
                <Text style={ss.btnTxt}>{enviando?'Enviando...':'Iniciar contacto'}</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        <View style={{paddingHorizontal:16,marginTop:12,marginBottom:8}}>
          {visDisp>0?(
            <TouchableOpacity style={ss.otroBtn} onPress={()=>navigation.goBack()}>
              <Text style={ss.otroBtnTxt}>Ver siguiente perfil ({visDisp} disponible{visDisp!==1?'s':''})</Text>
            </TouchableOpacity>
          ):(
            <TouchableOpacity style={ss.otroBtn} onPress={()=>{
              Alert.alert(
                'Ya viste todos tus perfiles',
                'Deseas realizar una nueva busqueda?',
                [
                  {text:'No',style:'cancel'},
                  {text:'Si, nueva busqueda',onPress:()=>navigation.getParent()?.navigate('Buscar')},
                ]
              );
            }}>
              <Text style={ss.otroBtnTxt}>Buscar mas perfiles</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:'#FBF8F4'},
  hdr:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:14,backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#EDE8E2'},
  back:{fontSize:14,fontWeight:'700',color:'#2DD4BF'},
  htit:{fontSize:16,fontWeight:'800',color:'#1A1020'},
  hero:{alignItems:'center',paddingHorizontal:16,paddingTop:24,paddingBottom:32},
  avatar:{width:88,height:88,borderRadius:44,backgroundColor:'#1C2E2C',alignItems:'center',justifyContent:'center',marginBottom:12,borderWidth:3,borderColor:'rgba(255,255,255,0.25)'},
  nombre:{fontSize:24,fontWeight:'900',color:'#FFFFFF',marginBottom:4},
  sub:{fontSize:14,color:'rgba(255,255,255,0.7)',marginBottom:8},
  ratingRow:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:8},
  stars:{fontSize:14,color:'#F59E0B'},
  ratingNum:{fontSize:14,fontWeight:'800',color:'#FFFFFF'},
  ratingCount:{fontSize:12,color:'rgba(255,255,255,0.6)'},
  refBadge:{backgroundColor:'rgba(61,168,130,0.3)',borderRadius:8,paddingHorizontal:12,paddingVertical:5,borderWidth:1,borderColor:'#3DA882'},
  refTxt:{color:'#FFFFFF',fontSize:12,fontWeight:'700'},
  actividad:{fontSize:12,color:'rgba(255,255,255,0.8)',marginTop:6},
  sec:{paddingHorizontal:16,paddingTop:16},
  stit:{fontSize:10,fontWeight:'700',color:'#A898B8',letterSpacing:1,marginBottom:8},
  card:{backgroundColor:'#FFFFFF',borderRadius:12,padding:14,borderWidth:1,borderColor:'#EDE8E2'},
  row:{flexDirection:'row',alignItems:'flex-start',gap:12},
  rowIcon:{fontSize:20},
  rowTit:{fontSize:12,color:'#A898B8',marginBottom:2},
  rowVal:{fontSize:14,fontWeight:'600',color:'#1A1020'},
  tagsWrap:{flexDirection:'row',flexWrap:'wrap',gap:8},
  tag:{paddingHorizontal:12,paddingVertical:6,backgroundColor:'#F0FDFA',borderRadius:20,borderWidth:1,borderColor:'#2DD4BF'},
  tagTxt:{fontSize:12,fontWeight:'600',color:'#2DD4BF'},
  bioTxt:{fontSize:14,color:'#5A4E6A',lineHeight:20},
  privaNota:{marginHorizontal:16,marginTop:16,backgroundColor:'#F0FDFA',borderRadius:10,padding:12,borderLeftWidth:3,borderLeftColor:'#2DD4BF'},
  privaNotaTxt:{fontSize:12,color:'#2DD4BF',lineHeight:18},
  enviadoCard:{backgroundColor:'#E6FBF5',borderRadius:12,padding:16,alignItems:'center',borderWidth:1,borderColor:'#3DA882'},
  enviadoTxt:{fontSize:15,fontWeight:'800',color:'#2E9472',marginBottom:4},
  enviadoSub:{fontSize:13,color:'#3DA882',textAlign:'center'},
  btnW:{borderRadius:14,overflow:'hidden'},
  btn:{paddingVertical:16,alignItems:'center'},
  btnTxt:{color:'#FFFFFF',fontSize:16,fontWeight:'800'},
  otroBtn:{borderRadius:12,paddingVertical:12,alignItems:'center',borderWidth:1.5,borderColor:'#2DD4BF'},
  otroBtnTxt:{fontSize:14,fontWeight:'700',color:'#2DD4BF'},
});
