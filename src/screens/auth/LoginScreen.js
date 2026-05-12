import React,{useState} from "react";
import{View,Text,StyleSheet,TouchableOpacity,TextInput,Alert,ActivityIndicator}from "react-native";
import{KeyboardAwareScrollView}from "react-native-keyboard-aware-scroll-view";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import{login}from "../../services/auth";

export default function LoginScreen({navigation}){
const[email,setEmail]=useState("");
const[pass,setPass]=useState("");
const[ver,setVer]=useState(false);
const[load,setLoad]=useState(false);

async function handleLogin(){
if(!email.includes("@")){Alert.alert("Error","Email no valido");return;}
if(pass.length<6){Alert.alert("Error","Contrasena muy corta");return;}
setLoad(true);
try{
await login({email,password:pass});

}catch(e){
Alert.alert("Error al iniciar sesion",e.message||"Intentalo de nuevo");
}finally{
setLoad(false);
}}

return(
<SafeAreaView style={ss.c} edges={["top"]}>
<KeyboardAwareScrollView contentContainerStyle={ss.scroll} keyboardShouldPersistTaps="handled" enableOnAndroid={true} enableAutomaticScroll={true} extraScrollHeight={100} keyboardOpeningTime={0}>
<View style={ss.hdr}>
<TouchableOpacity onPress={()=>navigation.goBack()}><Text style={ss.back}>Volver</Text></TouchableOpacity>
<Text style={ss.tit}>Inicia sesion</Text>
<Text style={ss.sub}>Entra a tu cuenta de Nexu</Text>
</View>
<View style={ss.iw}><Text style={ss.lbl}>Email</Text>
<View style={ss.ib}><Text>✉️</Text><TextInput style={ss.input} placeholder="tu@email.com" placeholderTextColor="#D0C8DC" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/></View></View>
<View style={ss.iw}><Text style={ss.lbl}>Contrasena</Text>
<View style={ss.ib}><Text>🔑</Text><TextInput style={ss.input} placeholder="Tu contrasena" placeholderTextColor="#D0C8DC" value={pass} onChangeText={setPass} secureTextEntry={!ver} autoCapitalize="none"/>
<TouchableOpacity onPress={()=>setVer(!ver)}><Text style={{fontSize:16}}>{ver?"🙈":"👁️"}</Text></TouchableOpacity></View></View>
<TouchableOpacity style={ss.forgot} onPress={()=>Alert.alert("Proximamente","Recuperacion de contrasena disponible pronto.")}><Text style={ss.forgotTxt}>Olvidaste tu contrasena?</Text></TouchableOpacity>
<TouchableOpacity style={ss.btnW} onPress={handleLogin} disabled={load}>
<LinearGradient colors={["#E8785A","#D4614A"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
{load?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>Iniciar sesion</Text>}
</LinearGradient></TouchableOpacity>
<View style={ss.div}><View style={ss.dl}/><Text style={ss.dTxt}>o continua con</Text><View style={ss.dl}/></View>
<View style={ss.soc}>
<TouchableOpacity style={ss.sBtn} onPress={()=>Alert.alert("Proximamente")}><Text style={{fontSize:20}}>🌐</Text><Text style={ss.sBtnTxt}>Google</Text></TouchableOpacity>
<TouchableOpacity style={ss.sBtn} onPress={()=>Alert.alert("Proximamente")}><Text style={{fontSize:20}}>🍎</Text><Text style={ss.sBtnTxt}>Apple</Text></TouchableOpacity>
<TouchableOpacity style={ss.sBtn} onPress={()=>Alert.alert("Proximamente")}><Text style={{fontSize:20}}>👆</Text><Text style={ss.sBtnTxt}>Huella</Text></TouchableOpacity>
</View>
<TouchableOpacity style={ss.reg} onPress={()=>navigation.navigate("RoleSelect")}>
<Text style={ss.regTxt}>No tenes cuenta? <Text style={ss.regBold}>Registrate gratis</Text></Text>
</TouchableOpacity>
</KeyboardAwareScrollView>
</SafeAreaView>);}

const ss=StyleSheet.create({
c:{flex:1,backgroundColor:"#FBF8F4"},scroll:{paddingHorizontal:24,paddingBottom:40},
hdr:{paddingTop:16,paddingBottom:32},back:{fontSize:14,fontWeight:"700",color:"#2DD4BF",marginBottom:24},
tit:{fontSize:32,fontWeight:"900",color:"#1A1020",letterSpacing:-1,marginBottom:6},
sub:{fontSize:14,color:"#A898B8"},
iw:{marginBottom:16},lbl:{fontSize:12,fontWeight:"700",color:"#5A4E6A",marginBottom:6},
ib:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:12,paddingHorizontal:14,height:52,gap:10},
input:{flex:1,fontSize:14,color:"#1A1020"},
forgot:{alignSelf:"flex-end",marginBottom:20},forgotTxt:{fontSize:13,color:"#2DD4BF",fontWeight:"600"},
btnW:{borderRadius:14,overflow:"hidden",marginBottom:24},btn:{paddingVertical:16,alignItems:"center"},btnTxt:{color:"#FFF",fontSize:16,fontWeight:"800"},
div:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:20},dl:{flex:1,height:1,backgroundColor:"#EDE8E2"},dTxt:{fontSize:12,color:"#A898B8"},
soc:{flexDirection:"row",gap:10,marginBottom:32},
sBtn:{flex:1,backgroundColor:"#FFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:12,paddingVertical:12,alignItems:"center",gap:4},
sBtnTxt:{fontSize:11,fontWeight:"700",color:"#5A4E6A"},
reg:{alignItems:"center"},regTxt:{fontSize:14,color:"#A898B8"},regBold:{fontWeight:"700",color:"#E8785A"},
});
