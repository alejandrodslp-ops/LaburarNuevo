import React,{useState,useEffect,useRef}from "react";
import{View,Text,StyleSheet,TouchableOpacity,ScrollView,Alert,ActivityIndicator,Linking,AppState}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import{supabase}from "../../services/supabase";

const PLANES=[
  {id:"membresia_sa",nombre:"Suscripcion",zona:"Sudamerica",precio:"U$12",periodo:"/mes",perfiles:"Hasta 10 perfiles nuevos por dia",color:"#E8785A",bg:"#FFF0ED",items:["Hasta 10 perfiles nuevos por dia durante 30 dias","Busqueda avanzada","Soporte prioritario"]},
  {id:"membresia_world",nombre:"Suscripcion",zona:"Mundial",precio:"U$24",periodo:"/mes",perfiles:"Hasta 10 perfiles nuevos por dia",color:"#3DA882",bg:"#E6FBF5",items:["Hasta 10 perfiles nuevos por dia durante 30 dias","Busqueda avanzada","Soporte prioritario"]},
  {id:"membresia_premium",nombre:"Suscripcion",zona:"Premium",precio:"U$50",periodo:"/mes",perfiles:"Perfiles ilimitados",color:"#7C3AED",bg:"#F3E8FF",items:["Perfiles ilimitados durante 30 dias","Pensado para empresas con alto volumen de busqueda","Soporte prioritario"]},
];

const BENEFICIOS=[
  {icono:"⚡",titulo:"Acceso inmediato",desc:"Conectate con trabajadores calificados en tiempo real, sin demoras."},
  {icono:"💰",titulo:"Sin intermediarios",desc:"Cero gastos de publicacion o agencias. Solo pagas por lo que necesitas."},
  {icono:"🎯",titulo:"Busqueda precisa",desc:"Filtra por zona, oficio, disponibilidad e idioma."},
  {icono:"🔒",titulo:"Perfiles verificados",desc:"Todos los trabajadores declaran sus habilidades y referencias."},
  {icono:"⭐",titulo:"Calificaciones reales",desc:"Rankings basados en experiencias de otros empleadores."},
];

import{useApp}from "../../services/AppContext";

export default function BienvenidaEmpresaScreen({navigation}){
  const{setSuscripcionActiva}=useApp();
  const[pagando,setPagando]=useState(null); // id del plan que está procesando, o null
  const[esperando,setEsperando]=useState(false);
  const appStateRef=useRef(AppState.currentState);
  const intervaloRef=useRef(null);
  const prevVenceRef=useRef(null);

  useEffect(()=>{
    if(!esperando)return;
    intervaloRef.current=setInterval(verificar,3000);
    const sub=AppState.addEventListener('change',async(next)=>{
      if(appStateRef.current.match(/inactive|background/)&&next==='active'){
        await verificar();
      }
      appStateRef.current=next;
    });
    return()=>{
      clearInterval(intervaloRef.current);
      sub.remove();
    };
  },[esperando]);

  async function verificar(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return false;
      const{data}=await supabase.from('profiles').select('suscripcion_activa,suscripcion_vence_at').eq('id',user.id).single();
      const prevTs=prevVenceRef.current?new Date(prevVenceRef.current).getTime():0;
      const newTs=data?.suscripcion_vence_at?new Date(data.suscripcion_vence_at).getTime():0;
      if(data?.suscripcion_activa && newTs>prevTs){
        clearInterval(intervaloRef.current);
        setEsperando(false);
        setPagando(null);
        setSuscripcionActiva(true);
        Alert.alert('¡Suscripción activada!','Ya podés ver perfiles sin límite durante 30 días.',[{text:'Buscar trabajadores',onPress:()=>navigation.goBack()}]);
        return true;
      }
    }catch(e){}
    return false;
  }

  async function suscribirse(plan){
    if(pagando)return;
    setPagando(plan.id);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){Alert.alert('Error','Debés iniciar sesión');return;}
      const{data:perfil}=await supabase.from('profiles').select('suscripcion_vence_at').eq('id',user.id).single();
      prevVenceRef.current=perfil?.suscripcion_vence_at||null;
      const monto=plan.zona==='Sudamerica'?12:(plan.zona==='Mundial'?24:50);
      const{data,error}=await supabase.functions.invoke('crear-pago',{
        body:{monto,descripcion:'Konexu — Suscripción empresa (30 días)',tipo:'company_suscripcion'},
      });
      if(error)throw error;
      await Linking.openURL(data.init_point);
      setEsperando(true);
    }catch(e){
      Alert.alert('Error',e?.message||'No se pudo iniciar el pago');
      setPagando(null);
    }
  }

  return(
    <SafeAreaView style={ss.c} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={ss.volverWrap}>
          <TouchableOpacity onPress={()=>navigation.goBack()}>
            <Text style={ss.volverTxt}>← Volver</Text>
          </TouchableOpacity>
        </View>
        <LinearGradient colors={["#1A1F3A","#2D3561"]} style={ss.hero}>
          <Text style={ss.heroEmoji}>🏢</Text>
          <Text style={ss.heroTit}>Konexu para Empresas</Text>
          <Text style={ss.heroSub}>Acceda a mano de obra calificada en tiempo real. Sin intermediarios, sin publicaciones, sin demoras.</Text>
        </LinearGradient>

        <View style={ss.sec}>
          <Text style={ss.stit}>POR QUE KONEXU</Text>
          {BENEFICIOS.map((b,i)=>(
            <View key={i} style={ss.beneficioCard}>
              <Text style={ss.beneficioIcono}>{b.icono}</Text>
              <View style={{flex:1}}>
                <Text style={ss.beneficioTit}>{b.titulo}</Text>
                <Text style={ss.beneficioDesc}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={ss.sec}>
          <Text style={ss.stit}>PLAN GRATUITO</Text>
          <View style={ss.freeCard}>
            <Text style={ss.freeTit}>Hasta 3 perfiles por dia, 9 por semana</Text>
            <Text style={ss.freeDesc}>Sin costo y sin tarjeta. Si necesitas ver mas, suscribite para acceder a mas perfiles por dia.</Text>
          </View>
        </View>

        <View style={ss.sec}>
          <Text style={ss.stit}>SUSCRIPCION — MAS PERFILES POR DIA</Text>
          <Text style={ss.planSub}>Elegi tu zona y el nivel de acceso que necesitas.</Text>
          <View style={ss.planesRow}>
            <Text style={ss.zonaLabel}>🌎 Sudamerica</Text>
          </View>
          <View style={ss.planesGrid}>
            {PLANES.filter(p=>p.zona==="Sudamerica").map(p=>(
              <View key={p.id} style={[ss.planCard,p.destacado&&{borderColor:p.color,borderWidth:2}]}>
                {p.destacado&&<View style={[ss.planBadge,{backgroundColor:p.color}]}><Text style={ss.planBadgeTxt}>Popular</Text></View>}
                <Text style={[ss.planNombre,{color:p.color}]}>{p.nombre}</Text>
                <Text style={ss.planPrecio}>{p.precio}<Text style={ss.planPeriodo}>{p.periodo}</Text></Text>
                <Text style={ss.planPerfiles}>{p.perfiles}</Text>
                {p.items.map((item,i)=>(<View key={i} style={ss.planItem}><Text style={[ss.planDot,{color:p.color}]}>✓</Text><Text style={ss.planItemTxt}>{item}</Text></View>))}
                <TouchableOpacity
                  style={[ss.planBtn,{backgroundColor:p.color},pagando===p.id&&{opacity:0.6}]}
                  disabled={pagando===p.id}
                  onPress={()=>p.id.startsWith('membresia_')?suscribirse(p):Alert.alert("Proximamente","El sistema de pagos estara disponible muy pronto.")}
                >
                  <Text style={ss.planBtnTxt}>{pagando===p.id?'Procesando...':'Suscribirme'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={ss.planesRow}>
            <Text style={ss.zonaLabel}>🌍 Mundial</Text>
          </View>
          <View style={ss.mundialNota}>
            <Text style={ss.mundialNotaTxt}>💡 Ideal para empresas que buscan trabajadores remotos o profesionales en el exterior.</Text>
          </View>
          <View style={ss.planesGrid}>
            {PLANES.filter(p=>p.zona==="Mundial").map(p=>(
              <View key={p.id} style={ss.planCard}>
                <Text style={[ss.planNombre,{color:p.color}]}>{p.nombre}</Text>
                <Text style={ss.planPrecio}>{p.precio}<Text style={ss.planPeriodo}>{p.periodo}</Text></Text>
                <Text style={ss.planPerfiles}>{p.perfiles}</Text>
                {p.items.map((item,i)=>(<View key={i} style={ss.planItem}><Text style={[ss.planDot,{color:p.color}]}>✓</Text><Text style={ss.planItemTxt}>{item}</Text></View>))}
                <TouchableOpacity
                  style={[ss.planBtn,{backgroundColor:p.color},pagando===p.id&&{opacity:0.6}]}
                  disabled={pagando===p.id}
                  onPress={()=>p.id.startsWith('membresia_')?suscribirse(p):Alert.alert("Proximamente","El sistema de pagos estara disponible muy pronto.")}
                >
                  <Text style={ss.planBtnTxt}>{pagando===p.id?'Procesando...':'Suscribirme'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
          <View style={ss.planesRow}>
            <Text style={ss.zonaLabel}>💎 Premium</Text>
          </View>
          <View style={ss.planesGrid}>
            {PLANES.filter(p=>p.zona==="Premium").map(p=>(
              <View key={p.id} style={ss.planCard}>
                <Text style={[ss.planNombre,{color:p.color}]}>{p.nombre}</Text>
                <Text style={ss.planPrecio}>{p.precio}<Text style={ss.planPeriodo}>{p.periodo}</Text></Text>
                <Text style={ss.planPerfiles}>{p.perfiles}</Text>
                {p.items.map((item,i)=>(<View key={i} style={ss.planItem}><Text style={[ss.planDot,{color:p.color}]}>✓</Text><Text style={ss.planItemTxt}>{item}</Text></View>))}
                <TouchableOpacity
                  style={[ss.planBtn,{backgroundColor:p.color},pagando===p.id&&{opacity:0.6}]}
                  disabled={pagando===p.id}
                  onPress={()=>p.id.startsWith('membresia_')?suscribirse(p):Alert.alert("Proximamente","El sistema de pagos estara disponible muy pronto.")}
                >
                  <Text style={ss.planBtnTxt}>{pagando===p.id?'Procesando...':'Suscribirme'}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        <View style={ss.footer}>
          <Text style={ss.footerTxt}>¿Ya tenes suscripcion activa?</Text>
          <TouchableOpacity onPress={()=>Alert.alert("Proximamente","El sistema de pagos estara disponible muy pronto.")}>
            <Text style={ss.footerLink}>Ingresar codigo de activacion</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ss.explorarBtn} onPress={()=>navigation.goBack()}>
            <Text style={ss.explorarTxt}>Explorar sin suscripcion</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:"#F2EDE6"},
  hero:{alignItems:"center",paddingHorizontal:24,paddingTop:40,paddingBottom:48},
  heroEmoji:{fontSize:48,marginBottom:12},
  heroTit:{fontSize:28,fontWeight:"900",color:"#FFFFFF",textAlign:"center",letterSpacing:-0.5,marginBottom:12},
  heroSub:{fontSize:15,color:"rgba(255,255,255,0.75)",textAlign:"center",lineHeight:22},
  sec:{paddingHorizontal:16,paddingTop:24},
  stit:{fontSize:10,fontWeight:"700",color:"#A898B8",letterSpacing:1,marginBottom:16},
  beneficioCard:{flexDirection:"row",gap:14,backgroundColor:"#FFFFFF",borderRadius:14,padding:14,marginBottom:10,borderWidth:1,borderColor:"#EDE8E2",alignItems:"flex-start"},
  beneficioIcono:{fontSize:24,width:36,textAlign:"center"},
  beneficioTit:{fontSize:14,fontWeight:"700",color:"#1A1020",marginBottom:3},
  beneficioDesc:{fontSize:13,color:"#A898B8",lineHeight:18},
  planSub:{fontSize:13,color:"#A898B8",marginBottom:16},
  freeCard:{backgroundColor:"#E6FBF5",borderRadius:14,padding:16,borderWidth:1,borderColor:"#3DA882"},
  freeTit:{fontSize:15,fontWeight:"800",color:"#2E9472",marginBottom:4},
  freeDesc:{fontSize:12,color:"#2E9472",lineHeight:17},
  planesRow:{marginBottom:8},
  zonaLabel:{fontSize:13,fontWeight:"700",color:"#5A4E6A"},
  mundialNota:{backgroundColor:"#FFF0ED",borderRadius:8,padding:10,marginBottom:10,borderLeftWidth:3,borderLeftColor:"#E8785A"},
  mundialNotaTxt:{fontSize:12,color:"#E8785A",lineHeight:17},
  planesGrid:{flexDirection:"row",gap:10,marginBottom:16},
  planCard:{flex:1,backgroundColor:"#FFFFFF",borderRadius:16,padding:14,borderWidth:1.5,borderColor:"#EDE8E2",position:"relative"},
  planBadge:{position:"absolute",top:-10,right:10,paddingHorizontal:10,paddingVertical:3,borderRadius:10},
  planBadgeTxt:{fontSize:10,fontWeight:"700",color:"#FFFFFF"},
  planNombre:{fontSize:16,fontWeight:"900",marginBottom:4},
  planPrecio:{fontSize:24,fontWeight:"900",color:"#1A1020"},
  planPeriodo:{fontSize:13,fontWeight:"400",color:"#A898B8"},
  planPerfiles:{fontSize:11,color:"#A898B8",marginBottom:10},
  planItem:{flexDirection:"row",gap:6,marginBottom:4,alignItems:"flex-start"},
  planDot:{fontSize:11,fontWeight:"800",marginTop:1},
  planItemTxt:{fontSize:11,color:"#5A4E6A",flex:1,lineHeight:16},
  planBtn:{borderRadius:10,paddingVertical:10,alignItems:"center",marginTop:12},
  planBtnTxt:{color:"#FFFFFF",fontSize:13,fontWeight:"700"},
  volverWrap:{paddingHorizontal:16,paddingTop:16,paddingBottom:8,backgroundColor:"#F2EDE6"},
  volverTxt:{fontSize:14,fontWeight:"700",color:"#3DA882"},
  footer:{alignItems:"center",paddingVertical:32,gap:8},
  footerTxt:{fontSize:13,color:"#A898B8"},
  footerLink:{fontSize:13,fontWeight:"700",color:"#3DA882"},
  explorarBtn:{marginTop:16,paddingVertical:14,paddingHorizontal:24,borderRadius:12,borderWidth:1.5,borderColor:"#A898B8",alignItems:"center"},
  explorarTxt:{fontSize:14,fontWeight:"600",color:"#5A4E6A"},
});
