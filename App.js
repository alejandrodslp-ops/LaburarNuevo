import React,{useEffect,useRef,useState} from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Text, StyleSheet, ActivityIndicator, Linking, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { LinearGradient } from "expo-linear-gradient";
import { AppProvider, useApp } from "./src/services/AppContext";
import { supabase } from "./src/services/supabase";
import { TouchableOpacity } from "react-native";
import { I18nProvider, useI18n } from "./src/services/I18nContext";
import CoachMarkPerfil from "./src/components/CoachMarkPerfil";
import CalificacionModal from "./src/components/CalificacionModal";

import HomeScreen from "./src/screens/HomeScreen";
import BuscarScreen from "./src/screens/BuscarScreen";
import ConcursaScreen from "./src/screens/ConcursaScreen";
import ConcursaDetalleScreen from "./src/screens/ConcursaDetalleScreen";
import MensajesScreen from "./src/screens/MensajesScreen";
import PerfilScreen from "./src/screens/PerfilScreen";
import PagoScreen from "./src/screens/PagoScreen";
import ChatScreen from "./src/screens/shared/ChatScreen";
import SelectorOficioScreen from "./src/screens/shared/SelectorOficioScreen";
import OnboardingScreen from "./src/screens/auth/OnboardingScreen";
import WelcomeScreen from "./src/screens/auth/WelcomeScreen";
import RoleSelectScreen from "./src/screens/auth/RoleSelectScreen";
import LoginScreen from "./src/screens/auth/LoginScreen";
import RegisterScreen from "./src/screens/auth/RegisterScreen";
import RegisterEmpresaScreen from "./src/screens/auth/RegisterEmpresaScreen";
import BienvenidaEmpresaScreen from "./src/screens/company/BienvenidaEmpresaScreen";
import HomeEmpresaScreen from "./src/screens/company/HomeEmpresaScreen";
import BuscarEmpresaScreen from "./src/screens/company/BuscarEmpresaScreen";
import PerfilEmpresaScreen from "./src/screens/company/PerfilEmpresaScreen";
import EditarPerfilScreen from "./src/screens/worker/EditarPerfilScreen";
import PropuestaScreen from "./src/screens/worker/PropuestaScreen";
import EncuestaRechazoScreen from "./src/screens/worker/EncuestaRechazoScreen";
import PagoActivacionScreen from "./src/screens/worker/PagoActivacionScreen";
import EditarPerfilEmpleadorScreen from "./src/screens/employer/EditarPerfilEmpleadorScreen";
import EditarPerfilEmpleadorDatosScreen from "./src/screens/employer/EditarPerfilEmpleadorDatosScreen";
import PerfilTrabajadorScreen from "./src/screens/employer/PerfilTrabajadorScreen";
import HistorialScreen from "./src/screens/employer/HistorialScreen";
import OfertasEmpleadorScreen from "./src/screens/employer/OfertasEmpleadorScreen";
import CrearOfertaScreen from "./src/screens/employer/CrearOfertaScreen";
import CVScreen from "./src/screens/worker/CVScreen";
import TerminosScreen from "./src/screens/TerminosScreen";
import PrivacidadScreen from "./src/screens/PrivacidadScreen";
import AdminScreen from "./src/screens/admin/AdminScreen";
import WaitlistScreen from "./src/screens/WaitlistScreen";
import VerificarTelefonoScreen from "./src/screens/shared/VerificarTelefonoScreen";
import VerificarEmailScreen from "./src/screens/shared/VerificarEmailScreen";
import VerificacionExitosaScreen from "./src/screens/shared/VerificacionExitosaScreen";

const Tab=createBottomTabNavigator();
const Stack=createStackNavigator();

function TabIcon({name,focused}){
  const icons={Inicio:"🏠",Buscar:"🔍",Concursa:"🏛️",Mensajes:"💬",Perfil:"👤",Cuenta:"👤",Ofertas:"📋"};
  return(
    <View style={{alignItems:"center"}}>
      {focused&&<View style={ss.ind}/>}
      <Text style={{fontSize:18,color:focused?"#4DC8C4":"#A898B8"}}>{icons[name]}</Text>
    </View>
  );
}

const TAB_CARD={headerShown:false};

function BuscarStack(){
  return(
    <Stack.Navigator screenOptions={TAB_CARD}>
      <Stack.Screen name="BuscarMain" component={BuscarScreen}/>
      <Stack.Screen name="Pago" component={PagoScreen}/>
      <Stack.Screen name="PerfilTrabajador" component={PerfilTrabajadorScreen}/>
      <Stack.Screen name="Historial" component={HistorialScreen}/>
    </Stack.Navigator>
  );
}

function HomeStack(){
  return(
    <Stack.Navigator screenOptions={TAB_CARD}>
      <Stack.Screen name="HomeMain" component={HomeScreen}/>
      <Stack.Screen name="Pago" component={PagoScreen}/>
      <Stack.Screen name="PagoActivacion" component={PagoActivacionScreen}/>
    </Stack.Navigator>
  );
}

function MensajesStack(){
  return(
    <Stack.Navigator screenOptions={TAB_CARD}>
      <Stack.Screen name="MensajesList" component={MensajesScreen}/>
      <Stack.Screen name="Chat" component={ChatScreen}/>
      <Stack.Screen name="Propuesta" component={PropuestaScreen}/>
      <Stack.Screen name="EncuestaRechazo" component={EncuestaRechazoScreen}/>
    </Stack.Navigator>
  );
}

function PerfilStack(){
  return(
    <Stack.Navigator screenOptions={TAB_CARD}>
      <Stack.Screen name="PerfilMain" component={PerfilScreen}/>
      <Stack.Screen name="Pago" component={PagoScreen}/>
      <Stack.Screen name="PagoActivacion" component={PagoActivacionScreen}/>
      <Stack.Screen name="EditarPerfil" component={EditarPerfilScreen}/>
      <Stack.Screen name="EditarPerfilEmpleador" component={EditarPerfilEmpleadorScreen}/>
      <Stack.Screen name="EditarPerfilEmpleadorDatos" component={EditarPerfilEmpleadorDatosScreen}/>
      <Stack.Screen name="SelectorOficio" component={SelectorOficioScreen} options={{presentation:"modal"}}/>
      <Stack.Screen name="Historial" component={HistorialScreen}/>
      <Stack.Screen name="PerfilTrabajador" component={PerfilTrabajadorScreen}/>
      <Stack.Screen name="CV" component={CVScreen}/>
      <Stack.Screen name="Terminos" component={TerminosScreen}/>
      <Stack.Screen name="Privacidad" component={PrivacidadScreen}/>
      <Stack.Screen name="Admin" component={AdminScreen}/>
      <Stack.Screen name="ConcursaDetalle" component={ConcursaDetalleScreen}/>
      <Stack.Screen name="VerificarTelefono" component={VerificarTelefonoScreen}/>
      <Stack.Screen name="VerificarEmail" component={VerificarEmailScreen}/>
      <Stack.Screen name="VerificacionExitosa" component={VerificacionExitosaScreen}/>
    </Stack.Navigator>
  );
}

function ConcursaStack(){
  return(
    <Stack.Navigator screenOptions={TAB_CARD}>
      <Stack.Screen name="ConcursaMain" component={ConcursaScreen}/>
      <Stack.Screen name="ConcursaDetalle" component={ConcursaDetalleScreen}/>
    </Stack.Navigator>
  );
}

function OfertasStack(){
  return(
    <Stack.Navigator screenOptions={TAB_CARD}>
      <Stack.Screen name="OfertasMain" component={OfertasEmpleadorScreen}/>
      <Stack.Screen name="CrearOferta" component={CrearOfertaScreen}/>
    </Stack.Navigator>
  );
}

function WorkerTabs(){
  const{session,mensajesSinLeer,perfilCompleto}=useApp();
  const{t}=useI18n();
  const esAdmin=session?.user?.email==='alejandrodslp@gmail.com';
  const incompleto=!esAdmin&&perfilCompleto===false;
  const oculto=incompleto?{tabBarButton:()=>null}:{};

  function gateListener({navigation}){
    return{
      tabPress:(e)=>{
        if(incompleto){
          e.preventDefault();
          navigation.navigate('Cuenta',{screen:'EditarPerfil',params:{desdeRegistro:true}});
        }
      }
    };
  }

  return(
    <Tab.Navigator screenOptions={({route})=>({
      headerShown:false,
      tabBarStyle:ss.bar,
      tabBarActiveTintColor:"#4DC8C4",
      tabBarInactiveTintColor:"#A898B8",
      tabBarLabelStyle:ss.lbl,
      tabBarIcon:({focused})=><TabIcon name={route.name} focused={focused}/>,
    })}>
      <Tab.Screen name="Inicio" component={HomeStack} options={{title:t('tab_inicio'),...oculto}} listeners={gateListener}/>
      <Tab.Screen name="Concursa" component={ConcursaStack} options={{title:t('tab_concursa'),...oculto}} listeners={gateListener}/>
      <Tab.Screen name="Mensajes" component={MensajesStack}
        options={{title:t('tab_mensajes'),tabBarBadge:mensajesSinLeer>0?mensajesSinLeer:undefined,...oculto}} listeners={gateListener}/>
      <Tab.Screen name="Cuenta" component={PerfilStack} options={{title:t('tab_cuenta')}} listeners={gateListener}/>
    </Tab.Navigator>
  );
}

function EmployerTabs(){
  const{mensajesSinLeer,session,empleadorDatosCompletos}=useApp();
  const{t}=useI18n();
  const esAdmin=session?.user?.email==='alejandrodslp@gmail.com';
  const datosFaltantes=!esAdmin&&empleadorDatosCompletos===false;

  return(
    <Tab.Navigator screenOptions={({route})=>({
      headerShown:false,
      tabBarStyle:ss.bar,
      tabBarActiveTintColor:"#E8785A",
      tabBarInactiveTintColor:"#A898B8",
      tabBarLabelStyle:ss.lbl,
      tabBarIcon:({focused})=><TabIcon name={route.name} focused={focused}/>,
    })}>
      <Tab.Screen name="Inicio" component={HomeStack} options={{title:t('tab_inicio')}}/>
      <Tab.Screen name="Buscar" component={BuscarStack} options={{title:t('tab_buscar')}}
        listeners={({navigation})=>({
          tabPress:(e)=>{
            if(datosFaltantes){
              e.preventDefault();
              Alert.alert(
                'Datos incompletos',
                'Para buscar trabajadores necesitás completar tus datos personales (nombre, país, ciudad y dirección).',
                [
                  {text:'Ahora no',style:'cancel'},
                  {text:'Completar datos',onPress:()=>navigation.navigate('Cuenta',{screen:'EditarPerfilEmpleadorDatos'})},
                ]
              );
            }
          }
        })}
      />
      <Tab.Screen name="Ofertas" component={OfertasStack} options={{title:'Ofertas'}}/>
      <Tab.Screen name="Mensajes" component={MensajesStack}
        options={{title:t('tab_mensajes'),tabBarBadge:mensajesSinLeer>0?mensajesSinLeer:undefined}}/>
      <Tab.Screen name="Cuenta" component={PerfilStack} options={{title:t('tab_cuenta')}}/>
    </Tab.Navigator>
  );
}

function CompanyTabs(){
  return(
    <Tab.Navigator screenOptions={({route})=>({
      headerShown:false,
      tabBarStyle:ss.bar,
      tabBarActiveTintColor:"#3DA882",
      tabBarInactiveTintColor:"#A898B8",
      tabBarLabelStyle:ss.lbl,
      tabBarIcon:({focused})=><TabIcon name={route.name} focused={focused}/>,
    })}>
      <Tab.Screen name="Inicio" component={HomeEmpresaScreen}/>
      <Tab.Screen name="Explorar" component={BuscarEmpresaScreen}/>
      <Tab.Screen name="Cuenta" component={PerfilEmpresaScreen}/>
    </Tab.Navigator>
  );
}

function CompanyStack(){
  return(
    <Stack.Navigator screenOptions={{headerShown:false}}>
      <Stack.Screen name="CompanyTabsMain" component={CompanyTabs}/>
      <Stack.Screen name="BienvenidaEmpresa" component={BienvenidaEmpresaScreen}/>
      <Stack.Screen name="Pago" component={PagoScreen}/>
      <Stack.Screen name="PerfilTrabajador" component={PerfilTrabajadorScreen}/>
    </Stack.Navigator>
  );
}

function AuthStack(){
  return(
    <Stack.Navigator screenOptions={{headerShown:false}}>
      <Stack.Screen name="Welcome" component={WelcomeScreen}/>
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen}/>
      <Stack.Screen name="Onboarding" component={OnboardingScreen}/>
      <Stack.Screen name="Login" component={LoginScreen}/>
      <Stack.Screen name="Register" component={RegisterScreen}/>
      <Stack.Screen name="RegisterEmpresa" component={RegisterEmpresaScreen}/>
      <Stack.Screen name="Waitlist" component={WaitlistScreen}/>
      <Stack.Screen name="VerificarEmail" component={VerificarEmailScreen}/>
      <Stack.Screen name="VerificacionExitosa" component={VerificacionExitosaScreen}/>
    </Stack.Navigator>
  );
}

const FRASES_SPLASH={
  worker:"Solo hay una emoción peor que no tener la vida que deseas, es tener que reconocer que no estás haciendo nada para cambiarla.",
  employer:"El equipo que construís hoy define el negocio que tenés mañana. Las personas correctas no se encuentran solas — hay que ir a buscarlas.",
  company:"Las empresas no crecen solas. Crecen con la gente correcta. Encontrá el talento y los servicios que necesitás para llevar tu empresa al siguiente nivel.",
};

function PantallaFrase({onContinuar, mensajeExtra, modo}){
  const frase=FRASES_SPLASH[modo]||FRASES_SPLASH.worker;
  return(
    <LinearGradient colors={["#E8785A","#C75A9E"]} style={{flex:1,justifyContent:"center",alignItems:"center",paddingHorizontal:36}}>
      <Text style={{fontSize:38,marginBottom:32}}>✨</Text>
      <Text style={{color:"#FFFFFF",fontSize:18,fontWeight:"700",lineHeight:28,textAlign:"center",letterSpacing:-0.3,marginBottom:16}}>
        {frase}
      </Text>
      <Text style={{color:"rgba(255,255,255,0.75)",fontSize:13,fontWeight:"600",textAlign:"right",alignSelf:"flex-end",letterSpacing:0.5,marginBottom:40}}>— A.DSL</Text>
      {mensajeExtra&&(
        <View style={{backgroundColor:"rgba(0,0,0,0.2)",borderRadius:14,padding:16,marginBottom:24,width:"100%"}}>
          <Text style={{color:"#FFFFFF",fontSize:14,fontWeight:"600",textAlign:"center",lineHeight:20}}>{mensajeExtra}</Text>
        </View>
      )}
      {onContinuar
        ?<TouchableOpacity onPress={onContinuar} style={{marginTop:8,width:64,height:64,borderRadius:32,backgroundColor:"rgba(255,255,255,0.25)",borderWidth:2,borderColor:"rgba(255,255,255,0.5)",alignItems:"center",justifyContent:"center"}}>
            <Text style={{color:"#FFFFFF",fontSize:32,lineHeight:36,fontWeight:"900"}}>›</Text>
          </TouchableOpacity>
        :<ActivityIndicator size="small" color="rgba(255,255,255,0.6)" style={{marginTop:8}}/>
      }
    </LinearGradient>
  );
}

function Navigation({navigationRef,onTabChange}){
  const{session,modoActivo}=useApp();
  const[cargando,setCargando]=useState(true);
  const[splashVisible,setSplashVisible]=useState(true);

  useEffect(()=>{
    const t=setTimeout(()=>setSplashVisible(false),800);
    return()=>clearTimeout(t);
  },[]);
  const[fraseVisible,setFraseVisible]=useState(false);
  const[fraseMensaje,setFraseMensaje]=useState('');
  const[fraseModo,setFraseModo]=useState('worker');

  useEffect(()=>{
    (async()=>{
      // Primera vez que abre la app
      const yaVio=await AsyncStorage.getItem('frase_bienvenida_v2');
      if(!yaVio){
        await AsyncStorage.setItem('frase_bienvenida_v2','1');
        setFraseVisible(true);
      }
      setCargando(false);
    })();
  },[]);

  // Primera vez como empleador o empresa → mostrar su frase
  useEffect(()=>{
    if(!session||!modoActivo||modoActivo==='worker')return;
    (async()=>{
      const key=`frase_bienvenida_${modoActivo}_v1`;
      const yaVio=await AsyncStorage.getItem(key);
      if(!yaVio){
        await AsyncStorage.setItem(key,'1');
        setFraseModo(modoActivo);
        setFraseVisible(true);
      }
    })();
  },[session?.user?.id,modoActivo]);

  // Cuando carga la sesión, verificar trial
  useEffect(()=>{
    if(!session||cargando)return;
    (async()=>{
      try{
        const{data:{user}}=await supabase.auth.getUser();
        if(!user||user.email==='alejandrodslp@gmail.com')return;
        const{data}=await supabase.from('profiles').select('perfil_activo_hasta').eq('id',user.id).single();
        if(!data?.perfil_activo_hasta)return;
        const hasta=new Date(data.perfil_activo_hasta);
        const diffH=(hasta-new Date())/(1000*60*60);
        if(diffH>-48&&diffH<24){
          const msg=diffH<0
            ?"Tu período de prueba gratuita terminó. Activá tu perfil para seguir siendo visible a los empleadores."
            :"Tu período de prueba gratuita termina hoy. Aprovechá para activar tu perfil.";
          setFraseMensaje(msg);
          setFraseVisible(true);
        }
      }catch(e){}
    })();
  },[session,cargando]);

  useEffect(()=>{
    const sub=Linking.addEventListener('url',({url})=>{handleDeepLink(url);});
    Linking.getInitialURL().then(url=>{if(url)handleDeepLink(url);});

    // Cuando el usuario toca la notificación de vencimiento
    const notifSub=Notifications.addNotificationResponseReceivedListener(response=>{
      const{pantalla,metodo}=response.notification.request.content.data||{};
      if(metodo==='sms'){
        Linking.openURL('sms:1234?body=NEXU%20ACTIVAR');
        return;
      }
      if(pantalla&&navigationRef.current){
        navigationRef.current.navigate(pantalla);
      }
    });

    return()=>{sub.remove();notifSub.remove();};
  },[]);

  function handleDeepLink(url){
    if(!url)return;
    const params=new URLSearchParams(url.split('?')[1]||'');
    if(url.includes('pago-exitoso')){
      const workerId=params.get('worker_id');
      if(workerId&&navigationRef.current){
        navigationRef.current.navigate('Buscar',{pagoExitoso:true,workerId});
      }
    }
    const ref=params.get('r');
    if(ref) AsyncStorage.setItem('referral_code',ref);
  }

  // Cargando sesión
  if(session===undefined||cargando||splashVisible){
    return(
      <LinearGradient colors={["#0D1117","#1A2640","#0D1F2D"]} style={{flex:1,justifyContent:"center",alignItems:"center",gap:16}}>
        <View style={{backgroundColor:"#0D1117",borderRadius:20,paddingHorizontal:18,paddingVertical:14,flexDirection:"row",alignItems:"center",borderWidth:2.5,borderColor:"#E8785A"}}>
          <View style={{position:"relative"}}>
            <Text style={{fontSize:38,fontWeight:"900",color:"#E8785A",letterSpacing:-1}}>Nexu</Text>
            <Text style={{fontSize:16,position:"absolute",bottom:2,right:-8}}>🧩</Text>
          </View>
        </View>
        <Text style={{fontSize:22,fontWeight:"700",color:"#FFFFFF",letterSpacing:-0.3}}>Bienvenido</Text>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.4)"/>
      </LinearGradient>
    );
  }

  // Primera vez o vencimiento de trial → frase
  if(fraseVisible){
    return <PantallaFrase mensajeExtra={fraseMensaje||null} modo={fraseModo} onContinuar={()=>{setFraseVisible(false);setFraseMensaje('');setFraseModo('worker');}}/>;
  }

  const esEmpleador=modoActivo==="employer"||modoActivo==="company";

  return(
    <NavigationContainer ref={navigationRef} onStateChange={()=>{
      const st=navigationRef.current?.getRootState();
      const activeTab=st?.routes?.[st.index]?.name;
      onTabChange?.(activeTab);
    }}>
      {session?(modoActivo==="company"?<CompanyStack/>:(esEmpleador?<EmployerTabs/>:<WorkerTabs/>)):<AuthStack/>}
    </NavigationContainer>
  );
}

function EmailVerifCheck({navigationRef}){
  const{emailPendiente,clearEmailPendiente,session}=useApp();
  useEffect(()=>{
    if(emailPendiente&&session&&navigationRef.current){
      clearEmailPendiente();
      const email=session.user?.email||"";
      navigationRef.current.navigate("Cuenta",{screen:"VerificarEmail",params:{email}});
    }
  },[emailPendiente,session]);
  return null;
}

function CoachMark({navigationRef}){
  const{coachPendiente,dismissCoach,modoActivo,activarCoachEditar}=useApp();
  if(modoActivo!=="worker")return null;

  function irACuenta(){
    dismissCoach();
    activarCoachEditar();
    navigationRef.current?.navigate("Cuenta");
  }

  return(
    <CoachMarkPerfil
      visible={coachPendiente}
      onDismiss={dismissCoach}
      onIrACuenta={irACuenta}
    />
  );
}

function CalificacionOverlay(){
  const{calificacionPendiente,completarCalificacion}=useApp();
  if(!calificacionPendiente)return null;
  return(
    <CalificacionModal
      visible={true}
      propuestaId={calificacionPendiente.propuestaId}
      calificadoId={calificacionPendiente.calificadoId}
      calificadoNombre={calificacionPendiente.calificadoNombre}
      rolCalificador={calificacionPendiente.rolCalificador}
      onComplete={completarCalificacion}
    />
  );
}



export default function App(){
  const navigationRef=useRef(null);
  return(
    <I18nProvider>
      <AppProvider>
        <StripeProvider publishableKey="pk_test_51TSkzUD0pEHJeBo6QBkfbngTviGNvb21g7oPmykcVgsnvZxsI4H8aBltMdVnxEsBUy9ShdjTsm9jN7pUzggSGyMY0030LgkEM1">
          <SafeAreaProvider>
            <StatusBar style="auto"/>
            <Navigation navigationRef={navigationRef} onTabChange={()=>{}}/>
            <EmailVerifCheck navigationRef={navigationRef}/>
            <CoachMark navigationRef={navigationRef}/>
            <CalificacionOverlay/>
          </SafeAreaProvider>
        </StripeProvider>
      </AppProvider>
    </I18nProvider>
  );
}

const ss=StyleSheet.create({
  bar:{backgroundColor:"#FFFFFF",borderTopColor:"#EDE8E2",borderTopWidth:1,height:64,paddingBottom:8,paddingTop:4},
  lbl:{fontSize:9,fontWeight:"700",letterSpacing:0.3},
  ind:{position:"absolute",top:-4,width:24,height:3,backgroundColor:"#E8785A",borderRadius:2},
  bannerWrap:{position:"absolute",left:0,right:0,shadowColor:"#000",shadowOffset:{width:0,height:-5},shadowOpacity:0.32,shadowRadius:14,elevation:20},
  bannerGrad:{flexDirection:"row",alignItems:"flex-start",paddingHorizontal:18,paddingTop:18,paddingBottom:20,gap:14},
  bannerIcon:{fontSize:28,marginTop:18},
  bannerLabel:{color:"rgba(255,255,255,0.75)",fontSize:11,fontWeight:"700",letterSpacing:1.6,textTransform:"uppercase",marginBottom:8},
  bannerFrase:{color:"#FFFFFF",fontSize:16,fontWeight:"600",lineHeight:24,letterSpacing:-0.2},
  bannerAutor:{color:"rgba(255,255,255,0.72)",fontSize:12.5,fontWeight:"600",textAlign:"right",marginTop:10,letterSpacing:0.3},
});
