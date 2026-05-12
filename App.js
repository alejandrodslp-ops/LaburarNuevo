import React,{useEffect,useRef} from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Text, StyleSheet, ActivityIndicator, Linking } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { AppProvider, useApp } from "./src/services/AppContext";
import CoachMarkPerfil from "./src/components/CoachMarkPerfil";

import HomeScreen from "./src/screens/HomeScreen";
import BuscarScreen from "./src/screens/BuscarScreen";
import ConcursaScreen from "./src/screens/ConcursaScreen";
import MensajesScreen from "./src/screens/MensajesScreen";
import PerfilScreen from "./src/screens/PerfilScreen";
import PagoScreen from "./src/screens/PagoScreen";
import ChatScreen from "./src/screens/shared/ChatScreen";
import SelectorOficioScreen from "./src/screens/shared/SelectorOficioScreen";
import OnboardingScreen from "./src/screens/auth/OnboardingScreen";
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

const Tab=createBottomTabNavigator();
const Stack=createStackNavigator();

function TabIcon({name,focused}){
  const icons={Inicio:"🏠",Buscar:"🔍",Concursa:"🏛️",Mensajes:"💬",Perfil:"👤",Cuenta:"👤"};
  return(
    <View style={{alignItems:"center"}}>
      {focused&&<View style={ss.ind}/>}
      <Text style={{fontSize:18,color:focused?"#4DC8C4":"#A898B8"}}>{icons[name]}</Text>
    </View>
  );
}

function BuscarStack(){
  return(
    <Stack.Navigator screenOptions={{headerShown:false}}>
      <Stack.Screen name="BuscarMain" component={BuscarScreen}/>
      <Stack.Screen name="Pago" component={PagoScreen}/>
      <Stack.Screen name="PerfilTrabajador" component={PerfilTrabajadorScreen}/>
      <Stack.Screen name="Historial" component={HistorialScreen}/>
    </Stack.Navigator>
  );
}

function HomeStack(){
  return(
    <Stack.Navigator screenOptions={{headerShown:false}}>
      <Stack.Screen name="HomeMain" component={HomeScreen}/>
      <Stack.Screen name="Pago" component={PagoScreen}/>
      <Stack.Screen name="PagoActivacion" component={PagoActivacionScreen}/>
    </Stack.Navigator>
  );
}

function MensajesStack(){
  return(
    <Stack.Navigator screenOptions={{headerShown:false}}>
      <Stack.Screen name="MensajesList" component={MensajesScreen}/>
      <Stack.Screen name="Chat" component={ChatScreen}/>
      <Stack.Screen name="Propuesta" component={PropuestaScreen}/>
      <Stack.Screen name="EncuestaRechazo" component={EncuestaRechazoScreen}/>
    </Stack.Navigator>
  );
}

function PerfilStack(){
  return(
    <Stack.Navigator screenOptions={{headerShown:false}}>
      <Stack.Screen name="PerfilMain" component={PerfilScreen}/>
      <Stack.Screen name="Pago" component={PagoScreen}/>
      <Stack.Screen name="PagoActivacion" component={PagoActivacionScreen}/>
      <Stack.Screen name="EditarPerfil" component={EditarPerfilScreen}/>
      <Stack.Screen name="EditarPerfilEmpleador" component={EditarPerfilEmpleadorScreen}/>
      <Stack.Screen name="EditarPerfilEmpleadorDatos" component={EditarPerfilEmpleadorDatosScreen}/>
      <Stack.Screen name="SelectorOficio" component={SelectorOficioScreen} options={{presentation:"modal"}}/>
      <Stack.Screen name="Historial" component={HistorialScreen}/>
      <Stack.Screen name="PerfilTrabajador" component={PerfilTrabajadorScreen}/>
    </Stack.Navigator>
  );
}

function WorkerTabs(){
  const{mensajesSinLeer}=useApp();
  return(
    <Tab.Navigator screenOptions={({route})=>({
      headerShown:false,
      tabBarStyle:ss.bar,
      tabBarActiveTintColor:"#4DC8C4",
      tabBarInactiveTintColor:"#A898B8",
      tabBarLabelStyle:ss.lbl,
      tabBarIcon:({focused})=><TabIcon name={route.name} focused={focused}/>,
    })}>
      <Tab.Screen name="Inicio" component={HomeStack}/>
      <Tab.Screen name="Concursa" component={ConcursaScreen}/>
      <Tab.Screen name="Mensajes" component={MensajesStack}
        options={{tabBarBadge:mensajesSinLeer>0?mensajesSinLeer:undefined}}/>
      <Tab.Screen name="Cuenta" component={PerfilStack}/>
    </Tab.Navigator>
  );
}

function EmployerTabs(){
  const{mensajesSinLeer}=useApp();
  return(
    <Tab.Navigator screenOptions={({route})=>({
      headerShown:false,
      tabBarStyle:ss.bar,
      tabBarActiveTintColor:"#E8785A",
      tabBarInactiveTintColor:"#A898B8",
      tabBarLabelStyle:ss.lbl,
      tabBarIcon:({focused})=><TabIcon name={route.name} focused={focused}/>,
    })}>
      <Tab.Screen name="Inicio" component={HomeStack}/>
      <Tab.Screen name="Buscar" component={BuscarStack}/>
      <Tab.Screen name="Mensajes" component={MensajesStack}
        options={{tabBarBadge:mensajesSinLeer>0?mensajesSinLeer:undefined}}/>
      <Tab.Screen name="Cuenta" component={PerfilStack}/>
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
    </Stack.Navigator>
  );
}

function AuthStack(){
  return(
    <Stack.Navigator screenOptions={{headerShown:false}}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen}/>
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen}/>
      <Stack.Screen name="Login" component={LoginScreen}/>
      <Stack.Screen name="Register" component={RegisterScreen}/>
      <Stack.Screen name="RegisterEmpresa" component={RegisterEmpresaScreen}/>
    </Stack.Navigator>
  );
}

function Navigation({navigationRef}){
  const{session,modoActivo}=useApp();

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

  if(session===undefined){
    return(
      <View style={{flex:1,justifyContent:"center",alignItems:"center",backgroundColor:"#FBF8F4"}}>
        <ActivityIndicator size="large" color="#E8785A"/>
      </View>
    );
  }

  const esEmpleador=modoActivo==="employer"||modoActivo==="company";

  return(
    <NavigationContainer ref={navigationRef}>
      {session?(modoActivo==="company"?<CompanyStack/>:(esEmpleador?<EmployerTabs/>:<WorkerTabs/>)):<AuthStack/>}
    </NavigationContainer>
  );
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

export default function App(){
  const navigationRef=useRef(null);
  return(
    <AppProvider>
      <StripeProvider publishableKey="pk_test_51TSkzUD0pEHJeBo6QBkfbngTviGNvb21g7oPmykcVgsnvZxsI4H8aBltMdVnxEsBUy9ShdjTsm9jN7pUzggSGyMY0030LgkEM1">
        <SafeAreaProvider>
          <StatusBar style="light"/>
          <Navigation navigationRef={navigationRef}/>
          <CoachMark navigationRef={navigationRef}/>
        </SafeAreaProvider>
      </StripeProvider>
    </AppProvider>
  );
}

const ss=StyleSheet.create({
  bar:{backgroundColor:"#FFFFFF",borderTopColor:"#EDE8E2",borderTopWidth:1,height:64,paddingBottom:8,paddingTop:4},
  lbl:{fontSize:9,fontWeight:"700",letterSpacing:0.3},
  ind:{position:"absolute",top:-4,width:24,height:3,backgroundColor:"#E8785A",borderRadius:2},
});
