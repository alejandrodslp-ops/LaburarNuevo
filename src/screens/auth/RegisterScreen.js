import React,{useState} from "react";
import{View,Text,StyleSheet,TouchableOpacity,TextInput,Alert,ActivityIndicator,Keyboard}from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import{KeyboardAwareScrollView}from "react-native-keyboard-aware-scroll-view";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import{registrar,acreditarReferido}from "../../services/auth";

export default function RegisterScreen({navigation,route}){
const rol=route?.params?.role||"worker";
const[nombre1,setNombre1]=useState("");
const[nombre2,setNombre2]=useState("");
const[apellido1,setApellido1]=useState("");
const[apellido2,setApellido2]=useState("");
const[email,setEmail]=useState("");
const[pass,setPass]=useState("");
const[ver,setVer]=useState(false);
const[terminos,setTerminos]=useState(false);
const[load,setLoad]=useState(false);
const ROLES={worker:"Trabajador",employer:"Empleador",company:"Empresa"};

async function handleRegistrar(){
if(nombre1.trim().length<2){Alert.alert("Error","Ingresa tu primer nombre");return;}
if(apellido1.trim().length<2){Alert.alert("Error","Ingresa tu primer apellido");return;}
if(!email.includes("@")){Alert.alert("Error","Email no valido");return;}
if(pass.length<8){Alert.alert("Error","La contrasena debe tener al menos 8 caracteres");return;}
if(!terminos){Alert.alert("Error","Debes aceptar los terminos y condiciones");return;}
setLoad(true);
try{
// Flag ANTES del signUp para evitar race condition con onAuthStateChange
await AsyncStorage.setItem("coach_perfil_pendiente","true");
const resultado=await registrar({email,password:pass,nombre:nombre1,apellido1,rol});
const refCode=await AsyncStorage.getItem("referral_code");
if(refCode){await acreditarReferido(refCode,resultado?.user?.id);await AsyncStorage.removeItem("referral_code");}
// Si Supabase requiere confirmacion de email (sin session automatica)
if(!resultado?.session){
  Alert.alert(
    "¡Cuenta creada!",
    "Revisa tu email para confirmar tu cuenta y luego inicia sesion.",
    [{text:"Iniciar sesion",onPress:()=>navigation.navigate("Login")}]
  );
}
// Si hay session automatica, AppContext navega solo
}catch(e){
await AsyncStorage.removeItem("coach_perfil_pendiente");
Alert.alert("Error al crear la cuenta",e.message||"Intentalo de nuevo");
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
<View style={{flex:1}}><View style={ss.iw}><View style={{flexDirection:"row",justifyContent:"space-between"}}><Text style={ss.lbl}>Segundo apellido</Text><Text style={ss.opt}>Opcional</Text></View><View style={ss.ib}><TextInput style={ss.input} placeholder="Apellido 2" placeholderTextColor="#D0C8DC" value={apellido2} onChangeText={setApellido2} autoCapitalize="words"/></View></View></View>
</View>

<View style={ss.iw}><Text style={ss.lbl}>Email</Text>
<View style={ss.ib}><TextInput style={ss.input} placeholder="tu@email.com" placeholderTextColor="#D0C8DC" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/></View></View>

<View style={ss.iw}><Text style={ss.lbl}>Contrasena</Text>
<View style={ss.ib}><TextInput style={ss.input} placeholder="Minimo 8 caracteres" placeholderTextColor="#D0C8DC" value={pass} onChangeText={setPass} secureTextEntry={!ver} autoCapitalize="none"/>
<TouchableOpacity onPress={()=>setVer(!ver)}><Text style={{fontSize:16}}>{ver?"🙈":"👁️"}</Text></TouchableOpacity></View></View>

<TouchableOpacity style={ss.termRow} onPress={()=>setTerminos(!terminos)}>
<View style={[ss.check,terminos&&ss.checkA]}>{terminos&&<Text style={{color:"#FFF",fontSize:12,fontWeight:"800"}}>✓</Text>}</View>
<Text style={ss.termTxt}>Acepto los <Text style={ss.termLink}>Terminos y Condiciones</Text> y la <Text style={ss.termLink}>Politica de Privacidad</Text></Text>
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
