import React,{useState} from "react";
import{View,Text,StyleSheet,TouchableOpacity,TextInput,Alert,ActivityIndicator}from "react-native";
import{KeyboardAwareScrollView}from "react-native-keyboard-aware-scroll-view";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import{login}from "../../services/auth";
import{useI18n}from "../../services/I18nContext";

const ROLES=[{id:"worker",label:"Trabajador",emoji:"💼"},{id:"employer",label:"Empleador",emoji:"🏠"}];

export default function LoginScreen({navigation}){
const{t}=useI18n();
const[rolSeleccionado,setRolSeleccionado]=useState("worker");
const[email,setEmail]=useState("");
const[pass,setPass]=useState("");
const[ver,setVer]=useState(false);
const[load,setLoad]=useState(false);

async function handleLogin(){
const emailClean=email.trim().toLowerCase();
if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)){Alert.alert(t('error'),t('email_no_valido'));return;}
if(pass.length<6){Alert.alert(t('error'),t('contrasena_corta'));return;}
setLoad(true);
try{
await AsyncStorage.setItem('nexu_rol_pending',rolSeleccionado);
await login({email:emailClean,password:pass});
}catch(e){
await AsyncStorage.removeItem('nexu_rol_pending');
Alert.alert(t('error_sesion'),e.message||t('intentalo_nuevo'));
}finally{
setLoad(false);
}}

return(
<SafeAreaView style={ss.c} edges={["top"]}>
<KeyboardAwareScrollView contentContainerStyle={ss.scroll} keyboardShouldPersistTaps="handled" enableOnAndroid={true} enableAutomaticScroll={true} extraScrollHeight={100} keyboardOpeningTime={0}>
<View style={ss.hdr}>
<TouchableOpacity onPress={()=>navigation.goBack()}><Text style={ss.back}>{t('volver')}</Text></TouchableOpacity>
<Text style={ss.tit}>{t('inicia_sesion_tit')}</Text>
<Text style={ss.sub}>{t('entra_cuenta')}</Text>
</View>

<Text style={ss.rolLbl}>Entrás como</Text>
<View style={ss.rolRow}>
{ROLES.map(r=>{
  const act=rolSeleccionado===r.id;
  return(
    <TouchableOpacity key={r.id} style={[ss.rolBtn,act&&ss.rolBtnA]} onPress={()=>setRolSeleccionado(r.id)} activeOpacity={0.8}>
      <Text style={ss.rolEmoji}>{r.emoji}</Text>
      <Text style={[ss.rolTxt,act&&ss.rolTxtA]}>{r.label}</Text>
    </TouchableOpacity>
  );
})}
</View>

<View style={ss.iw}><Text style={ss.lbl}>{t('email')}</Text>
<View style={ss.ib}><Text>✉️</Text><TextInput style={ss.input} placeholder="tu@email.com" placeholderTextColor="#D0C8DC" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/></View></View>
<View style={ss.iw}><Text style={ss.lbl}>{t('contrasena')}</Text>
<View style={ss.ib}><Text>🔑</Text><TextInput style={ss.input} placeholder={t('contrasena_placeholder')} placeholderTextColor="#D0C8DC" value={pass} onChangeText={setPass} secureTextEntry={!ver} autoCapitalize="none"/>
<TouchableOpacity onPress={()=>setVer(!ver)}><Text style={{fontSize:16}}>{ver?"🙈":"👁️"}</Text></TouchableOpacity></View></View>
<TouchableOpacity style={ss.forgot} onPress={()=>Alert.alert(t('proximamente'),t('recuperacion_prox'))}><Text style={ss.forgotTxt}>{t('olvide_contrasena')}</Text></TouchableOpacity>
<TouchableOpacity style={ss.btnW} onPress={handleLogin} disabled={load}>
<LinearGradient colors={["#E8785A","#D4614A"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
{load?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>{t('iniciar_sesion_btn')}</Text>}
</LinearGradient></TouchableOpacity>
<View style={ss.div}><View style={ss.dl}/><Text style={ss.dTxt}>{t('o_continua_con')}</Text><View style={ss.dl}/></View>
<View style={ss.soc}>
<TouchableOpacity style={ss.sBtn} onPress={()=>Alert.alert(t('proximamente'))}><Text style={{fontSize:20}}>🌐</Text><Text style={ss.sBtnTxt}>Google</Text></TouchableOpacity>
<TouchableOpacity style={ss.sBtn} onPress={()=>Alert.alert(t('proximamente'))}><Text style={{fontSize:20}}>🍎</Text><Text style={ss.sBtnTxt}>Apple</Text></TouchableOpacity>
<TouchableOpacity style={ss.sBtn} onPress={()=>Alert.alert(t('proximamente'))}><Text style={{fontSize:20}}>👆</Text><Text style={ss.sBtnTxt}>{t('huella_face')}</Text></TouchableOpacity>
</View>
<TouchableOpacity style={ss.reg} onPress={()=>navigation.navigate("RoleSelect")}>
<Text style={ss.regTxt}>{t('no_tenes_cuenta')} <Text style={ss.regBold}>{t('registrate_gratis')}</Text></Text>
</TouchableOpacity>
</KeyboardAwareScrollView>
</SafeAreaView>);}

const ss=StyleSheet.create({
c:{flex:1,backgroundColor:"#FBF8F4"},scroll:{paddingHorizontal:24,paddingBottom:40},
hdr:{paddingTop:16,paddingBottom:24},back:{fontSize:14,fontWeight:"700",color:"#2DD4BF",marginBottom:24},
tit:{fontSize:32,fontWeight:"900",color:"#1A1020",letterSpacing:-1,marginBottom:6},
sub:{fontSize:14,color:"#A898B8"},
rolLbl:{fontSize:12,fontWeight:"700",color:"#5A4E6A",marginBottom:8},
rolRow:{flexDirection:"row",gap:10,marginBottom:20},
rolBtn:{flex:1,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8,paddingVertical:12,borderRadius:12,borderWidth:1.5,borderColor:"#EDE8E2",backgroundColor:"#FFF"},
rolBtnA:{borderColor:"#E8785A",backgroundColor:"#FEF3F0"},
rolEmoji:{fontSize:16},
rolTxt:{fontSize:13,fontWeight:"600",color:"#A898B8"},
rolTxtA:{color:"#E8785A",fontWeight:"700"},
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
