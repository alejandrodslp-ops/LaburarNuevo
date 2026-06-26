import React,{useState} from "react";
import{View,Text,StyleSheet,TouchableOpacity,TextInput,Alert,ActivityIndicator,Keyboard}from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import{KeyboardAwareScrollView}from "react-native-keyboard-aware-scroll-view";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import{registrar}from "../../services/auth";
import{supabase}from "../../services/supabase";
import{useI18n}from "../../services/I18nContext";

export default function RegisterScreen({navigation,route}){
const rol=route?.params?.role||"worker";
const{t}=useI18n();

function mensajeError(msg=""){
  const m=msg.toLowerCase();
  if(m.includes("signup")&&m.includes("not allowed"))return t('err_signup_disabled');
  if(m.includes("already registered")||m.includes("already exists")||m.includes("user already"))return t('err_already_reg');
  if(m.includes("password")&&(m.includes("short")||m.includes("characters")||m.includes("least")))return t('err_pass_short');
  if(m.includes("invalid")&&m.includes("email"))return t('err_email_invalid');
  if(m.includes("rate limit")||m.includes("too many"))return t('err_rate_limit');
  return msg||t('err_generic_reg');
}
const[nombre1,setNombre1]=useState("");
const[nombre2,setNombre2]=useState("");
const[apellido1,setApellido1]=useState("");
const[apellido2,setApellido2]=useState("");
const[email,setEmail]=useState("");
const[pass,setPass]=useState("");
const[ver,setVer]=useState(false);
const[terminos,setTerminos]=useState(false);
const[load,setLoad]=useState(false);
const[fnDia,setFnDia]=useState("");
const[fnMes,setFnMes]=useState("");
const[fnAnio,setFnAnio]=useState("");
const ROLES={worker:"Trabajador",employer:"Empleador",company:"Empresa"};

function calcularEdadDesdeInputs(dia,mes,anio){
  const d=parseInt(dia,10),m=parseInt(mes,10),a=parseInt(anio,10);
  if(!d||!m||!a||a<1900||a>new Date().getFullYear())return null;
  const nac=new Date(a,m-1,d);
  const hoy=new Date();
  let edad=hoy.getFullYear()-nac.getFullYear();
  if(hoy<new Date(hoy.getFullYear(),m-1,d))edad--;
  return edad;
}

async function handleRegistrar(){
const emailClean=email.trim().toLowerCase();
const nombre1Clean=nombre1.trim();
const apellido1Clean=apellido1.trim();
const apellido2Clean=apellido2.trim();
if(nombre1Clean.length<2){Alert.alert("Error","Ingresa tu primer nombre");return;}
if(apellido1Clean.length<2){Alert.alert("Error","Ingresa tu primer apellido");return;}
if(apellido2Clean.length<2){Alert.alert("Error","Ingresa tu segundo apellido");return;}
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)){Alert.alert("Error","Email no valido");return;}
if(pass.length<8){Alert.alert("Error","La contrasena debe tener al menos 8 caracteres");return;}
if(!fnDia||!fnMes||!fnAnio||fnAnio.length<4){Alert.alert("Error","Ingresa tu fecha de nacimiento completa");return;}
const edadCalc=calcularEdadDesdeInputs(fnDia,fnMes,fnAnio);
if(edadCalc===null){Alert.alert("Error","Fecha de nacimiento no válida");return;}
if(edadCalc<18){Alert.alert("Acceso restringido","Debes ser mayor de edad para registrarte en Konexu.");return;}
if(!terminos){Alert.alert("Error","Debes aceptar los terminos y condiciones");return;}
setLoad(true);
// Verificar si la waitlist está activa y si este email está habilitado
try{
  const{data:wl}=await supabase.functions.invoke('waitlist',{body:{accion:'consultar',email:email.trim().toLowerCase()}});
  if(wl?.activo&&!wl?.habilitado){
    setLoad(false);
    navigation.navigate('Waitlist',{email:email.trim(),role:rol});
    return;
  }
}catch{/* si falla el chequeo, dejamos registrar igual */}
try{
// Flag ANTES del signUp para evitar race condition con onAuthStateChange
await AsyncStorage.setItem("coach_perfil_pendiente","true");
await AsyncStorage.setItem("ir_a_editar_perfil","true");
await AsyncStorage.setItem("verificar_email_pendiente","true");
const fechaNacFmt=`${fnDia.padStart(2,'0')}/${fnMes.padStart(2,'0')}/${fnAnio}`;
const resultado=await registrar({email:emailClean,password:pass,nombre:nombre1Clean,apellido1:apellido1Clean,apellido2:apellido2Clean,rol,fecha_nac:fechaNacFmt});
// Marcar como registrado en la waitlist (silencioso)
supabase.functions.invoke('waitlist',{body:{accion:'registrado',email:email.trim().toLowerCase()}}).catch(()=>{});
const refCode=await AsyncStorage.getItem("referral_code");
if(refCode){await supabase.functions.invoke('acreditar-referido',{body:{codigo_referido:refCode,nuevo_user_id:resultado?.user?.id}}).catch(()=>{});await AsyncStorage.removeItem("referral_code");}
if(resultado?.user?.id){supabase.functions.invoke("mensaje-bienvenida",{body:{user_id:resultado.user.id,rol}}).catch(()=>{});}
// Si hay session automatica, AppContext detecta el flag y navega a VerificarEmail
}catch(e){
await AsyncStorage.removeItem("coach_perfil_pendiente");
await AsyncStorage.removeItem("ir_a_editar_perfil");
await AsyncStorage.removeItem("verificar_email_pendiente");
const msg=e.message||"";
const esEmailExistente=msg.toLowerCase().includes("already registered")||msg.toLowerCase().includes("already exists")||msg.toLowerCase().includes("user already");
if(esEmailExistente){
  // El email ya tiene cuenta — intentar iniciar sesión con ese rol
  try{
    const{data:loginData,error:loginErr}=await supabase.auth.signInWithPassword({email,password:pass});
    if(loginErr)throw new Error("Ese correo ya tiene una cuenta registrada. Verificá tu contraseña e intentá iniciar sesión.");
    // Guardar el rol seleccionado para esta sesión
    await AsyncStorage.setItem('nexu_rol_pending',rol);
    supabase.functions.invoke("mensaje-bienvenida",{body:{user_id:loginData.user.id,rol}}).catch(()=>{});
    // onAuthStateChange en AppContext se encarga del resto
  }catch(loginErr){
    Alert.alert("Correo ya registrado",loginErr.message||"Ese correo ya tiene una cuenta. Iniciá sesión desde la pantalla de login.");
  }
}else{
  Alert.alert(t('error_registro'),mensajeError(msg));
}
}finally{setLoad(false);}}

return(
<SafeAreaView style={ss.c} edges={["top"]}>
<KeyboardAwareScrollView contentContainerStyle={ss.scroll} keyboardShouldPersistTaps="handled" enableOnAndroid={true} enableAutomaticScroll={true} extraScrollHeight={100} keyboardOpeningTime={0}>
<View style={ss.hdr}>
<TouchableOpacity onPress={()=>navigation.goBack()}><Text style={ss.back}>Volver</Text></TouchableOpacity>
<Text style={ss.tit}>Crear cuenta</Text>
<View style={ss.badge}><Text style={ss.badgeTxt}>{ROLES[rol]}</Text></View>
</View>

<View style={{flexDirection:"row",gap:10}}>
<View style={{flex:1}}><View style={ss.iw}><Text style={ss.lbl}>Primer nombre</Text><View style={ss.ib}><TextInput style={ss.input} placeholder="Nombre" placeholderTextColor="#D0C8DC" value={nombre1} onChangeText={setNombre1} autoCapitalize="words"/></View></View></View>
<View style={{flex:1}}><View style={ss.iw}><View style={{flexDirection:"row",justifyContent:"space-between"}}><Text style={ss.lbl}>Segundo nombre</Text><Text style={ss.opt}>Opcional</Text></View><View style={ss.ib}><TextInput style={ss.input} placeholder="Nombre 2" placeholderTextColor="#D0C8DC" value={nombre2} onChangeText={setNombre2} autoCapitalize="words"/></View></View></View>
</View>

<View style={{flexDirection:"row",gap:10}}>
<View style={{flex:1}}><View style={ss.iw}><Text style={ss.lbl}>Primer apellido</Text><View style={ss.ib}><TextInput style={ss.input} placeholder="Apellido" placeholderTextColor="#D0C8DC" value={apellido1} onChangeText={setApellido1} autoCapitalize="words"/></View></View></View>
<View style={{flex:1}}><View style={ss.iw}><Text style={ss.lbl}>Segundo apellido</Text><View style={ss.ib}><TextInput style={ss.input} placeholder="Apellido 2" placeholderTextColor="#D0C8DC" value={apellido2} onChangeText={setApellido2} autoCapitalize="words"/></View></View></View>
</View>

<View style={ss.iw}><Text style={ss.lbl}>Email</Text>
<View style={ss.ib}><TextInput style={ss.input} placeholder="tu@email.com" placeholderTextColor="#D0C8DC" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/></View></View>

<View style={ss.iw}><Text style={ss.lbl}>Contrasena</Text>
<View style={ss.ib}><TextInput style={ss.input} placeholder="Minimo 8 caracteres" placeholderTextColor="#D0C8DC" value={pass} onChangeText={setPass} secureTextEntry={!ver} autoCapitalize="none"/>
<TouchableOpacity onPress={()=>setVer(!ver)}><Text style={{fontSize:16}}>{ver?"🙈":"👁️"}</Text></TouchableOpacity></View></View>

<View style={ss.iw}>
<Text style={ss.lbl}>Fecha de nacimiento <Text style={{color:"#E8785A"}}>*</Text></Text>
<View style={{flexDirection:"row",gap:8}}>
<View style={[ss.ib,{flex:1}]}><TextInput style={ss.input} placeholder="DD" placeholderTextColor="#D0C8DC" value={fnDia} onChangeText={t=>setFnDia(t.replace(/\D/g,'').slice(0,2))} keyboardType="number-pad" maxLength={2}/></View>
<View style={[ss.ib,{flex:1}]}><TextInput style={ss.input} placeholder="MM" placeholderTextColor="#D0C8DC" value={fnMes} onChangeText={t=>setFnMes(t.replace(/\D/g,'').slice(0,2))} keyboardType="number-pad" maxLength={2}/></View>
<View style={[ss.ib,{flex:2}]}><TextInput style={ss.input} placeholder="AAAA" placeholderTextColor="#D0C8DC" value={fnAnio} onChangeText={t=>setFnAnio(t.replace(/\D/g,'').slice(0,4))} keyboardType="number-pad" maxLength={4}/></View>
</View>
<Text style={{fontSize:11,color:"#A898B8",marginTop:4}}>Debés ser mayor de 18 años para registrarte.</Text>
</View>

<TouchableOpacity style={ss.termRow} onPress={()=>setTerminos(!terminos)}>
<View style={[ss.check,terminos&&ss.checkA]}>{terminos&&<Text style={{color:"#FFF",fontSize:12,fontWeight:"800"}}>✓</Text>}</View>
<Text style={ss.termTxt}>Acepto los <Text style={ss.termLink}>Terminos y Condiciones</Text> y la <Text style={ss.termLink}>Politica de Privacidad</Text>. Declaro que la informacion que proporciono es veraz y soy responsable de su exactitud.</Text>
</TouchableOpacity>

<View style={ss.aviso}><Text style={ss.avisoTxt}>Tus datos son privados. Solo los empleadores que paguen por contactarte podran verlos.</Text></View>

<TouchableOpacity style={ss.btnW} onPress={()=>{Keyboard.dismiss();handleRegistrar();}} disabled={load}>
<LinearGradient colors={["#E8785A","#D4614A"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
{load?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>Crear cuenta</Text>}
</LinearGradient></TouchableOpacity>

<TouchableOpacity style={ss.link} onPress={()=>navigation.navigate("Login")}>
<Text style={ss.linkTxt}>Ya tenes cuenta? <Text style={ss.linkBold}>Inicia sesion</Text></Text>
</TouchableOpacity>
</KeyboardAwareScrollView>
</SafeAreaView>);}

const ss=StyleSheet.create({
c:{flex:1,backgroundColor:"#FBF8F4"},scroll:{paddingHorizontal:24,paddingBottom:40},
hdr:{paddingTop:16,paddingBottom:28},back:{fontSize:14,fontWeight:"700",color:"#2DD4BF",marginBottom:20},
tit:{fontSize:32,fontWeight:"900",color:"#1A1020",letterSpacing:-1,marginBottom:10},
badge:{alignSelf:"flex-start",backgroundColor:"#F0FDFA",paddingHorizontal:12,paddingVertical:5,borderRadius:20},
badgeTxt:{fontSize:13,fontWeight:"700",color:"#2DD4BF"},
iw:{marginBottom:12},lbl:{fontSize:12,fontWeight:"700",color:"#5A4E6A",marginBottom:6},
opt:{fontSize:10,color:"#A898B8",fontStyle:"italic"},
ib:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:12,paddingHorizontal:14,height:52,gap:10},
input:{flex:1,fontSize:14,color:"#1A1020"},
termRow:{flexDirection:"row",alignItems:"flex-start",gap:12,marginBottom:12},
check:{width:22,height:22,borderRadius:6,borderWidth:2,borderColor:"#EDE8E2",alignItems:"center",justifyContent:"center",marginTop:1,flexShrink:0},
checkA:{backgroundColor:"#E8785A",borderColor:"#E8785A"},
termTxt:{fontSize:13,color:"#5A4E6A",flex:1,lineHeight:20},
termLink:{color:"#2DD4BF",fontWeight:"700"},
aviso:{backgroundColor:"#E6FBF5",borderRadius:10,padding:12,marginBottom:20,borderLeftWidth:3,borderLeftColor:"#3DA882"},
avisoTxt:{fontSize:12,color:"#2E9472",lineHeight:18},
btnW:{borderRadius:14,overflow:"hidden",marginBottom:16},btn:{paddingVertical:16,alignItems:"center"},btnTxt:{color:"#FFF",fontSize:16,fontWeight:"800"},
link:{alignItems:"center"},linkTxt:{fontSize:14,color:"#A898B8"},linkBold:{fontWeight:"700",color:"#2DD4BF"},
});
