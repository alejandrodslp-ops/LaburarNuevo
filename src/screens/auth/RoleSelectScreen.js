import React,{useState} from "react";
import{View,Text,StyleSheet,TouchableOpacity,ScrollView}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
const ROLES=[
{id:"worker",emoji:"💼",titulo:"Soy trabajador",desc:"Ofrezco mis servicios o habilidades",items:["Activa tu perfil facilmente","Aparece en busquedas","Postulate a concursos publicos"],color:"#E8785A",bg:"#FFF0ED"},
{id:"employer",emoji:"🏠",titulo:"Busco un servicio",desc:"Necesito contratar a alguien",items:["Busca por zona y categoria","Contacta de forma simple","Valora al trabajador"],color:"#2DD4BF",bg:"#F0FDFA"},
{id:"company",emoji:"🏢",titulo:"Soy empresa",desc:"Busco empleados para mi empresa",items:["Planes flexibles para empresas","Filtros avanzados","Factura electronica"],color:"#3DA882",bg:"#E6FBF5"},
];
export default function RoleSelectScreen({navigation}){
const[sel,setSel]=useState(null);
function continuar(){
  if(!sel)return;
  if(sel==="company"){navigation.navigate("RegisterEmpresa");return;}
  navigation.navigate("Register",{role:sel});
}
return(
<SafeAreaView style={ss.c} edges={["top"]}>
<ScrollView contentContainerStyle={ss.scroll} showsVerticalScrollIndicator={false}>
<View style={ss.hdr}>
<Text style={ss.tit}>Como vas a usar Nexu?</Text>
<Text style={ss.sub}>Elegi tu perfil para empezar</Text>
</View>
{ROLES.map(rol=>(
<TouchableOpacity key={rol.id} style={[ss.card,sel===rol.id&&{borderColor:rol.color,borderWidth:2.5}]} onPress={()=>setSel(rol.id)} activeOpacity={0.85}>
{sel===rol.id&&(<View style={[ss.check,{backgroundColor:rol.color}]}><Text style={{color:"#FFF",fontSize:12,fontWeight:"800"}}>✓</Text></View>)}
<View style={[ss.icon,{backgroundColor:rol.bg}]}><Text style={{fontSize:32}}>{rol.emoji}</Text></View>
<View style={ss.ct}>
<Text style={ss.ctit}>{rol.titulo}</Text>
<Text style={ss.cdesc}>{rol.desc}</Text>
<View style={ss.items}>
{rol.items.map((item,i)=>(<View key={i} style={ss.item}><Text style={[ss.idot,{color:rol.color}]}>✓</Text><Text style={ss.itxt}>{item}</Text></View>))}
</View>
</View>
</TouchableOpacity>
))}
<TouchableOpacity style={[ss.btnW,!sel&&ss.btnD]} onPress={continuar} disabled={!sel} activeOpacity={0.85}>
<LinearGradient colors={sel?[ROLES.find(r=>r.id===sel)?.color||"#E8785A","#D4614A"]:["#D0C8DC","#A898B8"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
<Text style={ss.btnTxt}>Continuar</Text>
</LinearGradient>
</TouchableOpacity>
<TouchableOpacity style={ss.link} onPress={()=>navigation.navigate("Login")}>
<Text style={ss.linkTxt}>Ya tenes cuenta? <Text style={ss.linkBold}>Inicia sesion</Text></Text>
</TouchableOpacity>
</ScrollView>
</SafeAreaView>);}
const ss=StyleSheet.create({
c:{flex:1,backgroundColor:"#FBF8F4"},scroll:{paddingHorizontal:20,paddingBottom:40},
hdr:{paddingTop:32,paddingBottom:24},
tit:{fontSize:28,fontWeight:"900",color:"#1A1020",letterSpacing:-0.5,marginBottom:6},
sub:{fontSize:14,color:"#A898B8"},
card:{backgroundColor:"#FFF",borderRadius:20,padding:20,marginBottom:14,borderWidth:1.5,borderColor:"#EDE8E2",flexDirection:"row",gap:16,position:"relative"},
check:{position:"absolute",top:14,right:14,width:22,height:22,borderRadius:11,alignItems:"center",justifyContent:"center"},
icon:{width:60,height:60,borderRadius:16,alignItems:"center",justifyContent:"center",flexShrink:0},
ct:{flex:1},ctit:{fontSize:16,fontWeight:"800",color:"#1A1020",marginBottom:3},
cdesc:{fontSize:13,color:"#A898B8",marginBottom:12},
items:{gap:4},item:{flexDirection:"row",alignItems:"center",gap:6},
idot:{fontSize:11,fontWeight:"800"},itxt:{fontSize:12,color:"#5A4E6A"},
btnW:{borderRadius:14,overflow:"hidden",marginTop:8},
btnD:{opacity:0.6},btn:{paddingVertical:16,alignItems:"center"},
btnTxt:{color:"#FFF",fontSize:16,fontWeight:"800"},
link:{alignItems:"center",paddingTop:20},
linkTxt:{fontSize:14,color:"#A898B8"},
linkBold:{fontWeight:"700",color:"#2DD4BF"},
});
