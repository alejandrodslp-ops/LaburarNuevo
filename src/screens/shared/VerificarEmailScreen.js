import React,{useState,useRef,useEffect,useCallback}from "react";
import{View,Text,StyleSheet,TouchableOpacity,TextInput,Alert,ActivityIndicator,Keyboard,KeyboardAvoidingView,Platform,ScrollView}from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import{supabase}from "../../services/supabase";

export default function VerificarEmailScreen({navigation,route}){
  const{email}=route.params||{};
  const[codigo,setCodigo]=useState("");
  const[enviando,setEnviando]=useState(false);
  const[verificando,setVerificando]=useState(false);
  const[enviado,setEnviado]=useState(false);
  const[cooldown,setCooldown]=useState(0);
  const inputRef=useRef(null);
  const cooldownRef=useRef(null);

  useEffect(()=>{
    enviarCodigo();
    return()=>{if(cooldownRef.current)clearInterval(cooldownRef.current);};
  },[]);

  function iniciarCooldown(){
    setCooldown(60);
    cooldownRef.current=setInterval(()=>{
      setCooldown(p=>{if(p<=1){clearInterval(cooldownRef.current);return 0;}return p-1;});
    },1000);
  }

  async function enviarCodigo(){
    if(enviando||cooldown>0)return;
    setEnviando(true);
    try{
      const{data,error}=await supabase.functions.invoke("verificar-email",{body:{accion:"enviar_otp"}});
      if(error)throw error;
      if(data?.dev_otp){
        Alert.alert("Código generado (prueba)",`Tu código es: ${data.dev_otp}\n\nEsto aparece solo en modo desarrollo.`);
      }
      setEnviado(true);
      iniciarCooldown();
      setTimeout(()=>inputRef.current?.focus(),400);
    }catch(e){
      Alert.alert("Error","No se pudo enviar el código. Verificá tu conexión e intentá de nuevo.");
    }finally{setEnviando(false);}
  }

  const verificar=useCallback(async(cod=codigo)=>{
    if(cod.length!==6){Alert.alert("Código incompleto","Ingresá los 6 dígitos del código.");return;}
    Keyboard.dismiss();
    setVerificando(true);
    try{
      const{data,error}=await supabase.functions.invoke("verificar-email",{body:{accion:"verificar",codigo:cod}});
      if(error)throw error;
      if(data?.ok){
        navigation.replace("VerificacionExitosa");
      }else{
        Alert.alert("Código incorrecto",data?.error||"Verificá el código e intentá de nuevo.");
        setCodigo("");
        setTimeout(()=>inputRef.current?.focus(),300);
      }
    }catch(e){
      Alert.alert("Error","No se pudo verificar. Intentá de nuevo.");
    }finally{setVerificando(false);}
  },[codigo,verificando,navigation]);

  const emailCorto=email?.length>32?email.slice(0,29)+"…":email;

  return(
    <SafeAreaView style={ss.c} edges={["top"]}>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":"height"}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={async()=>{
          await AsyncStorage.removeItem("ir_a_editar_perfil");
          navigation.goBack();
        }}>
          <Text style={ss.back}>Volver</Text>
        </TouchableOpacity>
        <Text style={ss.tit}>Verificar email</Text>
        <View style={{width:50}}/>
      </View>

      <View style={ss.body}>
        <View style={ss.iconoWrap}>
          <Text style={ss.icono}>✉️</Text>
        </View>

        <Text style={ss.titulo}>Revisá tu correo</Text>

        {emailCorto&&(
          <View style={ss.emailBox}>
            <Text style={ss.emailTxt}>{emailCorto}</Text>
          </View>
        )}

        <Text style={ss.sub}>
          {enviando
            ?"Enviando código…"
            :enviado
              ?"Ingresá el código de 6 dígitos que enviamos a tu email"
              :"Preparando…"
          }
        </Text>

        <TextInput
          ref={inputRef}
          style={[ss.otpInput,codigo.length>0&&ss.otpInputActive]}
          value={codigo}
          onChangeText={v=>{
          const cleaned=v.replace(/[^0-9]/g,"").slice(0,6);
          setCodigo(cleaned);
          if(cleaned.length===6){Keyboard.dismiss();verificar(cleaned);}
        }}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="● ● ● ● ● ●"
          placeholderTextColor="#D0C8DC"
          textAlign="center"
          editable={!verificando}
        />

        <TouchableOpacity
          style={[ss.btnW,(codigo.length!==6||verificando)&&ss.btnDis]}
          onPress={verificar}
          disabled={verificando||codigo.length!==6}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={codigo.length===6&&!verificando?["#E8785A","#D4614A"]:["#D0C8DC","#C0B8CC"]}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={ss.btn}
          >
            {verificando
              ?<ActivityIndicator color="#FFF" size="small"/>
              :<Text style={ss.btnTxt}>Verificar cuenta</Text>
            }
          </LinearGradient>
        </TouchableOpacity>

        <View style={ss.reenviarRow}>
          <Text style={ss.reenviarLabel}>¿No llegó? </Text>
          <TouchableOpacity onPress={enviarCodigo} disabled={cooldown>0||enviando}>
            {enviando
              ?<ActivityIndicator size="small" color="#E8785A"/>
              :<Text style={[ss.reenviarLink,cooldown>0&&ss.reenviarDis]}>
                {cooldown>0?`Reenviar en ${cooldown}s`:"Reenviar código"}
              </Text>
            }
          </TouchableOpacity>
        </View>

        <View style={ss.nota}>
          <Text style={ss.notaTxt}>Si no aparece en unos minutos, revisá la carpeta de spam o correo no deseado.</Text>
        </View>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:"#FBF8F4"},
  hdr:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:20,paddingTop:16,paddingBottom:14,backgroundColor:"#FFFFFF",borderBottomWidth:1,borderBottomColor:"#EDE8E2"},
  back:{fontSize:14,fontWeight:"700",color:"#E8785A"},
  tit:{fontSize:16,fontWeight:"800",color:"#1A1020"},
  body:{flex:1,paddingHorizontal:28,paddingTop:44,alignItems:"center"},
  iconoWrap:{width:86,height:86,borderRadius:43,backgroundColor:"#FEF3F0",alignItems:"center",justifyContent:"center",marginBottom:24,borderWidth:2,borderColor:"#F0C8BA"},
  icono:{fontSize:38},
  titulo:{fontSize:24,fontWeight:"900",color:"#1A1020",textAlign:"center",marginBottom:14},
  emailBox:{backgroundColor:"#F4EFE9",borderRadius:12,paddingHorizontal:20,paddingVertical:10,marginBottom:14,borderWidth:1.5,borderColor:"#E8DDD3"},
  emailTxt:{fontSize:14,fontWeight:"700",color:"#1A1020",textAlign:"center"},
  sub:{fontSize:13,color:"#5A4E6A",textAlign:"center",marginBottom:28,lineHeight:19,paddingHorizontal:8},
  otpInput:{width:220,height:70,borderWidth:2,borderColor:"#EDE8E2",borderRadius:18,fontSize:30,fontWeight:"900",color:"#1A1020",backgroundColor:"#FFFFFF",marginBottom:28,letterSpacing:8},
  otpInputActive:{borderColor:"#E8785A"},
  btnW:{width:"100%",borderRadius:14,overflow:"hidden",marginBottom:20},
  btnDis:{opacity:0.7},
  btn:{paddingVertical:16,alignItems:"center"},
  btnTxt:{color:"#FFF",fontSize:16,fontWeight:"800"},
  reenviarRow:{flexDirection:"row",alignItems:"center",marginBottom:24},
  reenviarLabel:{fontSize:14,color:"#A898B8"},
  reenviarLink:{fontSize:14,fontWeight:"700",color:"#E8785A"},
  reenviarDis:{color:"#C0B8CC",fontWeight:"600"},
  nota:{backgroundColor:"#F4EFE9",borderRadius:10,padding:14,width:"100%"},
  notaTxt:{fontSize:12,color:"#A898B8",lineHeight:18,textAlign:"center"},
});
