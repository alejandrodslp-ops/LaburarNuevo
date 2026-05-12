import React,{useState} from "react";
import{View,Text,StyleSheet,TouchableOpacity,TextInput,ScrollView,Alert,Switch}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
const C={coral:"#E8785A",indigo:"#5E70A8",indigoSoft:"#EEF0FF",menta:"#3DA882",mentaSoft:"#E6FBF5",blanco:"#FFFFFF",crema:"#FBF8F4",borde:"#EDE8E2",texto1:"#1A1020",texto2:"#5A4E6A",texto3:"#A898B8"};
const SEXOS=["Masculino","Femenino","Otro"];
const ESTADOS=["Soltero/a","Casado/a","Divorciado/a","Viudo/a","En pareja"];
const DISPS=["Inmediata","En 1 semana","En 2 semanas","A convenir"];
const TIPOS=["Permanente","Temporal","Por tarea","Medio horario"];
const LANGS=["Espanol","Portugues","Ingles","Frances","Italiano","Aleman","Otro"];
const PAISES=["Afghanistan","Albania","Algeria","Argentina","Australia","Austria","Belgium","Bolivia","Brasil","Canada","Chile","China","Colombia","Costa Rica","Cuba","Denmark","Ecuador","Egypt","El Salvador","Spain","United States","Ethiopia","Finland","France","Germany","Greece","Guatemala","Honduras","Hungary","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Japan","Jordan","Kenya","Mexico","Morocco","Netherlands","New Zealand","Nicaragua","Nigeria","Norway","Pakistan","Panama","Paraguay","Peru","Philippines","Poland","Portugal","Romania","Russia","Saudi Arabia","Sweden","Switzerland","Turkey","Ukraine","United Kingdom","Uruguay","Venezuela","Vietnam"];
const SERVICIOS=["Ninera","Cuidador/a de ancianos","Cuidador/a de discapacitados","Limpieza del hogar","Limpieza comercial","Plomero/a","Gasista","Electricista","Pintor/a","Carpintero/a","Albanil","Peon de albanileria","Herrero/a","Soldador/a","Mecanico/a","Jardinero/a","Cortador/a de cesped","Fumigador/a","Cocinero/a","Repostero/a","Mozo/a","Barman","Reponedor/a","Chofer particular","Remisero/a","Camionero/a","Delivery","Portero/a","Mucama","Sereno/a","Guardia de seguridad","Custodia personal","Costurero/a","Sastre","Zapatero/a","Peluquero/a","Esteticista","Cuidado de animales","Paseador/a de perros","Tractorista","Peon rural","Alambrador","Domador","Tropero","Esquilador","Mandados","Mudanzas","Planchado","Otro"];
const PROFESIONES=["Medico/a","Enfermero/a","Farmaceutico/a","Odontologo/a","Nutricionista","Fisioterapeuta","Psicologo/a","Abogado/a","Escribano/a","Juez/a","Contador/a","Economista","Administrador/a","Auditor/a","Actuario/a","Ingeniero/a Civil","Ingeniero/a Electrico","Ingeniero/a Industrial","Ingeniero/a en Sistemas","Arquitecto/a","Programador/a","Desarrollador/a Web","Disenador/a Grafico","UX Designer","Data Analyst","DevOps","Docente primaria","Docente secundaria","Profesor/a universitario","Educador/a especial","Periodista","Comunicador/a","Marketing Digital","Relacionista Publico","Veterinario/a","Agronomo/a","Biologo/a","Quimico/a","Geologo/a","Asistente Social","Sociologo/a","Artista plastico","Musico/a","Fotografo/a","Trader","Asesor/a financiero","Otro"];
function Field({label,value,onChange,placeholder,multi,keyboard,optional}){return(<View style={ss.fw}><View style={ss.flRow}><Text style={ss.fl}>{label}</Text>{optional&&<Text style={ss.opt}>Opcional</Text>}</View><TextInput style={[ss.fi,multi&&{height:90,textAlignVertical:"top"}]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={C.texto3} multiline={multi} keyboardType={keyboard||"default"}/></View>);}
function SearchField({label,value,onChange,placeholder,suggestions,onSelect}){
const[show,setShow]=useState(false);
const filtered=suggestions.filter(s=>s.toLowerCase().includes(value.toLowerCase())&&value.length>0);
return(<View style={ss.fw}><Text style={ss.fl}>{label}</Text><TextInput style={ss.fi} value={value} onChangeText={t=>{onChange(t);setShow(true);}} placeholder={placeholder} placeholderTextColor={C.texto3} onFocus={()=>setShow(true)}/>{show&&filtered.length>0&&(<View style={ss.sugg}>{filtered.slice(0,6).map(s=>(<TouchableOpacity key={s} style={ss.suggI} onPress={()=>{onSelect(s);setShow(false);}}><Text style={ss.suggT}>{s}</Text></TouchableOpacity>))}</View>)}</View>);}
function Chips({label,opts,sel,onToggle}){return(<View style={ss.fw}><Text style={ss.fl}>{label}</Text><View style={ss.cw}>{opts.map(o=>{const s=sel.includes(o);return(<TouchableOpacity key={o} style={[ss.chip,s&&ss.chipA]} onPress={()=>onToggle(o)}><Text style={[ss.ct,s&&ss.ctA]}>{o}</Text></TouchableOpacity>);})}</View></View>);}
function Single({label,opts,sel,onSel,optional}){return(<View style={ss.fw}><View style={ss.flRow}><Text style={ss.fl}>{label}</Text>{optional&&<Text style={ss.opt}>Opcional</Text>}</View><View style={ss.cw}>{opts.map(o=>(<TouchableOpacity key={o} style={[ss.chip,sel===o&&ss.chipA]} onPress={()=>onSel(sel===o?"":o)}><Text style={[ss.ct,sel===o&&ss.ctA]}>{o}</Text></TouchableOpacity>))}</View></View>);}
export default function EditarPerfilScreen({navigation}){
const[tab,setTab]=useState("servicios");
const[nombre,setNombre]=useState("Ale");
const[apellido,setApellido]=useState("De San Luis");
const[fechaNac,setFechaNac]=useState("");
const[sexo,setSexo]=useState("");
const[estadoCivil,setEstadoCivil]=useState("");
const[nacionalidad,setNacionalidad]=useState("");
const[bio,setBio]=useState("");
const[telefono,setTelefono]=useState("");
const[pais,setPais]=useState("");
const[ciudad,setCiudad]=useState("");
const[servicios,setServicios]=useState([]);
const[profesiones,setProfesiones]=useState([]);
const[disp,setDisp]=useState("Inmediata");
const[tipos,setTipos]=useState([]);
const[langs,setLangs]=useState(["Espanol"]);
const[refs,setRefs]=useState(false);
const[vis,setVis]=useState(false);
const[saving,setSaving]=useState(false);
function toggleArr(arr,setArr,v){setArr(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);}
function guardar(){
const n=nombre.trim();
if(n.length<1){Alert.alert("Error","El nombre es obligatorio");return;}
setSaving(true);
setTimeout(()=>{setSaving(false);Alert.alert("Perfil actualizado","Tus cambios fueron guardados.",[{text:"OK",onPress:()=>navigation.goBack()}]);},1000);}
return(
<SafeAreaView style={ss.c} edges={["top"]}>
<View style={ss.hdr}><TouchableOpacity onPress={()=>navigation.goBack()}><Text style={ss.back}>Volver</Text></TouchableOpacity><Text style={ss.htit}>Editar perfil</Text><View style={{width:50}}/></View>
<ScrollView contentContainerStyle={{paddingBottom:48}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
<View style={ss.avSec}><View style={ss.av}><Text style={{fontSize:40}}>🧙</Text></View><TouchableOpacity style={ss.photoBtn} onPress={()=>Alert.alert("Proximamente")}><Text style={ss.photoTxt}>Cambiar foto</Text></TouchableOpacity></View>
<View style={ss.sec}><Text style={ss.stit}>DATOS PERSONALES</Text>
<View style={ss.privaNota}><Text style={ss.privaNotaTxt}>Estos datos son privados. Solo se revelan al empleador cuando ambos deciden contactarse.</Text></View>
<Field label="Nombre" value={nombre} onChange={setNombre} placeholder="Tu nombre de pila"/>
<Field label="Apellido" value={apellido} onChange={setApellido} placeholder="Tu apellido"/>
<Field label="Fecha de nacimiento" value={fechaNac} onChange={setFechaNac} placeholder="DD/MM/AAAA"/>
<Single label="Sexo" opts={SEXOS} sel={sexo} onSel={setSexo}/>
<Single label="Estado civil" opts={ESTADOS} sel={estadoCivil} onSel={setEstadoCivil} optional/>
<Field label="Nacionalidad" value={nacionalidad} onChange={setNacionalidad} placeholder="Ej: Uruguayo/a"/>
<Field label="Telefono" value={telefono} onChange={setTelefono} placeholder="Ej: 099 123 456" keyboard="phone-pad"/>
<Field label="Descripcion personal" value={bio} onChange={setBio} placeholder="Contanos sobre vos, tu experiencia y lo que ofreces..." multi/></View>
<View style={ss.sec}><Text style={ss.stit}>UBICACION</Text>
<SearchField label="Pais" value={pais} onChange={setPais} placeholder="Escribi tu pais..." suggestions={PAISES} onSelect={v=>{setPais(v);setCiudad("");}}/>
<Field label="Ciudad" value={ciudad} onChange={setCiudad} placeholder="Ej: Montevideo"/>
<View style={ss.ubicNota}><Text style={ss.ubicNotaTxt}>Al activar tu perfil podras precisar tu barrio exacto para aparecer en busquedas cercanas.</Text></View>
</View>
<View style={ss.sec}><Text style={ss.stit}>SERVICIOS Y PROFESIONES</Text>
<View style={ss.tabRow}>
<TouchableOpacity style={[ss.tabBtn,tab==="servicios"&&ss.tabBtnA]} onPress={()=>setTab("servicios")}><Text style={[ss.tabTxt,tab==="servicios"&&ss.tabTxtA]}>Servicios</Text></TouchableOpacity>
<TouchableOpacity style={[ss.tabBtn,tab==="profesiones"&&ss.tabBtnA]} onPress={()=>setTab("profesiones")}><Text style={[ss.tabTxt,tab==="profesiones"&&ss.tabTxtA]}>Profesiones</Text></TouchableOpacity>
</View>
{tab==="servicios"&&<Chips label="Selecciona los servicios que ofreces" opts={SERVICIOS} sel={servicios} onToggle={v=>toggleArr(servicios,setServicios,v)}/>}
{tab==="profesiones"&&<Chips label="Selecciona tus profesiones" opts={PROFESIONES} sel={profesiones} onToggle={v=>toggleArr(profesiones,setProfesiones,v)}/>}
<View style={ss.avisoBox}><Text style={ss.avisoTxt}>Deberas presentar documentacion que certifique los titulos, oficios e idiomas declarados si el empleador lo requiere.</Text></View>
</View>
<View style={ss.sec}><Text style={ss.stit}>DISPONIBILIDAD</Text>
<Single label="Disponibilidad" opts={DISPS} sel={disp} onSel={setDisp}/>
<Chips label="Tipo de empleo que buscas" opts={TIPOS} sel={tipos} onToggle={v=>toggleArr(tipos,setTipos,v)}/></View>
<View style={ss.sec}><Text style={ss.stit}>IDIOMAS</Text>
<Chips label="Idiomas que hablas" opts={LANGS} sel={langs} onToggle={v=>toggleArr(langs,setLangs,v)}/></View>
<View style={ss.sec}><Text style={ss.stit}>EXTRAS</Text>
<View style={ss.swRow}><View style={{flex:1}}><Text style={ss.swLbl}>Tengo referencias laborales</Text><Text style={ss.swSub}>Podes presentar referencias de empleos anteriores</Text></View>
<Switch value={refs} onValueChange={setRefs} trackColor={{false:C.borde,true:C.coral}} thumbColor={C.blanco}/></View></View>
<View style={ss.sec}><Text style={ss.stit}>VISIBILIDAD</Text>
<View style={ss.swRow}><View style={{flex:1}}><Text style={ss.swLbl}>Perfil siempre visible</Text><Text style={ss.swSub}>El empleador puede ver tu perfil sin tus datos personales, hasta que vos manifestes interes en el empleo.</Text></View>
<Switch value={vis} onValueChange={setVis} trackColor={{false:C.borde,true:C.coral}} thumbColor={C.blanco}/></View></View>
<TouchableOpacity style={ss.btnW} onPress={guardar} disabled={saving}>
<LinearGradient colors={["#E8785A","#D4614A"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
<Text style={ss.btnT}>{saving?"Guardando...":"Guardar cambios"}</Text>
</LinearGradient></TouchableOpacity>
</ScrollView>
</SafeAreaView>);}
const ss=StyleSheet.create({
c:{flex:1,backgroundColor:"#FBF8F4"},
hdr:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingVertical:14,backgroundColor:"#FFFFFF",borderBottomWidth:1,borderBottomColor:"#EDE8E2"},
back:{fontSize:14,fontWeight:"700",color:"#5E70A8"},htit:{fontSize:16,fontWeight:"800",color:"#1A1020"},
avSec:{alignItems:"center",paddingVertical:24,backgroundColor:"#FFFFFF",marginBottom:16},
av:{width:88,height:88,borderRadius:44,backgroundColor:"#E8785A",alignItems:"center",justifyContent:"center",marginBottom:10},
photoBtn:{paddingHorizontal:16,paddingVertical:6,backgroundColor:"#EEF0FF",borderRadius:20},photoTxt:{fontSize:13,fontWeight:"700",color:"#5E70A8"},
sec:{marginHorizontal:16,marginBottom:16},stit:{fontSize:10,fontWeight:"700",color:"#A898B8",letterSpacing:1,marginBottom:10},
privaNota:{backgroundColor:"#EEF0FF",borderRadius:8,padding:10,marginBottom:12,borderLeftWidth:3,borderLeftColor:"#5E70A8"},
privaNotaTxt:{fontSize:12,color:"#5E70A8",lineHeight:18},
fw:{marginBottom:14},flRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:6},
fl:{fontSize:12,fontWeight:"700",color:"#5A4E6A"},opt:{fontSize:10,color:"#A898B8",fontStyle:"italic"},
fi:{backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:14,color:"#1A1020"},
sugg:{backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#EDE8E2",borderRadius:10,marginTop:4,overflow:"hidden"},
suggI:{paddingHorizontal:14,paddingVertical:12,borderBottomWidth:1,borderBottomColor:"#EDE8E2"},
suggT:{fontSize:14,color:"#1A1020"},
ubicNota:{backgroundColor:"#E6FBF5",borderRadius:8,padding:10,marginTop:4,borderLeftWidth:3,borderLeftColor:"#3DA882"},
ubicNotaTxt:{fontSize:12,color:"#2E9472",lineHeight:18},
cw:{flexDirection:"row",flexWrap:"wrap",gap:8},
chip:{paddingHorizontal:12,paddingVertical:6,backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:20},
chipA:{backgroundColor:"#5E70A8",borderColor:"#5E70A8"},ct:{fontSize:12,fontWeight:"600",color:"#5A4E6A"},ctA:{color:"#FFFFFF"},
tabRow:{flexDirection:"row",gap:8,marginBottom:14},
tabBtn:{flex:1,paddingVertical:10,borderRadius:10,backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#EDE8E2",alignItems:"center"},
tabBtnA:{backgroundColor:"#5E70A8",borderColor:"#5E70A8"},
tabTxt:{fontSize:13,fontWeight:"700",color:"#5A4E6A"},tabTxtA:{color:"#FFFFFF"},
avisoBox:{backgroundColor:"#E6FBF5",borderRadius:10,padding:12,marginTop:8,borderLeftWidth:3,borderLeftColor:"#3DA882"},
avisoTxt:{fontSize:12,color:"#2E9472",lineHeight:18},
swRow:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFFFFF",borderRadius:12,padding:14,borderWidth:1,borderColor:"#EDE8E2",gap:12,marginBottom:10},
swLbl:{fontSize:14,fontWeight:"600",color:"#1A1020",marginBottom:3},swSub:{fontSize:12,color:"#A898B8",lineHeight:17},
btnW:{marginHorizontal:16,marginTop:8,borderRadius:14,overflow:"hidden"},
btn:{paddingVertical:16,alignItems:"center"},btnT:{color:"#FFFFFF",fontSize:16,fontWeight:"800"},
});
