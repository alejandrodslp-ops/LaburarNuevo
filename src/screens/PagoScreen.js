import React,{useState,useEffect,useRef} from "react";
import{View,Text,StyleSheet,TouchableOpacity,Alert,ActivityIndicator,ScrollView,Linking,AppState}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import{supabase}from "../services/supabase";
import * as SMS from "expo-sms";

const PAISES_SA=["AR","BO","BR","CL","CO","EC","PY","PE","UY","VE","MX","GT","HN","SV","NI","CR","PA","CU","HT","DO","PR","BZ","GY","SR","TT","JM","BB","LC","VC","GD","AG","DM","KN"];
const MONEDAS={"AR":{simbolo:"ARS",tasa:1200},"BO":{simbolo:"BOB",tasa:6.9},"BR":{simbolo:"BRL",tasa:5.1},"CL":{simbolo:"CLP",tasa:950},"CO":{simbolo:"COP",tasa:4100},"EC":{simbolo:"USD",tasa:1},"PY":{simbolo:"PYG",tasa:7400},"PE":{simbolo:"PEN",tasa:3.8},"UY":{simbolo:"UYU",tasa:41},"VE":{simbolo:"USD",tasa:1},"MX":{simbolo:"MXN",tasa:17},"GT":{simbolo:"GTQ",tasa:7.8},"HN":{simbolo:"HNL",tasa:24.8},"SV":{simbolo:"USD",tasa:1},"NI":{simbolo:"NIO",tasa:36.6},"CR":{simbolo:"CRC",tasa:520},"PA":{simbolo:"USD",tasa:1}};
const STRIPE_LINK_3USD="https://buy.stripe.com/test_4gMbJ09yY17U9l8gtFfAc00";
const STRIPE_LINK_10USD="https://buy.stripe.com/test_4gMbJ09yY17U9l8gtFfAc00"; // TODO: reemplazar con link Stripe real de $20

export default function PagoScreen({navigation,route}){
  const perfil=route?.params?.perfil||null;
  const[loadingMP,setLoadingMP]=useState(false);
  const[loadingTarjeta,setLoadingTarjeta]=useState(false);
  const[loadingSMS,setLoadingSMS]=useState(false);
  const[pais,setPais]=useState("UY");
  const[paquete,setPaquete]=useState('3');
  const[esperandoPago,setEsperandoPago]=useState(false);
  const[mostrarBotonContinuar,setMostrarBotonContinuar]=useState(false);
  const intervaloRef=useRef(null);
  const timeoutRef=useRef(null);
  const appStateRef=useRef(AppState.currentState);

  async function verificarPago(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return false;
      const{data}=await supabase.from('profiles').select('visualizaciones_disponibles').eq('id',user.id).single();
      if(data&&data.visualizaciones_disponibles>0){
        clearInterval(intervaloRef.current);
        clearTimeout(timeoutRef.current);
        setEsperandoPago(false);
        setMostrarBotonContinuar(false);
        if(perfil)navigation.replace('PerfilTrabajador',{perfil});
        return true;
      }
    }catch(e){}
    return false;
  }

  useEffect(()=>{
    if(!esperandoPago)return;

    // Polling cada 3 segundos
    intervaloRef.current=setInterval(verificarPago,3000);

    // Si en 45 segundos no se confirma, mostrar botón manual
    timeoutRef.current=setTimeout(()=>{
      setMostrarBotonContinuar(true);
    },45000);

    // Verificar también cuando el usuario vuelve a la app desde el navegador
    const sub=AppState.addEventListener('change',async(nextState)=>{
      if(appStateRef.current.match(/inactive|background/)&&nextState==='active'){
        await verificarPago();
      }
      appStateRef.current=nextState;
    });

    return()=>{
      clearInterval(intervaloRef.current);
      clearTimeout(timeoutRef.current);
      sub.remove();
    };
  },[esperandoPago]);

  useEffect(()=>{
    const sub=Linking.addEventListener('url',({url})=>{
      if(url.includes('pago-exitoso')){
        clearInterval(intervaloRef.current);
        clearTimeout(timeoutRef.current);
        setEsperandoPago(false);
        if(perfil)navigation.replace('PerfilTrabajador',{perfil});
      }
    });
    return()=>sub.remove();
  },[perfil]);

  const esSudamerica=PAISES_SA.includes(pais);
  const moneda=MONEDAS[pais];

  const PAQUETES={
    '3':{cantidad:3,precioSA:3.99,precioWorld:7.98,porPerfilSA:1.33,porPerfilWorld:2.66},
    '10':{cantidad:10,precioSA:9.99,precioWorld:19.99,porPerfilSA:1.00,porPerfilWorld:2.00},
  };
  const pkg=PAQUETES[paquete];
  const montoPago=esSudamerica?pkg.precioSA:pkg.precioWorld;
  const porPerfil=esSudamerica?pkg.porPerfilSA:pkg.porPerfilWorld;
  const precioLocal=moneda&&moneda.simbolo!=="USD"?Math.round(montoPago*moneda.tasa):null;

  useEffect(()=>{
    detectarPais();
  },[]);

  async function detectarPais(){
    try{
      const res=await fetch("https://ipapi.co/json/");
      const data=await res.json();
      if(data.country_code)setPais(data.country_code);
    }catch(e){setPais("UY");}
  }

  async function handleMP(){
    setLoadingMP(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){Alert.alert("Error","Debes iniciar sesion");return;}
      const{data,error}=await supabase.functions.invoke("crear-pago",{
        body:{user_id:user.id,monto:montoPago,descripcion:"Nexu - "+pkg.cantidad+" perfiles",worker_id:perfil?.id||'',cantidad_perfiles:pkg.cantidad},
      });
      if(error)throw error;
      await Linking.openURL(data.sandbox_init_point||data.init_point);
      setEsperandoPago(true);
    }catch(e){Alert.alert("Error","No se pudo conectar con MercadoPago.");}
    finally{setLoadingMP(false);}
  }

  async function handleTarjeta(){
    setLoadingTarjeta(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){Alert.alert("Error","Debes iniciar sesion");return;}
      if(esSudamerica){
        const{data,error}=await supabase.functions.invoke("crear-pago",{
          body:{user_id:user.id,monto:montoPago,descripcion:"Nexu - "+pkg.cantidad+" perfiles",cantidad_perfiles:pkg.cantidad},
        });
        if(error)throw error;
        await Linking.openURL(data.sandbox_init_point||data.init_point);
      }else{
        await Linking.openURL(paquete==='10'?STRIPE_LINK_10USD:STRIPE_LINK_3USD);
      }
    }catch(e){Alert.alert("Error","No se pudo procesar el pago.");}
    finally{setLoadingTarjeta(false);}
  }

  async function handleSMS(){
    setLoadingSMS(true);
    try{
      const isAvailable=await SMS.isAvailableAsync();
      if(!isAvailable){Alert.alert("SMS no disponible","Tu dispositivo no soporta envio de SMS.");return;}
      const{result}=await SMS.sendSMSAsync(["1234"],"NEXU PAGO");
      if(result==="sent"||result==="unknown") setEsperandoPago(true);
    }catch(e){Alert.alert("Error","No se pudo enviar el SMS.");}
    finally{setLoadingSMS(false);}
  }

  return(
    <SafeAreaView style={ss.container} edges={["top"]}>
      <View style={ss.header}>
        <TouchableOpacity onPress={()=>navigation.goBack()}>
          <Text style={ss.back}>Volver</Text>
        </TouchableOpacity>
        <Text style={ss.headerTit}>Ver perfiles</Text>
        <View style={{width:50}}/>
      </View>
      <ScrollView contentContainerStyle={ss.content}>

        <View style={ss.heroCard}>
          <Text style={ss.heroSub}>Accede al perfil completo del profesional y enviále un mensaje de interes para coordinar.</Text>
        </View>

        <View style={ss.beneficios}>
          <Text style={ss.beneficiosTit}>QUE INCLUYE</Text>
          {[
            {emoji:"👤",txt:"Nombre de pila, edad y ciudad"},
            {emoji:"⭐",txt:"Calificacion y referencias verificadas"},
            {emoji:"🎓",txt:"Escolaridad, idiomas y habilidades"},
            {emoji:"📅",txt:"Disponibilidad y tipo de empleo"},
            {emoji:"💬",txt:"Enviar mensaje de interes al trabajador"},
            {emoji:"🤝",txt:"El trabajador recibe tu interes y vos coordinan directamente"},
          ].map((b,i)=>(
            <View key={i} style={ss.beneficioRow}>
              <Text style={ss.beneficioEmoji}>{b.emoji}</Text>
              <Text style={ss.beneficioTxt}>{b.txt}</Text>
            </View>
          ))}
        </View>

        <View style={ss.paquetesSection}>
          <Text style={ss.stit}>ELEGIR PAQUETE</Text>
          <View style={ss.paquetesRow}>
            <TouchableOpacity style={[ss.paqueteCard,paquete==='3'&&ss.paqueteCardA]} onPress={()=>setPaquete('3')}>
              <Text style={[ss.paqueteCant,paquete==='3'&&ss.paqueteTextA]}>3</Text>
              <Text style={[ss.paqueteLabel,paquete==='3'&&ss.paqueteTextA]}>perfiles</Text>
              <Text style={[ss.paquetePrecio,paquete==='3'&&ss.paqueteTextA]}>U${esSudamerica?"1.33":"2.66"}</Text>
              <Text style={[ss.paquetePorPerfil,paquete==='3'&&ss.paqueteSubA]}>por perfil</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[ss.paqueteCard,paquete==='10'&&ss.paqueteCardA,ss.paqueteCardDest]} onPress={()=>setPaquete('10')}>
              <View style={ss.paqueteBadge}><Text style={ss.paqueteBadgeTxt}>-25%</Text></View>
              <Text style={[ss.paqueteCant,paquete==='10'&&ss.paqueteTextA]}>10</Text>
              <Text style={[ss.paqueteLabel,paquete==='10'&&ss.paqueteTextA]}>perfiles</Text>
              <Text style={[ss.paquetePrecio,paquete==='10'&&ss.paqueteTextA]}>U${esSudamerica?"1.00":"2.00"}</Text>
              <Text style={[ss.paquetePorPerfil,paquete==='10'&&ss.paqueteSubA]}>por perfil</Text>
            </TouchableOpacity>
          </View>

          <View style={ss.resumenPrecio}>
            <Text style={ss.resumenTxt}>Total a pagar: <Text style={ss.resumenMonto}>U${montoPago.toFixed(2)}</Text></Text>
            {precioLocal&&moneda&&<Text style={ss.resumenLocal}>≈ {moneda.simbolo} {precioLocal.toLocaleString()}</Text>}
            <Text style={ss.resumenPorPerfil}>Pago único, no recurrente</Text>
          </View>
        </View>
        {esperandoPago&&(
          <View style={ss.esperandoWrap}>
            <ActivityIndicator color="#2DD4BF" size="small"/>
            <Text style={ss.esperandoTxt}>Verificando pago... volvé a la app cuando termines de pagar.</Text>
          </View>
        )}
        {mostrarBotonContinuar&&(
          <TouchableOpacity style={ss.yaPagueBtn} onPress={async()=>{
            clearInterval(intervaloRef.current);
            clearTimeout(timeoutRef.current);
            setEsperandoPago(false);
            setMostrarBotonContinuar(false);
            // Si el webhook no procesó aún, agregar los perfiles manualmente
            try{
              const{data:{user}}=await supabase.auth.getUser();
              if(user){
                const{data}=await supabase.from('profiles').select('visualizaciones_disponibles').eq('id',user.id).single();
                if(!data||data.visualizaciones_disponibles<=0){
                  await supabase.from('profiles').update({visualizaciones_disponibles:pkg.cantidad}).eq('id',user.id);
                }
              }
            }catch(e){}
            if(perfil)navigation.replace('PerfilTrabajador',{perfil});
          }}>
            <Text style={ss.yaPagueTxt}>✓ Ya pagué — continuar</Text>
          </TouchableOpacity>
        )}
        <Text style={ss.metodosTit}>ELEGIR METODO DE PAGO</Text>

        {esSudamerica&&(
          <TouchableOpacity style={ss.btnWrap} onPress={handleMP} disabled={loadingMP}>
            <LinearGradient colors={["#009EE3","#0077B6"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
              {loadingMP?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>💳 MercadoPago</Text>}
            </LinearGradient>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={ss.btnWrap} onPress={handleTarjeta} disabled={loadingTarjeta}>
          <LinearGradient colors={["#2DD4BF","#14B8A6"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            {loadingTarjeta?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>💳 Tarjeta de credito / debito</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={ss.btnWrap} onPress={handleSMS} disabled={loadingSMS}>
          <LinearGradient colors={["#3DA882","#2E9472"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            {loadingSMS?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>📱 Mensaje SMS</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <Text style={ss.legal}>Al pagar aceptas los Terminos y Condiciones de Nexu. Los datos del profesional son confidenciales y no pueden compartirse con terceros.</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  container:{flex:1,backgroundColor:"#FBF8F4"},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingVertical:14,backgroundColor:"#FFFFFF",borderBottomWidth:1,borderBottomColor:"#EDE8E2"},
  back:{fontSize:14,fontWeight:"700",color:"#2DD4BF"},
  headerTit:{fontSize:16,fontWeight:"800",color:"#1A1020"},
  content:{padding:16,paddingBottom:40},
  heroCard:{backgroundColor:"#FFFFFF",borderRadius:16,padding:20,alignItems:"center",marginBottom:16,borderWidth:1,borderColor:"#EDE8E2"},
  heroSub:{fontSize:14,color:"#A898B8",textAlign:"center",lineHeight:20},
  beneficios:{backgroundColor:"#FFFFFF",borderRadius:16,padding:16,marginBottom:16,borderWidth:1,borderColor:"#EDE8E2"},
  beneficiosTit:{fontSize:10,fontWeight:"700",color:"#A898B8",letterSpacing:1,marginBottom:12},
  beneficioRow:{flexDirection:"row",alignItems:"center",gap:12,paddingVertical:8,borderBottomWidth:1,borderBottomColor:"#F2EDE6",paddingRight:8},
  beneficioEmoji:{fontSize:20},
  beneficioTxt:{fontSize:14,color:"#1A1020",fontWeight:"500",flex:1},
  // selección de paquete
  paquetesSection:{marginBottom:16},
  stit:{fontSize:10,fontWeight:"700",color:"#A898B8",letterSpacing:1,marginBottom:8},
  paquetesRow:{flexDirection:"row",gap:10,marginBottom:10},
  paqueteCard:{flex:1,backgroundColor:"#FFFFFF",borderRadius:14,padding:14,alignItems:"center",borderWidth:1.5,borderColor:"#EDE8E2",position:"relative"},
  paqueteCardA:{borderColor:"#E8785A",backgroundColor:"#FFF5F2"},
  paqueteCardDest:{borderColor:"#E8785A"},
  paqueteCant:{fontSize:32,fontWeight:"900",color:"#1A1020",lineHeight:36},
  paqueteLabel:{fontSize:13,color:"#5A4E6A",marginBottom:8},
  paquetePrecio:{fontSize:16,fontWeight:"800",color:"#1A1020",marginBottom:2},
  paquetePorPerfil:{fontSize:11,color:"#A898B8"},
  paqueteTextA:{color:"#E8785A"},
  paqueteSubA:{color:"#E8785A"},
  paqueteBadge:{position:"absolute",top:-8,right:-8,backgroundColor:"#E8785A",borderRadius:10,paddingHorizontal:8,paddingVertical:3},
  paqueteBadgeTxt:{fontSize:11,fontWeight:"800",color:"#FFFFFF"},
  resumenPrecio:{backgroundColor:"#F0FDFA",borderRadius:12,padding:14,alignItems:"center",borderWidth:1,borderColor:"#2DD4BF"},
  resumenTxt:{fontSize:14,color:"#2DD4BF",fontWeight:"600"},
  resumenMonto:{fontSize:18,fontWeight:"900",color:"#2DD4BF"},
  resumenLocal:{fontSize:13,color:"#2DD4BF",marginTop:2},
  resumenPorPerfil:{fontSize:11,color:"#A898B8",marginTop:4},
  // estado de pago
  esperandoWrap:{flexDirection:"row",alignItems:"center",gap:10,backgroundColor:"#F0FDFA",borderRadius:10,padding:12,marginBottom:12},
  esperandoTxt:{fontSize:13,color:"#2DD4BF",flex:1,lineHeight:18},
  yaPagueBtn:{backgroundColor:"#E6FBF5",borderRadius:12,paddingVertical:14,alignItems:"center",marginBottom:12,borderWidth:1.5,borderColor:"#3DA882"},
  yaPagueTxt:{fontSize:15,fontWeight:"700",color:"#2E9472"},
  // botones de pago
  metodosTit:{fontSize:10,fontWeight:"700",color:"#A898B8",letterSpacing:1,marginBottom:12},
  btnWrap:{borderRadius:14,overflow:"hidden",marginBottom:10},
  btn:{paddingVertical:16,alignItems:"center"},
  btnTxt:{color:"#FFFFFF",fontSize:16,fontWeight:"800"},
  legal:{fontSize:11,color:"#A898B8",textAlign:"center",lineHeight:16,marginTop:8},
});
