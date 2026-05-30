import React,{useState,useEffect} from "react";
import{View,Text,StyleSheet,TouchableOpacity,TextInput,ScrollView,Alert,ActivityIndicator}from "react-native";
import{KeyboardAwareScrollView}from "react-native-keyboard-aware-scroll-view";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import{supabase}from "../../services/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const RUBROS=["Tecnologia","Salud","Educacion","Construccion","Gastronomia","Comercio","Transporte","Seguridad","Limpieza","Manufactura","Agro","Finanzas","Legal","Marketing","Otro"];

export default function RegisterEmpresaScreen({navigation}){
  const[nombreEmpresa,setNombreEmpresa]=useState("");
  const[rut,setRut]=useState("");
  const[rubro,setRubro]=useState("");
  const[pais,setPais]=useState("");
  const[ciudad,setCiudad]=useState("");
  const[direccion,setDireccion]=useState("");
  const[telefono,setTelefono]=useState("");
  const[email,setEmail]=useState("");
  const[pass,setPass]=useState("");
  const[ver,setVer]=useState(false);
  const[terminos,setTerminos]=useState(false);
  const[load,setLoad]=useState(false);

  useEffect(()=>{
    async function detectarPais(){
      try{
        const res=await fetch("https://ipapi.co/json/");
        const data=await res.json();
        if(data.country_name){
          const mapa={"Uruguay":"Uruguay","Argentina":"Argentina","Brazil":"Brasil","Chile":"Chile","Paraguay":"Paraguay","Bolivia":"Bolivia","Peru":"Peru","Colombia":"Colombia","Mexico":"Mexico","Ecuador":"Ecuador","Venezuela":"Venezuela"};
          const paisMapeado=mapa[data.country_name]||data.country_name;
          setPais(paisMapeado);
          if(data.city)setCiudad(data.city);
        }
      }catch(e){}
    }
    detectarPais();
  },[]);

  async function handleRegistrar(){
    if(nombreEmpresa.trim().length<2){Alert.alert("Error","Ingresa el nombre de la empresa");return;}
    if(rut.trim().length<8){Alert.alert("Error","El RUT debe tener al menos 8 caracteres");return;}
    if(!/^[0-9\-\.]+$/.test(rut.trim())){Alert.alert("Error","El RUT solo puede contener numeros, guiones y puntos");return;}
    if(!rubro){Alert.alert("Error","Selecciona el rubro de la empresa");return;}
    if(!pais){Alert.alert("Error","El pais es obligatorio");return;}
    if(!ciudad){Alert.alert("Error","La ciudad es obligatoria");return;}
    if(!direccion){Alert.alert("Error","La direccion es obligatoria");return;}
    if(!telefono){Alert.alert("Error","El telefono es obligatorio");return;}
    if(!email.includes("@")){Alert.alert("Error","Email no valido");return;}
    if(pass.length<8){Alert.alert("Error","La contrasena debe tener al menos 8 caracteres");return;}
    if(!terminos){Alert.alert("Error","Debes aceptar los terminos y condiciones");return;}
    setLoad(true);
    try{
      const{data,error:errAuth}=await supabase.auth.signUp({email,password:pass});
      if(errAuth)throw errAuth;
      if(data?.user){
        const{error:errPerfil}=await supabase.from("profiles").upsert({
          id:data.user.id,
          nombre:nombreEmpresa,
          rut,rubro,pais,ciudad,direccion,telefono,
          rol:"company",
          modo_activo:"company",
          es_empresa:true,
          updated_at:new Date().toISOString(),
        });
        if(errPerfil)throw errPerfil;
        await AsyncStorage.setItem("modo_"+data.user.id,"company");
        supabase.functions.invoke("mensaje-bienvenida",{body:{admin_secret:"nexu-admin-2026",user_id:data.user.id,rol:"company"}}).catch(()=>{});
      }
      Alert.alert("Empresa registrada","Tu cuenta empresarial fue creada correctamente.",[{text:"Iniciar sesion",onPress:()=>navigation.navigate("Login")}]);
    }catch(e){
      Alert.alert("Error",e.message||"Intentalo de nuevo");
    }finally{setLoad(false);}
  }

  return(
    <SafeAreaView style={ss.c} edges={["top"]}>
      <KeyboardAwareScrollView contentContainerStyle={ss.scroll} keyboardShouldPersistTaps="handled" enableOnAndroid={true} enableAutomaticScroll={true} extraScrollHeight={180} keyboardOpeningTime={0}>
        <View style={ss.hdr}>
          <TouchableOpacity onPress={()=>navigation.goBack()}><Text style={ss.back}>Volver</Text></TouchableOpacity>
          <Text style={ss.tit}>Registrar empresa</Text>
          <View style={ss.badge}><Text style={ss.badgeTxt}>🏢 Empresa</Text></View>
        </View>

        <View style={ss.sec}>
          <Text style={ss.stit}>DATOS DE LA EMPRESA</Text>
          <View style={ss.iw}>
            <Text style={ss.lbl}>Nombre de la empresa</Text>
            <View style={ss.ib}><TextInput style={ss.input} placeholder="Ej: Mi Empresa S.A." placeholderTextColor="#D0C8DC" value={nombreEmpresa} onChangeText={setNombreEmpresa} autoCapitalize="words" autoCorrect={false}/></View>
          </View>
          <View style={ss.iw}>
            <Text style={ss.lbl}>RUT / Identificacion fiscal</Text>
            <View style={ss.ib}><TextInput style={ss.input} placeholder="Ej: 21234567-8" placeholderTextColor="#D0C8DC" value={rut} onChangeText={setRut} autoCapitalize="none" keyboardType="numbers-and-punctuation"/></View>
          </View>
          <View style={ss.iw}>
            <Text style={ss.lbl}>Rubro</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:4}}>
              <View style={{flexDirection:"row",gap:8,paddingBottom:4}}>
                {RUBROS.map(r=>(<TouchableOpacity key={r} style={[ss.chip,rubro===r&&ss.chipA]} onPress={()=>setRubro(rubro===r?"":r)}><Text style={[ss.ct,rubro===r&&ss.ctA]}>{r}</Text></TouchableOpacity>))}
              </View>
            </ScrollView>
          </View>
        </View>

        <View style={ss.sec}>
          <Text style={ss.stit}>UBICACION</Text>
          <View style={ss.iw}>
            <Text style={ss.lbl}>Pais</Text>
            <View style={ss.ib}><TextInput style={ss.input} placeholder="Ej: Uruguay" placeholderTextColor="#D0C8DC" value={pais} onChangeText={setPais} autoCapitalize="words"/></View>
          </View>
          <View style={ss.iw}>
            <Text style={ss.lbl}>Ciudad</Text>
            <View style={ss.ib}><TextInput style={ss.input} placeholder="Ej: Montevideo" placeholderTextColor="#D0C8DC" value={ciudad} onChangeText={setCiudad} autoCapitalize="words"/></View>
          </View>
          <View style={ss.iw}>
            <Text style={ss.lbl}>Direccion</Text>
            <View style={ss.ib}><TextInput style={ss.input} placeholder="Ej: Av. Italia 1234" placeholderTextColor="#D0C8DC" value={direccion} onChangeText={setDireccion} autoCapitalize="words"/></View>
          </View>
        </View>

        <View style={ss.sec}>
          <Text style={ss.stit}>CONTACTO</Text>
          <View style={ss.iw}>
            <Text style={ss.lbl}>Telefono</Text>
            <View style={ss.ib}><TextInput style={ss.input} placeholder="Ej: 099 123 456" placeholderTextColor="#D0C8DC" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad"/></View>
          </View>
        </View>

        <View style={ss.sec}>
          <Text style={ss.stit}>ACCESO</Text>
          <View style={ss.iw}>
            <Text style={ss.lbl}>Email corporativo</Text>
            <View style={ss.ib}><TextInput style={ss.input} placeholder="empresa@email.com" placeholderTextColor="#D0C8DC" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/></View>
          </View>
          <View style={ss.iw}>
            <Text style={ss.lbl}>Contrasena</Text>
            <View style={ss.ib}>
              <TextInput style={ss.input} placeholder="Minimo 8 caracteres" placeholderTextColor="#D0C8DC" value={pass} onChangeText={setPass} secureTextEntry={!ver} autoCapitalize="none"/>
              <TouchableOpacity onPress={()=>setVer(!ver)}><Text style={{fontSize:16}}>{ver?"🙈":"👁️"}</Text></TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity style={ss.termRow} onPress={()=>setTerminos(!terminos)}>
          <View style={[ss.check,terminos&&ss.checkA]}>{terminos&&<Text style={{color:"#FFF",fontSize:12,fontWeight:"800"}}>✓</Text>}</View>
          <Text style={ss.termTxt}>Acepto los <Text style={ss.termLink}>Terminos y Condiciones</Text> y la <Text style={ss.termLink}>Politica de Privacidad</Text></Text>
        </TouchableOpacity>

        <View style={ss.aviso}><Text style={ss.avisoTxt}>Tu empresa aparecera verificada en Nexu. Los trabajadores podran ver el nombre de tu empresa al postularse.</Text></View>

        <TouchableOpacity style={ss.btnW} onPress={handleRegistrar} disabled={load}>
          <LinearGradient colors={["#3DA882","#2E9472"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            {load?<ActivityIndicator color="#FFF" size="small"/>:<Text style={ss.btnTxt}>Registrar empresa</Text>}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={ss.link} onPress={()=>navigation.navigate("Login")}>
          <Text style={ss.linkTxt}>Ya tenes cuenta? <Text style={ss.linkBold}>Inicia sesion</Text></Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:"#FBF8F4"},scroll:{paddingHorizontal:24,paddingBottom:40},
  hdr:{paddingTop:16,paddingBottom:24},back:{fontSize:14,fontWeight:"700",color:"#3DA882",marginBottom:20},
  tit:{fontSize:28,fontWeight:"900",color:"#1A1020",letterSpacing:-0.5,marginBottom:10},
  badge:{alignSelf:"flex-start",backgroundColor:"#E6FBF5",paddingHorizontal:12,paddingVertical:5,borderRadius:20},
  badgeTxt:{fontSize:13,fontWeight:"700",color:"#3DA882"},
  sec:{marginBottom:8},
  stit:{fontSize:10,fontWeight:"700",color:"#A898B8",letterSpacing:1,marginBottom:10},
  iw:{marginBottom:12},lbl:{fontSize:12,fontWeight:"700",color:"#5A4E6A",marginBottom:6},
  ib:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:12,paddingHorizontal:14,height:52,gap:10},
  input:{flex:1,fontSize:14,color:"#1A1020"},
  chip:{paddingHorizontal:12,paddingVertical:6,backgroundColor:"#FFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:20},
  chipA:{backgroundColor:"#3DA882",borderColor:"#3DA882"},
  ct:{fontSize:12,fontWeight:"600",color:"#5A4E6A"},ctA:{color:"#FFF"},
  termRow:{flexDirection:"row",alignItems:"flex-start",gap:12,marginBottom:12},
  check:{width:22,height:22,borderRadius:6,borderWidth:2,borderColor:"#EDE8E2",alignItems:"center",justifyContent:"center",marginTop:1,flexShrink:0},
  checkA:{backgroundColor:"#3DA882",borderColor:"#3DA882"},
  termTxt:{fontSize:13,color:"#5A4E6A",flex:1,lineHeight:20},
  termLink:{color:"#3DA882",fontWeight:"700"},
  aviso:{backgroundColor:"#E6FBF5",borderRadius:10,padding:12,marginBottom:20,borderLeftWidth:3,borderLeftColor:"#3DA882"},
  avisoTxt:{fontSize:12,color:"#2E9472",lineHeight:18},
  btnW:{borderRadius:14,overflow:"hidden",marginBottom:16},btn:{paddingVertical:16,alignItems:"center"},btnTxt:{color:"#FFF",fontSize:16,fontWeight:"800"},
  link:{alignItems:"center"},linkTxt:{fontSize:14,color:"#A898B8"},linkBold:{fontWeight:"700",color:"#3DA882"},
});
