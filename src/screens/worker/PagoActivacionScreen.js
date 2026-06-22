import React,{useState,useEffect,useRef} from 'react';
import{View,Text,StyleSheet,TouchableOpacity,Alert,ActivityIndicator,ScrollView,Linking,AppState,Modal,Share,Image}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{LinearGradient}from 'expo-linear-gradient';
import{supabase}from '../../services/supabase';
import{scheduleRenovacionReminder,scheduleRecordatoriosInactividad,cancelarRecordatoriosInactividad}from '../../services/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SMS from 'expo-sms';

const SMS_NUMERO='1234';
const SMS_TEXTO='KONEXU ACTIVAR';

export default function PagoActivacionScreen({navigation}){
  const[loadingMP,setLoadingMP]=useState(false);
  const[loadingTarjeta,setLoadingTarjeta]=useState(false);
  const[loadingSMS,setLoadingSMS]=useState(false);
  const[loadingPIX,setLoadingPIX]=useState(false);
  const[esperando,setEsperando]=useState(false);
  const[mostrarAyuda,setMostrarAyuda]=useState(false);
  const[pixData,setPixData]=useState(null); // {qr_code, qr_base64, monto, modo}
  const[pais,setPais]=useState(null);
  const intervaloRef=useRef(null);
  const timeoutRef=useRef(null);
  const appStateRef=useRef(AppState.currentState);
  // Guarda la fecha de activación ANTES de iniciar el pago.
  // verificar() solo celebra si esa fecha cambia a una más nueva.
  const prevHastaRef=useRef(null);

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if(!user)return;
      supabase.from('profiles').select('pais').eq('id',user.id).single()
        .then(({data})=>setPais(data?.pais||null));
    });
  },[]);

  async function handlePIX(){
    if(loadingPIX||esperando)return;
    setLoadingPIX(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){Alert.alert('Error','Debes iniciar sesion');return;}
      const{data:perfil}=await supabase.from('profiles').select('perfil_activo_hasta').eq('id',user.id).single();
      prevHastaRef.current=perfil?.perfil_activo_hasta||null;
      await AsyncStorage.setItem('metodo_pago_worker','pix');
      const{data,error}=await supabase.functions.invoke('criar-pago-pix',{
        body:{monto_brl:15,tipo:'worker_activacion'},
      });
      if(error)throw error;
      setPixData(data);
      setEsperando(true);
    }catch(e){Alert.alert('Erro','Nao foi possivel gerar o PIX. Tente novamente.');}
    finally{setLoadingPIX(false);}
  }

  useEffect(()=>{
    if(!esperando)return;

    intervaloRef.current=setInterval(verificar,3000);
    timeoutRef.current=setTimeout(()=>setMostrarAyuda(true),60000);

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

      // Solo confirmar si la fecha de activación es más nueva que la que había antes de pagar
      const prevTs=prevHastaRef.current?new Date(prevHastaRef.current).getTime():0;
      const newTs=data?.perfil_activo_hasta?new Date(data.perfil_activo_hasta).getTime():0;

      if(data?.perfil_activo && newTs>prevTs){
        clearInterval(intervaloRef.current);
        clearTimeout(timeoutRef.current);
        setEsperando(false);
        setMostrarAyuda(false);
        const metodo=await AsyncStorage.getItem('metodo_pago_worker').catch(()=>null);
        if(data.perfil_activo_hasta){
          await cancelarRecordatoriosInactividad();
          await scheduleRenovacionReminder(data.perfil_activo_hasta,metodo||undefined);
          await scheduleRecordatoriosInactividad(data.perfil_activo_hasta);
        }
        Alert.alert('¡Perfil activado!','Tu perfil ya aparece en los resultados de búsqueda durante 60 días.',[{text:'Ver mi perfil',onPress:()=>navigation.goBack()}]);
        return true;
      }
    }catch(e){}
    return false;
  }

  async function iniciarPago(metodo,setLoading,errorMsg){
    setLoading(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){Alert.alert('Error','Debés iniciar sesión');return;}
      // Guardar baseline ANTES de abrir el pago
      const{data:perfil}=await supabase.from('profiles').select('perfil_activo_hasta').eq('id',user.id).single();
      prevHastaRef.current=perfil?.perfil_activo_hasta||null;
      await AsyncStorage.setItem('metodo_pago_worker',metodo);
      const{data,error}=await supabase.functions.invoke('crear-pago',{
        body:{user_id:user.id,monto:1,descripcion:'Konexu - Activar perfil trabajador 60 días',tipo:'worker_activacion'},
      });
      if(error)throw error;
      await Linking.openURL(data.init_point);
      setEsperando(true);
    }catch(e){Alert.alert('Error',errorMsg);}
    finally{setLoading(false);}
  }

  async function handleSMS(){
    if(loadingSMS||esperando)return;
    setLoadingSMS(true);
    try{
      const isAvailable=await SMS.isAvailableAsync();
      if(!isAvailable){Alert.alert('SMS no disponible','Tu dispositivo no soporta envío de SMS.');return;}
      const{data:{user}}=await supabase.auth.getUser();
      if(user){
        const{data:perfil}=await supabase.from('profiles').select('perfil_activo_hasta').eq('id',user.id).single();
        prevHastaRef.current=perfil?.perfil_activo_hasta||null;
      }
      await AsyncStorage.setItem('metodo_pago_worker','sms');
      const{result}=await SMS.sendSMSAsync([SMS_NUMERO],SMS_TEXTO);
      if(result==='sent'||result==='unknown') setEsperando(true);
    }catch(e){Alert.alert('Error','No se pudo enviar el SMS.');}
    finally{setLoadingSMS(false);}
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

        <LinearGradient colors={['#D6E4F0','#B8D4E8']} style={ss.hero}>
          <Text style={ss.heroEmoji}>🙌</Text>
          <Text style={ss.heroTit}>Gracias por decidir formar parte de Konexu</Text>
          <Text style={ss.heroSub}>y abrir la puerta a tus oportunidades</Text>
          <Text style={ss.heroHint}>Elegí cómo querés pagar y listo.</Text>
        </LinearGradient>

        <View style={ss.beneficios}>
          <Text style={ss.stit}>QUÉ INCLUYE</Text>
          {[
            {emoji:'👁️',txt:'Tu perfil visible para todos los empleadores'},
            {emoji:'📩',txt:'Recibís propuestas de trabajo directamente'},
            {emoji:'⭐',txt:'Aparecés en resultados de búsqueda por oficio y zona'},
            {emoji:'📊',txt:'Ves cuántos empleadores vieron tu perfil'},
            {emoji:'🔄',txt:'Podés renovar al vencer los 60 días'},
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

        {mostrarAyuda&&(
          <View style={ss.ayudaWrap}>
            <Text style={ss.ayudaTit}>¿Tuviste algún problema?</Text>
            <Text style={ss.ayudaSub}>Si realizaste el pago y no se confirmó, contactá a nuestro soporte y lo resolvemos.</Text>
          </View>
        )}

        <Text style={ss.metodosTit}>ELEGIR MÉTODO DE PAGO</Text>

        <TouchableOpacity style={ss.btnWrap} onPress={()=>iniciarPago('mp',setLoadingMP,'No se pudo conectar con MercadoPago.')} disabled={loadingMP||esperando}>
          <LinearGradient colors={['#009EE3','#0077B6']} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            {loadingMP?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>💳 MercadoPago</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={ss.btnWrap} onPress={()=>iniciarPago('tarjeta',setLoadingTarjeta,'No se pudo procesar el pago.')} disabled={loadingTarjeta||esperando}>
          <LinearGradient colors={['#2DD4BF','#14B8A6']} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            {loadingTarjeta?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>💳 Tarjeta de crédito / débito</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={ss.btnWrap} onPress={handleSMS} disabled={loadingSMS||esperando}>
          <LinearGradient colors={['#7C3AED','#5B21B6']} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            <Text style={ss.btnTxt}>📱 Pagar con SMS</Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={ss.smsHint}>Enviá un SMS al {SMS_NUMERO} y se descuenta de tu plan mensual. Ideal si tenés saldo que no usás.</Text>

        {/* PIX — visible para todos pero destacado para usuarios de Brasil */}
        <View style={ss.pixSep}>
          <View style={ss.pixLine}/><Text style={ss.pixSepTxt}>ou pague com PIX 🇧🇷</Text><View style={ss.pixLine}/>
        </View>

        <TouchableOpacity style={ss.btnWrap} onPress={handlePIX} disabled={loadingPIX||esperando}>
          <LinearGradient colors={['#22c55e','#16a34a']} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            {loadingPIX
              ?<ActivityIndicator color="#FFF" size="small"/>
              :<Text style={ss.btnTxt}>⚡ Pagar com PIX (R$ 15)</Text>}
          </LinearGradient>
        </TouchableOpacity>
        <Text style={ss.smsHint}>Qualquer banco, qualquer hora. Aprovacao instantanea.</Text>

        <Text style={ss.legal}>Pago único de USD $1 por 60 días. No se renueva automáticamente. Al vencer podés reactivar cuando quieras.</Text>

      </ScrollView>

      {/* Modal PIX */}
      <Modal visible={!!pixData} animationType="slide" transparent onRequestClose={()=>{if(!esperando)setPixData(null);}}>
        <View style={ss.modalBg}>
          <View style={ss.modalCard}>
            <Text style={ss.modalTit}>⚡ Pague com PIX</Text>
            <Text style={ss.modalSub}>R$ {pixData?.monto ?? 15} · aprovacao em segundos</Text>

            {pixData?.qr_base64
              ?<Image source={{uri:`data:image/png;base64,${pixData.qr_base64}`}} style={ss.qrImg}/>
              :<View style={ss.qrPlaceholder}><Text style={ss.qrIcon}>🟩</Text></View>}

            <Text style={ss.copiaTit}>Copia e Cola</Text>
            <TouchableOpacity style={ss.copiaWrap} onPress={()=>{
              Share.share({message:pixData?.qr_code??''});
            }}>
              <Text style={ss.copiaKey} numberOfLines={2}>{pixData?.qr_code??'Gerando...'}</Text>
              <Text style={ss.copiaBtn}>Copiar</Text>
            </TouchableOpacity>

            {pixData?.modo==='estatico'&&(
              <Text style={ss.staticHint}>Apos o pagamento, adicione seu ID ({pixData?.referencia}) na descricao do PIX para confirmacao automatica.</Text>
            )}

            <Text style={ss.modalEsp}>Aguardando confirmacao do pagamento...</Text>
            <ActivityIndicator color="#22c55e" style={{marginTop:8}}/>

            <TouchableOpacity style={ss.modalClose} onPress={()=>{setPixData(null);setEsperando(false);}}>
              <Text style={ss.modalCloseTxt}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  heroTit:{fontSize:26,fontWeight:'900',color:'#1A3A5C',marginBottom:8,textAlign:'center'},
  heroSub:{fontSize:18,fontWeight:'700',color:'rgba(26,58,92,0.55)',textAlign:'center',fontStyle:'italic',marginBottom:12},
  heroHint:{fontSize:13,color:'rgba(26,58,92,0.45)',textAlign:'center',marginBottom:8},
  beneficios:{backgroundColor:'#FFFFFF',margin:16,borderRadius:16,padding:16,borderWidth:1,borderColor:'#EDE8E2'},
  stit:{fontSize:10,fontWeight:'700',color:'#A898B8',letterSpacing:1,marginBottom:12},
  beneficioRow:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#F2EDE6'},
  beneficioEmoji:{fontSize:20},
  beneficioTxt:{fontSize:14,color:'#1A1020',fontWeight:'500',flex:1},
  esperandoWrap:{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:'#F0FDFA',borderRadius:10,padding:12,marginHorizontal:16,marginBottom:12},
  esperandoTxt:{fontSize:13,color:'#2DD4BF',flex:1,lineHeight:18},
  ayudaWrap:{backgroundColor:'#FFF7ED',borderRadius:12,padding:14,marginHorizontal:16,marginBottom:12,borderWidth:1,borderColor:'#FED7AA'},
  ayudaTit:{fontSize:14,fontWeight:'700',color:'#C2410C',marginBottom:4},
  ayudaSub:{fontSize:13,color:'#92400E',lineHeight:18},
  metodosTit:{fontSize:10,fontWeight:'700',color:'#A898B8',letterSpacing:1,marginBottom:12,paddingHorizontal:16},
  btnWrap:{borderRadius:14,overflow:'hidden',marginHorizontal:16,marginBottom:10},
  btn:{paddingVertical:16,alignItems:'center'},
  btnTxt:{color:'#FFFFFF',fontSize:16,fontWeight:'800'},
  smsHint:{fontSize:11,color:'#A898B8',textAlign:'center',lineHeight:16,marginHorizontal:16,marginTop:4,marginBottom:8},
  legal:{fontSize:11,color:'#A898B8',textAlign:'center',lineHeight:16,margin:16},
  // PIX
  pixSep:{flexDirection:'row',alignItems:'center',marginHorizontal:16,marginTop:8,marginBottom:4},
  pixLine:{flex:1,height:1,backgroundColor:'#EDE8E2'},
  pixSepTxt:{fontSize:12,color:'#A898B8',marginHorizontal:10,fontWeight:'600'},
  // Modal PIX
  modalBg:{flex:1,backgroundColor:'rgba(0,0,0,0.6)',justifyContent:'flex-end'},
  modalCard:{backgroundColor:'#fff',borderTopLeftRadius:24,borderTopRightRadius:24,padding:24,paddingBottom:40},
  modalTit:{fontSize:22,fontWeight:'900',color:'#1A1020',textAlign:'center',marginBottom:4},
  modalSub:{fontSize:14,color:'#A898B8',textAlign:'center',marginBottom:20},
  qrImg:{width:200,height:200,alignSelf:'center',marginBottom:16,borderRadius:8},
  qrPlaceholder:{width:200,height:200,alignSelf:'center',backgroundColor:'#F2FDF4',borderRadius:8,alignItems:'center',justifyContent:'center',marginBottom:16},
  qrIcon:{fontSize:80},
  copiaTit:{fontSize:11,fontWeight:'700',color:'#A898B8',letterSpacing:1,marginBottom:6},
  copiaWrap:{backgroundColor:'#F2FDF4',borderRadius:12,padding:12,borderWidth:1.5,borderColor:'#86EFAC',flexDirection:'row',alignItems:'center',gap:8,marginBottom:12},
  copiaKey:{flex:1,fontSize:11,color:'#16A34A',fontFamily:'monospace'},
  copiaBtn:{fontSize:12,fontWeight:'800',color:'#16A34A'},
  staticHint:{fontSize:11,color:'#F59E0B',backgroundColor:'#FEF3C7',borderRadius:8,padding:10,marginBottom:12,lineHeight:16},
  modalEsp:{fontSize:13,color:'#A898B8',textAlign:'center',marginTop:12},
  modalClose:{alignSelf:'center',marginTop:16,padding:12},
  modalCloseTxt:{fontSize:14,color:'#A898B8',fontWeight:'600'},
});
