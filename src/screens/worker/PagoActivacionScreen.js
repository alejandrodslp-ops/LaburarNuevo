import React,{useState,useEffect,useRef} from 'react';
import{View,Text,StyleSheet,TouchableOpacity,Alert,ActivityIndicator,ScrollView,Linking,AppState}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{LinearGradient}from 'expo-linear-gradient';
import{supabase}from '../../services/supabase';
import{scheduleRenovacionReminder,scheduleRecordatoriosInactividad,cancelarRecordatoriosInactividad}from '../../services/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SMS from 'expo-sms';

const SMS_NUMERO='1234';
const SMS_TEXTO='NEXU ACTIVAR';

export default function PagoActivacionScreen({navigation}){
  const[loadingMP,setLoadingMP]=useState(false);
  const[loadingTarjeta,setLoadingTarjeta]=useState(false);
  const[esperando,setEsperando]=useState(false);
  const[mostrarBoton,setMostrarBoton]=useState(false);
  const intervaloRef=useRef(null);
  const timeoutRef=useRef(null);
  const appStateRef=useRef(AppState.currentState);

  useEffect(()=>{
    if(!esperando)return;

    intervaloRef.current=setInterval(verificar,3000);
    timeoutRef.current=setTimeout(()=>setMostrarBoton(true),45000);

    const sub=AppState.addEventListener('change',async(next)=>{
      if(appStateRef.current.match(/inactive|background/)&&next==='active'){
        await verificar();
      }
      appStateRef.current=next;
    });

    return()=>{
      clearInterval(intervaloRef.current);
      clearTimeout(timeoutRef.current);
      sub.remove();
    };
  },[esperando]);

  async function verificar(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return false;
      const{data}=await supabase.from('profiles').select('perfil_activo,perfil_activo_hasta').eq('id',user.id).single();
      if(data?.perfil_activo){
        clearInterval(intervaloRef.current);
        clearTimeout(timeoutRef.current);
        setEsperando(false);
        setMostrarBoton(false);
        const metodo=await AsyncStorage.getItem('metodo_pago_worker').catch(()=>null);
        if(data.perfil_activo_hasta){
          await cancelarRecordatoriosInactividad();
          await scheduleRenovacionReminder(data.perfil_activo_hasta, metodo||undefined);
          await scheduleRecordatoriosInactividad(data.perfil_activo_hasta);
        }
        Alert.alert('¡Perfil activado!','Tu perfil ya aparece en los resultados de búsqueda durante 60 días.',[{text:'Ver mi perfil',onPress:()=>navigation.goBack()}]);
        return true;
      }
    }catch(e){}
    return false;
  }

  async function handleMP(){
    setLoadingMP(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){Alert.alert('Error','Debés iniciar sesión');return;}
      await AsyncStorage.setItem('metodo_pago_worker','mp');
      const{data,error}=await supabase.functions.invoke('crear-pago',{
        body:{user_id:user.id,monto:1,descripcion:'Nexu - Activar perfil trabajador 60 días',tipo:'worker_activacion'},
      });
      if(error)throw error;
      await Linking.openURL(data.sandbox_init_point||data.init_point);
      setEsperando(true);
    }catch(e){Alert.alert('Error','No se pudo conectar con MercadoPago.');}
    finally{setLoadingMP(false);}
  }

  async function handleTarjeta(){
    setLoadingTarjeta(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){Alert.alert('Error','Debés iniciar sesión');return;}
      await AsyncStorage.setItem('metodo_pago_worker','tarjeta');
      const{data,error}=await supabase.functions.invoke('crear-pago',{
        body:{user_id:user.id,monto:1,descripcion:'Nexu - Activar perfil trabajador 60 días',tipo:'worker_activacion'},
      });
      if(error)throw error;
      await Linking.openURL(data.sandbox_init_point||data.init_point);
      setEsperando(true);
    }catch(e){Alert.alert('Error','No se pudo procesar el pago.');}
    finally{setLoadingTarjeta(false);}
  }

  async function handleSMS(){
    try{
      const isAvailable=await SMS.isAvailableAsync();
      if(!isAvailable){Alert.alert('SMS no disponible','Tu dispositivo no soporta envío de SMS.');return;}
      await AsyncStorage.setItem('metodo_pago_worker','sms');
      const{result}=await SMS.sendSMSAsync([SMS_NUMERO],SMS_TEXTO);
      if(result==='sent'||result==='unknown') setEsperando(true);
    }catch(e){Alert.alert('Error','No se pudo enviar el SMS.');}
  }

  async function activarManual(){
    clearInterval(intervaloRef.current);
    clearTimeout(timeoutRef.current);
    setEsperando(false);
    setMostrarBoton(false);
    let hasta=null;
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(user){
        const{data}=await supabase.from('profiles').select('perfil_activo,perfil_activo_hasta').eq('id',user.id).single();
        if(!data?.perfil_activo){
          hasta=new Date();
          hasta.setDate(hasta.getDate()+60);
          await supabase.from('profiles').update({
            perfil_activo:true,
            perfil_activo_hasta:hasta.toISOString(),
          }).eq('id',user.id);
        }else{
          hasta=data.perfil_activo_hasta?new Date(data.perfil_activo_hasta):null;
        }
      }
    }catch(e){}
    const metodo=await AsyncStorage.getItem('metodo_pago_worker').catch(()=>null);
    if(hasta){
      await cancelarRecordatoriosInactividad();
      await scheduleRenovacionReminder(hasta.toISOString(), metodo||undefined);
      await scheduleRecordatoriosInactividad(hasta.toISOString());
    }
    Alert.alert('¡Perfil activado!','Tu perfil ya aparece en los resultados de búsqueda durante 60 días.',[{text:'Ver mi perfil',onPress:()=>navigation.goBack()}]);
  }

  return(
    <SafeAreaView style={ss.c} edges={['top']}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={()=>navigation.goBack()}>
          <Text style={ss.back}>Volver</Text>
        </TouchableOpacity>
        <Text style={ss.htit}>Activar perfil</Text>
        <View style={{width:50}}/>
      </View>

      <ScrollView contentContainerStyle={ss.content}>

        <LinearGradient colors={['#1C2E2C','#0E1E1C']} style={ss.hero}>
          <Text style={ss.heroEmoji}>🚀</Text>
          <Text style={ss.heroTit}>Activá tu perfil</Text>
          <Text style={ss.heroSub}>Aparecé en la búsqueda de empleadores y empezá a recibir propuestas de trabajo</Text>
          <View style={ss.precioBadge}>
            <Text style={ss.precioNum}>U$1</Text>
            <Text style={ss.precioPer}>/ 30 días</Text>
          </View>
        </LinearGradient>

        <View style={ss.beneficios}>
          <Text style={ss.stit}>QUÉ INCLUYE</Text>
          {[
            {emoji:'👁️',txt:'Tu perfil visible para todos los empleadores'},
            {emoji:'📩',txt:'Recibís propuestas de trabajo directamente'},
            {emoji:'⭐',txt:'Aparecés en resultados de búsqueda por oficio y zona'},
            {emoji:'📊',txt:'Ves cuántos empleadores vieron tu perfil'},
            {emoji:'🔄',txt:'Podés renovar al vencer los 30 días'},
          ].map((b,i)=>(
            <View key={i} style={ss.beneficioRow}>
              <Text style={ss.beneficioEmoji}>{b.emoji}</Text>
              <Text style={ss.beneficioTxt}>{b.txt}</Text>
            </View>
          ))}
        </View>

        {esperando&&(
          <View style={ss.esperandoWrap}>
            <ActivityIndicator color="#2DD4BF" size="small"/>
            <Text style={ss.esperandoTxt}>Verificando pago... volvé a la app cuando termines de pagar.</Text>
          </View>
        )}

        {mostrarBoton&&(
          <TouchableOpacity style={ss.yaPagueBtn} onPress={activarManual}>
            <Text style={ss.yaPagueTxt}>✓ Ya pagué — activar mi perfil</Text>
          </TouchableOpacity>
        )}

        <Text style={ss.metodosTit}>ELEGIR MÉTODO DE PAGO</Text>

        <TouchableOpacity style={ss.btnWrap} onPress={handleMP} disabled={loadingMP||esperando}>
          <LinearGradient colors={['#009EE3','#0077B6']} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            {loadingMP?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>💳 MercadoPago</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={ss.btnWrap} onPress={handleTarjeta} disabled={loadingTarjeta||esperando}>
          <LinearGradient colors={['#2DD4BF','#14B8A6']} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            {loadingTarjeta?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>💳 Tarjeta de crédito / débito</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={ss.btnWrap} onPress={handleSMS} disabled={esperando}>
          <LinearGradient colors={['#7C3AED','#5B21B6']} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            <Text style={ss.btnTxt}>📱 Pagar con SMS</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={ss.smsHint}>Enviá un SMS al {SMS_NUMERO} y se descuenta de tu plan mensual. Ideal si tenés saldo que no usás.</Text>

        <Text style={ss.legal}>Pago único de U$1. No se renueva automáticamente. Al vencer podés reactivar cuando quieras.</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:'#FBF8F4'},
  hdr:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:14,backgroundColor:'#FFFFFF',borderBottomWidth:1,borderBottomColor:'#EDE8E2'},
  back:{fontSize:14,fontWeight:'700',color:'#2DD4BF'},
  htit:{fontSize:16,fontWeight:'800',color:'#1A1020'},
  content:{paddingBottom:40},
  hero:{alignItems:'center',paddingHorizontal:24,paddingTop:32,paddingBottom:36},
  heroEmoji:{fontSize:48,marginBottom:12},
  heroTit:{fontSize:26,fontWeight:'900',color:'#FFFFFF',marginBottom:8,textAlign:'center'},
  heroSub:{fontSize:14,color:'rgba(255,255,255,0.7)',textAlign:'center',lineHeight:20,marginBottom:20},
  precioBadge:{flexDirection:'row',alignItems:'flex-end',gap:6,backgroundColor:'rgba(255,255,255,0.15)',borderRadius:16,paddingHorizontal:20,paddingVertical:10,borderWidth:1,borderColor:'rgba(255,255,255,0.25)'},
  precioNum:{fontSize:36,fontWeight:'900',color:'#FFFFFF'},
  precioPer:{fontSize:14,color:'rgba(255,255,255,0.7)',marginBottom:4},
  beneficios:{backgroundColor:'#FFFFFF',margin:16,borderRadius:16,padding:16,borderWidth:1,borderColor:'#EDE8E2'},
  stit:{fontSize:10,fontWeight:'700',color:'#A898B8',letterSpacing:1,marginBottom:12},
  beneficioRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#F2EDE6'},
  beneficioEmoji:{fontSize:20},
  beneficioTxt:{fontSize:14,color:'#1A1020',fontWeight:'500',flex:1},
  esperandoWrap:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#F0FDFA',borderRadius:10,padding:12,marginHorizontal:16,marginBottom:12},
  esperandoTxt:{fontSize:13,color:'#2DD4BF',flex:1,lineHeight:18},
  yaPagueBtn:{backgroundColor:'#E6FBF5',borderRadius:12,paddingVertical:14,alignItems:'center',marginHorizontal:16,marginBottom:12,borderWidth:1.5,borderColor:'#3DA882'},
  yaPagueTxt:{fontSize:15,fontWeight:'700',color:'#2E9472'},
  metodosTit:{fontSize:10,fontWeight:'700',color:'#A898B8',letterSpacing:1,marginBottom:12,paddingHorizontal:16},
  btnWrap:{borderRadius:14,overflow:'hidden',marginHorizontal:16,marginBottom:10},
  btn:{paddingVertical:16,alignItems:'center'},
  btnTxt:{color:'#FFFFFF',fontSize:16,fontWeight:'800'},
  smsHint:{fontSize:11,color:'#A898B8',textAlign:'center',lineHeight:16,marginHorizontal:16,marginTop:4,marginBottom:8},
  legal:{fontSize:11,color:'#A898B8',textAlign:'center',lineHeight:16,margin:16},
});
