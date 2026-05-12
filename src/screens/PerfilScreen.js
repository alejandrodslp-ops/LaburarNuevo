import React,{useState,useEffect} from 'react';
import{View,Text,ScrollView,TouchableOpacity,StyleSheet,Switch,Alert,Share,Image}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{LinearGradient}from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import{supabase}from '../services/supabase';
import{useApp}from '../services/AppContext';
import{scheduleTrialExpiry}from '../services/notifications';
import CoachMarkEditarBtn from '../components/CoachMarkEditarBtn';
import ActivacionExitosaModal from '../components/ActivacionExitosaModal';

function Fila({icono,titulo,subtitulo,onPress,derecha,peligro}){
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
      {derecha||<Text style={ss.filaFlecha}>›</Text>}
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

const MODOS_LABELS={worker:'Trabajador',employer:'Empleador',company:'Empresa'};
const MODOS_EMOJIS={worker:'💼',employer:'🏠',company:'🏢'};

export default function PerfilScreen({navigation}){
  const{modoActivo,cambiarModo,coachEditarPendiente,dismissCoachEditar}=useApp();
  const[notif,setNotif]=useState(true);
  const[cargando,setCargando]=useState(true);
  const[bio,setBio]=useState(false);
  const[mostrarActivacion,setMostrarActivacion]=useState(false);
  const[u,setU]=useState({
    nombre:'',oficio:'',zona:'',email:'',
    rating:0,valoraciones:0,activo:false,vistas:0,contactos:0,avatar:null,codigo_referido:'',dias_extra:0,dias_restantes:0,
  });

  useEffect(()=>{cargar();},[]);
  useEffect(()=>{
    const unsub=navigation.addListener('focus',()=>{
      cargar();
      AsyncStorage.getItem('activacion_pendiente').then(val=>{
        if(val==='true'){
          AsyncStorage.removeItem('activacion_pendiente');
          activarPerfilSuap().then(()=>setMostrarActivacion(true));
        }
      });
    });
    return unsub;
  },[navigation]);

  async function activarPerfilSuap(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      const{data}=await supabase.from('profiles').select('perfil_activo,perfil_activo_hasta').eq('id',user.id).single();
      // Si ya tiene perfil activo con fecha futura, no sobreescribir
      if(data?.perfil_activo&&data?.perfil_activo_hasta&&new Date(data.perfil_activo_hasta)>new Date())return;
      const hasta=new Date(Date.now()+(10*24*60*60*1000)).toISOString();
      await supabase.from('profiles').update({perfil_activo:true,perfil_activo_hasta:hasta}).eq('id',user.id);
      await scheduleTrialExpiry(hasta);
    }catch(e){}
  }

  async function cargar(){
    setCargando(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      const{data}=await supabase.from('profiles').select('*').eq('id',user.id).single();
      if(data){
        // Verificar si vencio el periodo de prueba
        if(data.perfil_activo&&data.perfil_activo_hasta){
          const vencimiento=new Date(data.perfil_activo_hasta);
          if(new Date()>vencimiento){
            await supabase.from('profiles').update({perfil_activo:false}).eq('id',user.id);
            data.perfil_activo=false;
            Alert.alert(
              'Tu perfil venció',
              'Ya no aparecés en los resultados de búsqueda. Activá tu perfil por U$1 para volver a recibir propuestas.',
              [
                {text:'Ahora no',style:'cancel'},
                {text:'Activar perfil',onPress:()=>navigation.navigate('PagoActivacion')},
              ]
            );
          }
        }
        const esW=modoActivo==='worker';
        setU({
          nombre:data.nombre||'Tu perfil',
          oficio:esW?(data.servicios?.[0]||data.profesiones?.[0]||''):(data.empleo_buscado||''),
          zona:[data.barrio,data.ciudad,data.pais].filter(Boolean).join(', '),
          email:user.email||'',
          rating:data.rating||0,
          valoraciones:data.total_valoraciones||0,
          activo:data.perfil_activo||false,
          dias_restantes:data.periodo_gratis_hasta?Math.max(0,Math.ceil((new Date(data.periodo_gratis_hasta)-new Date())/(1000*60*60*24))):0,
          codigo_referido:data.codigo_referido||'',
          dias_extra:data.dias_extra||0,
          fecha_activacion:data.fecha_activacion||null,
          vistas:data.vistas||0,
          contactos:data.contactos||0,
          avatar:data.avatar_url||null,
        });
      }
    }catch(e){console.log(e);}finally{setCargando(false);}
  }

  function mostrarCambioModo(){
    Alert.alert('Tipo de cuenta','Selecciona tu modo activo',[
      {text:'💼 Trabajador',onPress:()=>cambiarModo('worker')},
      {text:'🏠 Empleador particular',onPress:()=>cambiarModo('employer')},
      {text:'🏢 Empresa',onPress:async()=>{await supabase.auth.signOut();}},
      {text:'Cancelar',style:'cancel'},
    ]);
  }

  function cerrarSesion(){
    Alert.alert('Cerrar sesion','Estas seguro?',[
      {text:'Cancelar',style:'cancel'},
      {text:'Cerrar sesion',style:'destructive',onPress:async()=>{await supabase.auth.signOut();}},
    ]);
  }

  const esWorker=modoActivo==='worker';
  const modoLabel=MODOS_LABELS[modoActivo]||'Trabajador';
  const modoEmoji=MODOS_EMOJIS[modoActivo]||'💼';

  return(
    <SafeAreaView style={ss.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <LinearGradient colors={['#1C2E2C','#0E1E1C']} style={ss.header}>
          <View style={ss.avatarWrap}>
            <View style={ss.avatar}>
              {u.avatar
                ?<Image source={{uri:u.avatar}} style={{width:96,height:96,borderRadius:48}}/>
                :<Text style={{fontSize:44}}>{modoEmoji}</Text>
              }
            </View>
            <TouchableOpacity style={ss.avatarEdit} onPress={()=>navigation.navigate(esWorker?'EditarPerfil':'EditarPerfilEmpleadorDatos')}>
              <Text style={{fontSize:12}}>✏️</Text>
            </TouchableOpacity>
          </View>
          <Text style={ss.nombre}>{u.nombre||'Tu perfil'}</Text>
          {(u.oficio||u.zona)?<Text style={ss.oficio}>{[u.oficio,u.zona].filter(Boolean).join(' · ')}</Text>:null}
          <TouchableOpacity style={ss.rolBadge} onPress={mostrarCambioModo}>
            <Text style={ss.rolBadgeTxt}>{modoLabel}</Text><Text style={{color:'#E8785A',fontSize:24,marginLeft:6}}>⇄</Text>
          </TouchableOpacity>
          {esWorker&&(
            <View style={ss.statsRow}>
              <View style={ss.stat}><Text style={ss.statNum}>{u.vistas}</Text><Text style={ss.statLbl}>Vistas</Text></View>
              <View style={ss.statDiv}/>
              <View style={ss.stat}><Text style={ss.statNum}>{u.contactos}</Text><Text style={ss.statLbl}>Contactos</Text></View>
              <View style={ss.statDiv}/>
              <View style={ss.stat}><Text style={ss.statNum}>{u.rating}</Text><Text style={ss.statLbl}>Rating</Text></View>
            </View>
          )}
        </LinearGradient>

        <View style={ss.botonesWrap}>
          <TouchableOpacity style={ss.editarBtn} onPress={()=>{dismissCoachEditar();navigation.navigate(esWorker?'EditarPerfil':'EditarPerfilEmpleadorDatos');}}>
            <Text style={ss.editarTxt}>Editar perfil</Text>
          </TouchableOpacity>
          {!esWorker&&(
            <TouchableOpacity style={ss.buscarBtn} onPress={()=>navigation.navigate('EditarPerfilEmpleador',{seccion:'oferta'})}>
              <Text style={ss.buscarBtnTxt}>🔍 Publicar busqueda de trabajador</Text>
            </TouchableOpacity>
          )}
        </View>

        {esWorker&&(
          <CoachMarkEditarBtn visible={coachEditarPendiente} onDismiss={dismissCoachEditar}/>
        )}

        {esWorker&&!cargando&&(
          <Sec titulo="MI PERFIL">
            <View style={ss.fila}>
              <View style={ss.filaIzq}>
                <View style={[ss.statusDot,{backgroundColor:u.activo?'#3DA882':'#A898B8'}]}/>
                <View>
                  <Text style={ss.filaTitulo}>{u.activo?'Perfil activo':'Perfil inactivo'}</Text>
                  <Text style={ss.filaSub}>{u.activo?'Los empleadores pueden encontrarte':'Tu periodo gratuito vencio'}</Text>
                </View>
              </View>
              {!u.activo&&(
                <TouchableOpacity style={[ss.renovarBtn,{backgroundColor:'#E8785A'}]} onPress={()=>navigation.navigate('PagoActivacion')}>
                  <Text style={ss.renovarTxt}>Activar tu perfil</Text>
                </TouchableOpacity>
              )}
            </View>
          </Sec>
        )}

        {!esWorker&&(
          <Sec titulo="MIS BUSQUEDAS">
            <Fila icono="📋" titulo="Ver mis busquedas publicadas" subtitulo="Gestiona tus busquedas activas" onPress={()=>Alert.alert('Proximamente')}/>
            <Sep/>
            <Fila icono="👁️" titulo="Perfiles vistos" subtitulo="Historial de perfiles desbloqueados" onPress={()=>navigation.navigate('Historial')}/>
          </Sec>
        )}

        <Sec titulo="MI CUENTA">
          <Fila icono="👤" titulo="Datos personales" subtitulo={u.email} onPress={()=>navigation.navigate(esWorker?'EditarPerfil':'EditarPerfilEmpleadorDatos')}/>
          <Sep/>
          <Fila icono="📍" titulo={esWorker?'Zona de trabajo':'Ubicacion'} subtitulo={u.zona||'No configurada'} onPress={()=>navigation.navigate(esWorker?'EditarPerfil':'EditarPerfilEmpleadorDatos')}/>
          {esWorker&&(<><Sep/><Fila icono="💼" titulo="Servicios y profesiones" subtitulo={u.oficio||'No configurado'} onPress={()=>navigation.navigate(esWorker?'EditarPerfil':'EditarPerfilEmpleadorDatos')}/></>)}
        </Sec>

        <Sec titulo="PREFERENCIAS">
          <Fila icono="🔔" titulo="Notificaciones" subtitulo="Avisos cuando te ven o contactan"
            derecha={<Switch value={notif} onValueChange={setNotif} trackColor={{false:'#EDE8E2',true:'#E8785A'}} thumbColor="#FFFFFF"/>}/>
        </Sec>

        <Sec titulo="SEGURIDAD">
          <Fila icono="👆" titulo="Huella / Face ID" subtitulo={bio?'Activado':'Desactivado'}
            derecha={<Switch value={bio} onValueChange={setBio} trackColor={{false:'#EDE8E2',true:'#E8785A'}} thumbColor="#FFFFFF"/>}/>
          <Sep/>
          <Fila icono="🔑" titulo="Cambiar contrasena" onPress={()=>Alert.alert('Proximamente')}/>
        </Sec>

        <Sec titulo="GENERAL">
          <Fila icono="📤" titulo="Compartir Nexu" subtitulo="Invita a tus amigos" onPress={()=>Share.share({message:'Descarga Nexu!'})}/>
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

      <ActivacionExitosaModal visible={mostrarActivacion} onClose={()=>setMostrarActivacion(false)}/>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  container:{flex:1,backgroundColor:'#F2EDE6'},
  header:{alignItems:'center',paddingHorizontal:16,paddingTop:24,paddingBottom:32},
  avatarWrap:{position:'relative',marginBottom:16},
  avatar:{width:96,height:96,borderRadius:48,backgroundColor:'#E8785A',alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'rgba(255,255,255,0.25)',overflow:'hidden'},
  avatarEdit:{position:'absolute',bottom:0,right:0,width:28,height:28,borderRadius:14,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
  nombre:{fontSize:24,fontWeight:'900',color:'#FFFFFF',letterSpacing:-0.5,marginBottom:4,textAlign:'center'},
  oficio:{fontSize:14,color:'rgba(255,255,255,0.55)',marginBottom:8,textAlign:'center'},
  rolBadge:{backgroundColor:'#FFFFFF',borderRadius:20,paddingHorizontal:16,paddingVertical:8,marginBottom:12,flexDirection:'row',alignItems:'center',gap:6,shadowColor:'#000',shadowOffset:{width:0,height:2},shadowOpacity:0.2,shadowRadius:4,elevation:3},
  rolBadgeTxt:{color:'#0F766E',fontSize:12,fontWeight:'800'},
  statsRow:{flexDirection:'row',alignItems:'center',backgroundColor:'rgba(255,255,255,0.1)',borderRadius:12,paddingVertical:8,paddingHorizontal:24,gap:24},
  stat:{alignItems:'center'},statNum:{fontSize:20,fontWeight:'900',color:'#FFFFFF',lineHeight:28},
  statLbl:{fontSize:10,color:'rgba(255,255,255,0.4)',fontWeight:'600'},
  statDiv:{width:1,height:32,backgroundColor:'rgba(255,255,255,0.15)'},
  botonesWrap:{paddingHorizontal:16,paddingTop:16,gap:10},
  editarBtn:{backgroundColor:'#FFFFFF',borderRadius:12,paddingVertical:12,alignItems:'center',borderWidth:1.5,borderColor:'#EDE8E2'},
  editarTxt:{fontSize:14,fontWeight:'700',color:'#0F766E'},
  buscarBtn:{backgroundColor:'#2DD4BF',borderRadius:10,paddingVertical:12,alignItems:'center'},
  buscarBtnTxt:{color:'#FFFFFF',fontSize:13,fontWeight:'700'},
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
  statusDot:{width:10,height:10,borderRadius:5},
  renovarBtn:{backgroundColor:'#E8785A',borderRadius:8,paddingHorizontal:14,paddingVertical:7},
  renovarTxt:{color:'#FFFFFF',fontSize:12,fontWeight:'700'},
  version:{textAlign:'center',fontSize:10,color:'#D0C8DC',paddingVertical:32},
});
