import React,{useState}from "react";
import{View,Text,StyleSheet,TouchableOpacity,TextInput,Alert,ActivityIndicator}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import{supabase}from "../../services/supabase";

export default function VerificarTelefonoScreen({navigation,route}){
const{telefono}=route.params||{};
const[paso,setPaso]=useState(1);
const[codigo,setCodigo]=useState("");
const[cargando,setCargando]=useState(false);

async function enviarCodigo(){
  if(!telefono||telefono.trim().length<6){Alert.alert("Error","Ingresá un número de teléfono válido");return;}
  setCargando(true);
  try{
    const{data,error}=await supabase.functions.invoke("verificar-telefono",{body:{accion:"enviar_otp",telefono}});
    if(error)throw error;
    if(data?.dev_otp){
      // Modo sin Resend: mostramos el código en pantalla para pruebas
      Alert.alert("Código generado (prueba)",`Tu código es: ${data.dev_otp}\n\nEsto solo aparece mientras no hayas configurado RESEND_API_KEY.`);
    }
    setPaso(2);
  }catch(e){
    Alert.alert("Error","No se pudo enviar el código. Intentá de nuevo.");
  }finally{setCargando(false);}
}

async function verificarCodigo(){
  if(codigo.length!==6){Alert.alert("Error","Ingresá el código de 6 dígitos");return;}
  setCargando(true);
  try{
    const{data,error}=await supabase.functions.invoke("verificar-telefono",{body:{accion:"verificar",codigo}});
    if(error)throw error;
    if(data?.ok){
      Alert.alert("¡Verificado!","Tu teléfono fue verificado correctamente.",[{text:"OK",onPress:()=>navigation.goBack()}]);
    }else{
      Alert.alert("Código incorrecto",data?.error||"Verificá el código e intentá de nuevo.");
    }
  }catch(e){
    Alert.alert("Error","No se pudo verificar el código.");
  }finally{setCargando(false);}
}

return(
<SafeAreaView style={ss.c} edges={["top"]}>
  <View style={ss.hdr}>
    <TouchableOpacity onPress={()=>navigation.goBack()}><Text style={ss.back}>Volver</Text></TouchableOpacity>
    <Text style={ss.tit}>Verificar teléfono</Text>
    <View style={{width:50}}/>
  </View>
  <View style={ss.body}>
    <Text style={ss.icono}>📱</Text>
    {paso===1?(
      <>
        <Text style={ss.desc}>Verificá tu número</Text>
        <View style={ss.phoneBox}><Text style={ss.phoneNum}>{telefono}</Text></View>
        <Text style={ss.sub}>Te enviaremos un código de 6 dígitos a tu email registrado.</Text>
        <TouchableOpacity style={ss.btnW} onPress={enviarCodigo} disabled={cargando}>
          <LinearGradient colors={["#E8785A","#D4614A"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            {cargando?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>Enviar código</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </>
    ):(
      <>
        <Text style={ss.desc}>Ingresá el código</Text>
        <Text style={ss.sub}>Revisá tu email — te enviamos un código de 6 dígitos válido por 10 minutos.</Text>
        <TextInput
          style={ss.otpInput}
          value={codigo}
          onChangeText={v=>setCodigo(v.replace(/[^0-9]/g,"").slice(0,6))}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="000000"
          placeholderTextColor="#A898B8"
          textAlign="center"
          autoFocus
        />
        <TouchableOpacity style={ss.btnW} onPress={verificarCodigo} disabled={cargando}>
          <LinearGradient colors={["#E8785A","#D4614A"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            {cargando?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>Verificar</Text>}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={ss.reenviar} onPress={()=>{setCodigo("");enviarCodigo();}}>
          <Text style={ss.reenviarTxt}>¿No llegó? Reenviar código</Text>
        </TouchableOpacity>
      </>
    )}
  </View>
</SafeAreaView>);
}

const ss=StyleSheet.create({
c:{flex:1,backgroundColor:"#FBF8F4"},
hdr:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:20,paddingTop:16,paddingBottom:12},
back:{fontSize:14,fontWeight:"700",color:"#2DD4BF"},
tit:{fontSize:18,fontWeight:"800",color:"#1A1020"},
body:{flex:1,paddingHorizontal:24,paddingTop:40,alignItems:"center"},
icono:{fontSize:56,marginBottom:20},
desc:{fontSize:22,fontWeight:"800",color:"#1A1020",textAlign:"center",marginBottom:16},
phoneBox:{backgroundColor:"#F0FDFA",borderRadius:12,paddingHorizontal:24,paddingVertical:12,marginBottom:12,borderWidth:1.5,borderColor:"#2DD4BF"},
phoneNum:{fontSize:20,fontWeight:"700",color:"#1A1020",letterSpacing:2},
sub:{fontSize:14,color:"#5A4E6A",textAlign:"center",marginBottom:32,lineHeight:20},
otpInput:{width:200,height:64,borderWidth:2,borderColor:"#E8785A",borderRadius:16,fontSize:28,fontWeight:"800",color:"#1A1020",backgroundColor:"#FFF",marginBottom:28,letterSpacing:8},
btnW:{width:"100%",borderRadius:14,overflow:"hidden"},
btn:{paddingVertical:16,alignItems:"center"},
btnTxt:{color:"#FFF",fontSize:16,fontWeight:"800"},
reenviar:{marginTop:16},
reenviarTxt:{fontSize:14,color:"#2DD4BF",fontWeight:"700"},
});
