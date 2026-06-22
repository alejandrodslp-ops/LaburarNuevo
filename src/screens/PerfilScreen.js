import React,{useState,useEffect} from 'react';
import NexuWatermark from '../components/NexuWatermark';
import{View,Text,ScrollView,TouchableOpacity,StyleSheet,Switch,Alert,Share,Image}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{LinearGradient}from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import{supabase}from '../services/supabase';
import{useApp}from '../services/AppContext';
import{useI18n}from '../services/I18nContext';
import IdiomaModal from '../components/IdiomaModal';
import{scheduleTrialExpiry}from '../services/notifications';
import CoachMarkEditarBtn from '../components/CoachMarkEditarBtn';
import ActivacionExitosaModal from '../components/ActivacionExitosaModal';
import SoporteModal from '../components/SoporteModal';
import PinAdminModal, { tieneSessionAdmin } from '../components/PinAdminModal';
import ModalPerfilInactivo from '../components/ModalPerfilInactivo';

// usd: precio en dólares | sim: símbolo moneda local | val: valor aprox en moneda local
const PRECIO_LOCAL = {
  UY:{usd:1,sim:'$U',val:40},    AR:{usd:1,sim:'$',val:1000},   BR:{usd:1,sim:'R$',val:5.5},
  CL:{usd:1,sim:'$',val:950},    CO:{usd:1,sim:'$',val:4000},   PE:{usd:1,sim:'S/',val:3.8},
  PY:{usd:1,sim:'Gs.',val:7500}, BO:{usd:1,sim:'Bs.',val:7},    EC:{usd:1,sim:'$',val:1},
  VE:{usd:1,sim:'$',val:1},      CU:{usd:1,sim:'$',val:24},     CR:{usd:1,sim:'₡',val:520},
  GT:{usd:1,sim:'Q',val:7.8},    SV:{usd:1,sim:'$',val:1},      HN:{usd:1,sim:'L',val:25},
  NI:{usd:1,sim:'C$',val:36},    PA:{usd:1,sim:'B/.',val:1},    DO:{usd:1,sim:'RD$',val:58},
  ES:{usd:2,sim:'€',val:1.84},   PT:{usd:2,sim:'€',val:1.84},   IT:{usd:2,sim:'€',val:1.84},
  FR:{usd:2,sim:'€',val:1.84},   DE:{usd:2,sim:'€',val:1.84},   GB:{usd:2,sim:'£',val:1.58},
  US:{usd:2,sim:'USD',val:2},    CA:{usd:2,sim:'CA$',val:2.72}, AU:{usd:2,sim:'A$',val:3.06},
};
function precioConversion(pais){
  const p=PRECIO_LOCAL[pais]||{usd:1,sim:'U$',val:1};
  const valStr=p.val>=1000?Math.round(p.val).toLocaleString('es'):p.val%1===0?String(p.val):p.val.toFixed(2).replace('.',',');
  const local=p.val===p.usd?'':`(aprox. ${p.sim} ${valStr})`;
  return{usd:p.usd,local};
}

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
      {derecha||(onPress?<Text style={ss.filaFlecha}>›</Text>:null)}
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

const MODOS_EMOJIS={worker:'💼',employer:'🏠',company:'🏢'};

function calcularEdad(fechaNac){
  if(!fechaNac)return null;
  let nac;
  if(fechaNac.includes('/')){
    const[d,m,a]=fechaNac.split('/');
    nac=new Date(Number(a),Number(m)-1,Number(d));
  }else{
    nac=new Date(fechaNac);
  }
  if(isNaN(nac.getTime()))return null;
  const hoy=new Date();
  let edad=hoy.getFullYear()-nac.getFullYear();
  const dm=hoy.getMonth()-nac.getMonth();
  if(dm<0||(dm===0&&hoy.getDate()<nac.getDate()))edad--;
  return edad>0?edad:null;
}

export default function PerfilScreen({navigation}){
  const{modoActivo,coachEditarPendiente,dismissCoachEditar}=useApp();
  const{t,idioma}=useI18n();
  const IDIOMA_NOMBRE={es:'Español',pt:'Português',en:'English',de:'Deutsch',fr:'Français',it:'Italiano',sv:'Svenska',no:'Norsk',ja:'日本語',hi:'हिन्दी'};
  const[idiomaModalVisible,setIdiomaModalVisible]=useState(false);
  const[notif,setNotif]=useState(true);
  const[cargando,setCargando]=useState(true);
  const[bio,setBio]=useState(false);
  const[mostrarActivacion,setMostrarActivacion]=useState(false);
  const[resetEnviando,setResetEnviando]=useState(false);
  const[soporteVisible,setSoporteVisible]=useState(false);
  const[pinVisible,setPinVisible]=useState(false);
  const[u,setU]=useState({
    nombre:'',oficio:'',zona:'',email:'',
    rating:0,valoraciones:0,activo:false,vistas:0,contactos:0,avatar:null,codigo_referido:'',dias_extra:0,dias_restantes:0,
    telefono:'',telefonoVerificado:false,edad:null,
  });
  const[nomada,setNomada]=useState(false);
  const[idiomas,setIdiomas]=useState([]);
  const[modalInactivo,setModalInactivo]=useState({visible:false,usd:1});

  const IDIOMAS_OPTS=[
    {code:'es',label:'Español',flag:'🇪🇸',fijo:true},
    {code:'pt',label:'Português',flag:'🇧🇷'},
    {code:'en',label:'English',flag:'🇺🇸'},
    {code:'fr',label:'Français',flag:'🇫🇷'},
    {code:'de',label:'Deutsch',flag:'🇩🇪'},
    {code:'it',label:'Italiano',flag:'🇮🇹'},
    {code:'sv',label:'Svenska',flag:'🇸🇪'},
    {code:'no',label:'Norsk',flag:'🇳🇴'},
    {code:'ja',label:'日本語',flag:'🇯🇵'},
    {code:'hi',label:'हिन्दी',flag:'🇮🇳'},
  ];

  useEffect(()=>{
    cargar();
    AsyncStorage.getItem('bio_enabled').then(v=>setBio(v==='true'));
    AsyncStorage.getItem('notif_enabled').then(v=>setNotif(v!=='false'));
  },[]);
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
    try{
      // PASO 1: leer identidad del storage — supabase.auth.token si existe, si no nexu_uid
      let userId=null, userEmail=null;
      try{
        const raw=await AsyncStorage.getItem('sb-waevdcqdkovqaxkonlvj-auth-token');
        if(raw){
          const s=JSON.parse(raw);
          userId=s.user?.id;
          userEmail=s.user?.email;
          // Persiste email y token en claves propias — no las borra GoTrueClient automáticamente
          if(userEmail) AsyncStorage.setItem('nexu_user_email',userEmail).catch(()=>{});
          if(s.access_token) AsyncStorage.setItem('nexu_access_token',s.access_token).catch(()=>{});
        }
      }catch{}
      // Fallback: si la sesión ya fue borrada por GoTrueClient, usar la clave propia
      if(!userEmail){
        try{ userEmail=await AsyncStorage.getItem('nexu_user_email'); }catch{}
      }

      // PASO 2: mostrar cache o al menos el email/botón admin — sin red
      if(userId){
        const CACHE_KEY=`perfil_cache_${userId}`;
        const cached=await AsyncStorage.getItem(CACHE_KEY);
        if(cached){
          const c=JSON.parse(cached);
          const esAdminC=userEmail==='alejandrodslp@gmail.com';
          const esW=modoActivo==='worker';
          setNomada(c.nomada_digital||false);
          setIdiomas(c.idiomas_trabajo||[]);
          setU({
            nombre:c.nombre||'Tu perfil',
            oficio:esW?(c.servicios?.[0]||c.profesiones?.[0]||''):(c.empleo_buscado||''),
            zona:[c.barrio,c.ciudad,c.pais].filter(Boolean).join(', '),
            email:userEmail||'',
            rating:c.rating||0,
            valoraciones:c.total_valoraciones||0,
            activo:esAdminC?true:(c.perfil_activo||false),
            dias_restantes:c.periodo_gratis_hasta?Math.max(0,Math.ceil((new Date(c.periodo_gratis_hasta)-new Date())/(1000*60*60*24))):0,
            codigo_referido:c.codigo_referido||'',
            dias_extra:c.dias_extra||0,
            fecha_activacion:c.fecha_activacion||null,
            vistas:c.vistas||0,
            contactos:c.contactos||0,
            avatar:c.avatar_url||null,
            telefono:c.telefono||'',
            telefonoVerificado:c.telefono_verificado||false,
            edad:calcularEdad(c.fecha_nac),
          });
        } else if(userEmail){
          setU(prev=>({...prev,email:userEmail}));
        }
      } else if(userEmail){
        // Sin userId (sesión borrada) pero tenemos email: mostrar botón admin al menos
        setU(prev=>({...prev,email:userEmail}));
      }
    }catch(e){console.log(e);}finally{
      // Siempre mostrar la pantalla luego de leer storage (< 100ms) — no esperar red
      setCargando(false);
    }
    // Refrescar desde red en background — setTimeout garantiza que React renderice primero
    setTimeout(refrescarPerfil, 0);
  }

  async function refrescarPerfil(){
    try{
      const{data:sessionData}=await supabase.auth.getSession();
      const session=sessionData?.session;
      const user=session?.user;
      if(!user)return;
      // Actualizar token guardado si la sesión se renovó con éxito
      if(session.access_token) AsyncStorage.setItem('nexu_access_token',session.access_token).catch(()=>{});
      if(user.email) AsyncStorage.setItem('nexu_user_email',user.email).catch(()=>{});
      const CACHE_KEY=`perfil_cache_${user.id}`;
      const{data}=await supabase.from('profiles').select('*').eq('id',user.id).single();
      if(!data)return;
      AsyncStorage.setItem(CACHE_KEY,JSON.stringify(data)).catch(()=>{});
      setNomada(data.nomada_digital||false);
      setIdiomas(data.idiomas_trabajo||[]);
      const esAdmin=user.email==='alejandrodslp@gmail.com';
      if(!esAdmin&&data.perfil_activo&&data.perfil_activo_hasta&&new Date()>new Date(data.perfil_activo_hasta)){
        supabase.from('profiles').update({perfil_activo:false}).eq('id',user.id).then(()=>{});
        data.perfil_activo=false;
        const{usd}=precioConversion(data.pais);
        setModalInactivo({visible:true,usd});
      }
      if(esAdmin&&data.perfil_activo_hasta&&new Date()>new Date(data.perfil_activo_hasta)){
        supabase.from('profiles').update({perfil_activo:true,perfil_activo_hasta:null}).eq('id',user.id).then(()=>{});
        data.perfil_activo=true;
      }
      const esW=modoActivo==='worker';
      setU({
        nombre:data.nombre||'Tu perfil',
        oficio:esW?(data.servicios?.[0]||data.profesiones?.[0]||''):(data.empleo_buscado||''),
        zona:[data.barrio,data.ciudad,data.pais].filter(Boolean).join(', '),
        email:user.email||'',
        rating:data.rating||0,
        valoraciones:data.total_valoraciones||0,
        activo:esAdmin?true:(data.perfil_activo||false),
        dias_restantes:data.periodo_gratis_hasta?Math.max(0,Math.ceil((new Date(data.periodo_gratis_hasta)-new Date())/(1000*60*60*24))):0,
        codigo_referido:data.codigo_referido||'',
        dias_extra:data.dias_extra||0,
        fecha_activacion:data.fecha_activacion||null,
        vistas:data.vistas||0,
        contactos:data.contactos||0,
        avatar:data.avatar_url||null,
        telefono:data.telefono||'',
        telefonoVerificado:data.telefono_verificado||false,
        edad:calcularEdad(data.fecha_nac),
      });
    }catch(e){console.log(e);}
  }

  async function cambiarContrasena(){
    if(resetEnviando)return;
    Alert.alert(
      t('cambiar_contrasena'),
      t('contrasena_reset_msg',{email:u.email}),
      [
        {text:t('cancelar'),style:'cancel'},
        {text:'Enviar',onPress:async()=>{
          setResetEnviando(true);
          try{
            const{error}=await supabase.auth.resetPasswordForEmail(u.email);
            if(error)throw error;
            Alert.alert(t('contrasena_enviado_tit'),t('contrasena_enviado_msg'));
          }catch(e){
            Alert.alert(t('error'),t('contrasena_reset_err'));
          }finally{setResetEnviando(false);}
        }},
      ]
    );
  }

  async function toggleNomada(val){
    setNomada(val);
    const{data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    await supabase.from('profiles').update({nomada_digital:val}).eq('id',user.id);
    if(!val){setIdiomas([]);await supabase.from('profiles').update({idiomas_trabajo:[]}).eq('id',user.id);}
  }

  async function toggleIdioma(code){
    const{data:{user}}=await supabase.auth.getUser();
    if(!user)return;
    const nuevo=idiomas.includes(code)?idiomas.filter(i=>i!==code):[...idiomas,code];
    setIdiomas(nuevo);
    await supabase.from('profiles').update({idiomas_trabajo:nuevo}).eq('id',user.id);
  }

  async function toggleBio(val){
    if(val){
      const hasHardware=await LocalAuthentication.hasHardwareAsync();
      const isEnrolled=await LocalAuthentication.isEnrolledAsync();
      if(!hasHardware||!isEnrolled){
        Alert.alert(t('bio_no_disponible'),t('bio_no_disp_msg'));
        return;
      }
      const result=await LocalAuthentication.authenticateAsync({
        promptMessage:t('confirmar_identidad'),
        cancelLabel:t('cancelar'),
        disableDeviceFallback:false,
      });
      if(result.success){
        setBio(true);
        await AsyncStorage.setItem('bio_enabled','true');
        Alert.alert(t('bio_activada'),t('bio_activada_msg'));
      }else if(result.error&&result.error!=='user_cancel'){
        Alert.alert(t('error'),t('bio_error_msg'));
      }
    }else{
      setBio(false);
      await AsyncStorage.setItem('bio_enabled','false');
    }
  }

  async function toggleNotif(val){
    setNotif(val);
    await AsyncStorage.setItem('notif_enabled',val?'true':'false');
  }

  async function abrirAdmin(){
    const sesionOk=await tieneSessionAdmin();
    if(sesionOk){navigation.navigate('Admin');}
    else{setPinVisible(true);}
  }

  async function compartirNexu(){
    try{
      const codigo=u.codigo_referido||'';
      const link=codigo?`https://konexu.app/download?r=${codigo}`:'https://konexu.app/download';
      await Share.share({message:`${t('compartir_msg')}\n${link}`,title:'Konexu'});
    }catch(e){}
  }

  function cerrarSesion(){
    Alert.alert(t('cerrar_sesion_tit'),t('cerrar_sesion_confirm'),[
      {text:t('cancelar'),style:'cancel'},
      {text:t('cerrar_sesion_tit'),style:'destructive',onPress:async()=>{await AsyncStorage.removeItem('welcome_visto');await AsyncStorage.removeItem('nexu_user_email');await AsyncStorage.removeItem('nexu_access_token');await supabase.auth.signOut();}},
    ]);
  }

  const esWorker=modoActivo==='worker';
  const modoEmoji=MODOS_EMOJIS[modoActivo]||'💼';

  return(
    <SafeAreaView style={ss.container} edges={['top']}>
      <NexuWatermark/>
      <ScrollView showsVerticalScrollIndicator={false}>

        <LinearGradient colors={['#D6E4F0','#B8D4E8']} style={ss.header}>
          <View style={ss.card}>
            <View style={ss.cardIzq}>
              <View style={ss.avatarWrap}>
                <View style={ss.avatar}>
                  {u.avatar
                    ?<Image source={{uri:u.avatar}} style={{width:88,height:88,borderRadius:44}}/>
                    :<Text style={{fontSize:40}}>{modoEmoji}</Text>
                  }
                </View>
                <TouchableOpacity style={ss.avatarEdit} onPress={()=>navigation.navigate(esWorker?'EditarPerfil':'EditarPerfilEmpleadorDatos')}>
                  <Text style={{fontSize:11}}>✏️</Text>
                </TouchableOpacity>
                {u.activo&&<View style={ss.badge}><Text style={{fontSize:13,color:'#fff'}}>✓</Text></View>}
              </View>
              <Text style={ss.cardNombre} numberOfLines={1}>{u.nombre||'Tu perfil'}</Text>
              {u.zona?<Text style={ss.cardZona} numberOfLines={1}>{u.zona}</Text>:null}
            </View>

            <View style={ss.cardSepV}/>

            <View style={ss.cardDer}>
              <View style={ss.cardStat}>
                <Text style={ss.cardStatVal} numberOfLines={1}>{u.oficio||'—'}</Text>
                <Text style={ss.cardStatLbl}>Profesión</Text>
              </View>
              <View style={ss.cardStatDiv}/>
              <View style={ss.cardStat}>
                <Text style={ss.cardStatNum}>{u.edad!=null?`${u.edad} años`:'—'}</Text>
                <Text style={ss.cardStatLbl}>Edad</Text>
              </View>
              <View style={ss.cardStatDiv}/>
              <View style={ss.cardStat}>
                <Text style={ss.cardStatNum}>{u.rating>0?u.rating:'—'}</Text>
                <Text style={ss.cardStatLbl}>Calificación ⭐</Text>
              </View>
            </View>
          </View>

        </LinearGradient>

        <View style={ss.botonesWrap}>
          <TouchableOpacity style={ss.editarBtn} onPress={()=>{dismissCoachEditar();navigation.navigate(esWorker?'EditarPerfil':'EditarPerfilEmpleadorDatos');}}>
            <Text style={ss.editarTxt}>{t('editar_perfil')}</Text>
          </TouchableOpacity>
          {!esWorker&&(
            <TouchableOpacity style={ss.buscarBtn} onPress={()=>navigation.navigate('EditarPerfilEmpleador',{seccion:'oferta'})}>
              <Text style={ss.buscarBtnTxt}>{t('publicar_busqueda')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {esWorker&&(
          <Sec titulo="HERRAMIENTAS">
            <Fila icono="📄" titulo="Mi CV" subtitulo="Creá y exportá tu currículum profesional" onPress={()=>navigation.navigate('CV')}/>
          </Sec>
        )}

        {esWorker&&(
          <CoachMarkEditarBtn visible={coachEditarPendiente} onDismiss={dismissCoachEditar}/>
        )}

        {esWorker&&!cargando&&(
          <Sec titulo={t('sec_mi_perfil')}>
            <View style={ss.fila}>
              <View style={ss.filaIzq}>
                <View style={[ss.statusDot,{backgroundColor:u.activo?'#3DA882':'#A898B8'}]}/>
                <View>
                  <Text style={ss.filaTitulo}>{u.activo?t('perfil_activo_txt'):t('perfil_inactivo_txt')}</Text>
                  <Text style={ss.filaSub}>{u.activo?t('empleadores_pueden'):t('periodo_vencio')}</Text>
                </View>
              </View>
              {!u.activo&&(
                <TouchableOpacity style={[ss.renovarBtn,{backgroundColor:'#E8785A'}]} onPress={()=>navigation.navigate('PagoActivacion')}>
                  <Text style={ss.renovarTxt}>{t('activar_perfil_btn')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </Sec>
        )}

        {!esWorker&&(
          <Sec titulo={t('sec_mis_busquedas')}>
            <Fila icono="📋" titulo={t('ver_busquedas')} subtitulo={t('gestionar_busquedas')} onPress={()=>navigation.navigate('Ofertas')}/>
            <Sep/>
            <Fila icono="👁️" titulo={t('perfiles_vistos')} subtitulo={t('historial_desbloqueados')} onPress={()=>navigation.navigate('Historial')}/>
          </Sec>
        )}

        <Sec titulo={t('sec_mi_cuenta')}>
          <Fila icono="📧" titulo="Email" subtitulo={u.email} onPress={null}/>
          {esWorker&&(<><Sep/><Fila
            icono="📱"
            titulo="Teléfono"
            subtitulo={u.telefono?(u.telefonoVerificado?'✅ '+u.telefono+' — Verificado':'⚠️ '+u.telefono+' — Sin verificar'):'No configurado'}
            onPress={null}
          /></>)}
        </Sec>

        {esWorker&&(
          <Sec titulo="TRABAJO REMOTO">
            <View style={ss.fila}>
              <View style={ss.filaIzq}>
                <View style={ss.filaIcono}><Text style={{fontSize:16}}>🌍</Text></View>
                <View style={{flex:1}}>
                  <Text style={ss.filaTitulo}>Nómada digital</Text>
                  <Text style={ss.filaSub}>Ver ofertas de trabajo en el mundo</Text>
                </View>
              </View>
              <Switch value={nomada} onValueChange={toggleNomada} trackColor={{false:'#EDE8E2',true:'#E8785A'}} thumbColor="#FFFFFF"/>
            </View>
            {nomada&&(
              <View style={ss.idiomasWrap}>
                <Text style={ss.idiomasTit}>¿En qué idiomas aceptás ofertas?</Text>
                <View style={ss.idiomasRow}>
                  {IDIOMAS_OPTS.map(op=>{
                    const activo=op.fijo||idiomas.includes(op.code);
                    return(
                      <TouchableOpacity key={op.code} style={[ss.idiomaChip,activo&&ss.idiomaChipA]} onPress={()=>!op.fijo&&toggleIdioma(op.code)} activeOpacity={op.fijo?1:0.7}>
                        <Text style={ss.idiomaFlag}>{op.flag}</Text>
                        <Text style={[ss.idiomaLbl,activo&&ss.idiomaLblA]}>{op.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </Sec>
        )}

        <Sec titulo={t('sec_preferencias')}>
          <Fila icono="🌐" titulo={t('idioma')} subtitulo={IDIOMA_NOMBRE[idioma]||'Español'} onPress={()=>setIdiomaModalVisible(true)}/>
          <Sep/>
          <Fila icono="🔔" titulo={t('notificaciones')} subtitulo={t('avisos_notif')}
            derecha={<Switch value={notif} onValueChange={toggleNotif} trackColor={{false:'#EDE8E2',true:'#E8785A'}} thumbColor="#FFFFFF"/>}/>
        </Sec>

        <Sec titulo={t('sec_seguridad')}>
          <Fila icono="👆" titulo={t('huella_face')} subtitulo={bio?t('activado'):t('desactivado')}
            derecha={<Switch value={bio} onValueChange={toggleBio} trackColor={{false:'#EDE8E2',true:'#E8785A'}} thumbColor="#FFFFFF"/>}/>
          <Sep/>
          <Fila icono="🔑" titulo={t('cambiar_contrasena')} onPress={cambiarContrasena}/>
        </Sec>

        <Sec titulo={t('sec_general')}>
          <Fila icono="📤" titulo={t('compartir_nexu')} subtitulo={t('invita_amigos')} onPress={compartirNexu}/>
          <Sep/>
          <Fila icono="❓" titulo={t('ayuda_soporte')} onPress={()=>setSoporteVisible(true)}/>
          <Sep/>
          <Fila icono="📋" titulo={t('terminos')} onPress={()=>navigation.navigate('Terminos')}/>
          <Sep/>
          <Fila icono="🔒" titulo={t('privacidad')} onPress={()=>navigation.navigate('Privacidad')}/>
        </Sec>

        <Sec titulo=""><Fila icono="🚪" titulo={t('cerrar_sesion_tit')} onPress={cerrarSesion} peligro/></Sec>

        {u.email==='alejandrodslp@gmail.com'&&(
          <TouchableOpacity style={ss.adminBtn} onPress={abrirAdmin}>
            <Text style={ss.adminEmoji}>⚙️</Text>
            <View style={{flex:1}}>
              <Text style={ss.adminTit}>Panel de Administrador</Text>
              <Text style={ss.adminSub}>Estadísticas · Usuarios · Pagos · Consultas</Text>
            </View>
            <Text style={{fontSize:18,color:'#1A3A5C'}}>›</Text>
          </TouchableOpacity>
        )}

        <Text style={ss.version}>{t('version_app')}</Text>
      </ScrollView>

      <ActivacionExitosaModal visible={mostrarActivacion} onClose={()=>setMostrarActivacion(false)}/>
      <IdiomaModal visible={idiomaModalVisible} onClose={()=>setIdiomaModalVisible(false)}/>
      <SoporteModal visible={soporteVisible} onClose={()=>setSoporteVisible(false)} email={u.email} nombre={u.nombre}/>
      <PinAdminModal visible={pinVisible} onClose={()=>setPinVisible(false)} onSuccess={()=>{setPinVisible(false);navigation.navigate('Admin');}}/>
      <ModalPerfilInactivo
        visible={modalInactivo.visible}
        usd={modalInactivo.usd}
        onActivar={()=>{setModalInactivo(m=>({...m,visible:false}));navigation.navigate('PagoActivacion');}}
        onCerrar={()=>setModalInactivo(m=>({...m,visible:false}))}/>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  container:{flex:1,backgroundColor:'#F2EDE6'},
  header:{paddingHorizontal:16,paddingTop:20,paddingBottom:20,gap:14},
  card:{flexDirection:'row',backgroundColor:'#FFFFFF',borderRadius:20,padding:18,alignItems:'center',shadowColor:'#1A3A5C',shadowOffset:{width:0,height:2},shadowOpacity:0.08,shadowRadius:8,elevation:3},
  cardIzq:{alignItems:'center',flex:2},
  avatarWrap:{position:'relative',marginBottom:10},
  avatar:{width:88,height:88,borderRadius:44,backgroundColor:'#E8785A',alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'rgba(255,255,255,0.3)',overflow:'hidden'},
  avatarEdit:{position:'absolute',bottom:0,right:0,width:26,height:26,borderRadius:13,backgroundColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},
  badge:{position:'absolute',bottom:0,left:0,width:26,height:26,borderRadius:13,backgroundColor:'#E8785A',alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#fff'},
  cardNombre:{fontSize:15,fontWeight:'800',color:'#1A3A5C',textAlign:'center'},
  cardZona:{fontSize:11,color:'#A898B8',textAlign:'center',marginTop:2},
  cardSepV:{width:1,alignSelf:'stretch',backgroundColor:'#EDE8E2',marginHorizontal:14},
  cardDer:{flex:1,gap:0},
  cardStat:{paddingVertical:8},
  cardStatDiv:{height:1,backgroundColor:'#EDE8E2'},
  cardStatVal:{fontSize:13,fontWeight:'700',color:'#1A3A5C'},
  cardStatNum:{fontSize:20,fontWeight:'900',color:'#1A3A5C'},
  cardStatLbl:{fontSize:10,color:'#A898B8',fontWeight:'600',marginTop:1},
  nombre:{fontSize:24,fontWeight:'900',color:'#1A3A5C',letterSpacing:-0.5,marginBottom:4,textAlign:'center'},
  oficio:{fontSize:14,color:'rgba(26,58,92,0.6)',marginBottom:8,textAlign:'center'},
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
  idiomasWrap:{paddingHorizontal:16,paddingBottom:14,borderTopWidth:1,borderTopColor:'#EDE8E2',marginTop:4},
  idiomasTit:{fontSize:12,fontWeight:'700',color:'#1A1020',marginTop:12,marginBottom:2},
  idiomasSub:{fontSize:11,color:'#A898B8',marginBottom:10},
  idiomasRow:{flexDirection:'row',flexWrap:'wrap',gap:8},
  idiomaChip:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:8,borderRadius:20,borderWidth:1.5,borderColor:'#EDE8E2',backgroundColor:'#F8F5F0'},
  idiomaChipA:{borderColor:'#E8785A',backgroundColor:'#FFF1EE'},
  idiomaFlag:{fontSize:16},
  idiomaLbl:{fontSize:13,fontWeight:'600',color:'#A898B8'},
  idiomaLblA:{color:'#E8785A'},
  adminBtn:{flexDirection:'row',alignItems:'center',gap:12,marginHorizontal:16,marginTop:8,backgroundColor:'#1A3A5C',borderRadius:14,padding:14},
  adminEmoji:{fontSize:22},
  adminTit:{fontSize:13,fontWeight:'800',color:'#FFFFFF'},
  adminSub:{fontSize:11,color:'rgba(255,255,255,0.55)',marginTop:1},
});
