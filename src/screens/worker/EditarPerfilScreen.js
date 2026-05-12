import React,{useState,useEffect,useRef} from "react";
import{View,Text,StyleSheet,TouchableOpacity,TextInput,ScrollView,Alert,Switch,Image}from "react-native";
import*as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import{supabase}from "../../services/supabase";
const VISION_KEY="AIzaSyDIrHU7wnjh2aGQwRPaDF4mMr33acuoCxk";
const BARRIOS_POR_CIUDAD={"Montevideo":["Ciudad Vieja","Centro","Cordon","Palermo","Pocitos","Buceo","Malvin","Punta Carretas","Parque Rodo","Tres Cruces","Aguada","Goes","La Blanqueada","Union","Colon","Sayago","Paso de la Arena","Carrasco","Prado","Bella Vista","Cerro","La Teja","Nuevo Paris","Penarol","Piedras Blancas","Manga","Casabo","Lezica","Maronas"],"Buenos Aires":["Palermo","Recoleta","San Telmo","La Boca","Belgrano","Caballito","Villa Crespo","Almagro","Boedo","Flores","Floresta","Villa del Parque","Coghlan","Saavedra","Nunez","Colegiales","Chacarita","Paternal","Villa Urquiza","Devoto","Monte Castro","Mataderos","Liniers","Lugano","Soldati","Pompeya","Barracas","Constitucion","Monserrat","San Nicolas","Retiro","Puerto Madero"],"Santiago":["Las Condes","Providencia","Vitacura","Lo Barnechea","La Reina","Nunoa","Santiago Centro","Independencia","Recoleta","Conchalí","Huechuraba","Quilicura","Pudahuel","Cerro Navia","Lo Prado","Quinta Normal","Estacion Central","Maipu","Cerrillos","San Miguel","La Cisterna","La Florida","Penalolen","Macul"],"Lima":["Miraflores","San Isidro","Barranco","Surco","La Molina","San Borja","Pueblo Libre","Jesus Maria","Lince","Magdalena","San Miguel","Callao","Rimac","La Victoria","Ate","Santa Anita","San Juan de Lurigancho","Comas","Los Olivos","San Martin de Porres"],"Bogota":["Chapinero","Usaquen","Suba","Engativa","Fontibon","Kennedy","Bosa","Ciudad Bolivar","San Cristobal","Usme","Tunjuelito","Teusaquillo","Barrios Unidos","Santa Fe"],"Ciudad de Mexico":["Condesa","Roma","Polanco","Coyoacan","San Angel","Tlalpan","Iztapalapa","Gustavo A Madero","Azcapotzalco","Miguel Hidalgo","Cuauhtemoc","Benito Juarez","Alvaro Obregon","Iztacalco","Venustiano Carranza"],"Sao Paulo":["Jardins","Moema","Vila Madalena","Pinheiros","Itaim Bibi","Morumbi","Lapa","Barra Funda","Consolacao","Liberdade","Bela Vista","Republica","Santa Cecilia","Higienopolis","Perdizes","Butanta"]};
const CIUDADES_POR_PAIS={"Uruguay":["Montevideo","Salto","Paysandu","Las Piedras","Rivera","Maldonado","Tacuarembo","Melo","Mercedes","Artigas","Minas","San Jose","Durazno","Florida","Rocha","Colonia"],"Argentina":["Buenos Aires","Cordoba","Rosario","Mendoza","Tucuman","La Plata","Mar del Plata","Salta","Santa Fe","San Juan","Neuquen","Corrientes","Posadas","Bahia Blanca"],"Brasil":["Sao Paulo","Rio de Janeiro","Brasilia","Salvador","Fortaleza","Belo Horizonte","Manaus","Curitiba","Recife","Porto Alegre"],"Chile":["Santiago","Valparaiso","Concepcion","La Serena","Antofagasta","Temuco","Rancagua","Talca","Arica","Iquique"],"Paraguay":["Asuncion","Ciudad del Este","San Lorenzo","Luque","Encarnacion"],"Colombia":["Bogota","Medellin","Cali","Barranquilla","Cartagena"],"Mexico":["Ciudad de Mexico","Guadalajara","Monterrey","Puebla","Toluca"],"Peru":["Lima","Arequipa","Trujillo","Chiclayo","Piura"],"Bolivia":["La Paz","Santa Cruz","Cochabamba","Sucre","Oruro"],"Ecuador":["Guayaquil","Quito","Cuenca","Santo Domingo"]};
const PAISES=["Uruguay","Argentina","Brasil","Chile","Paraguay","Bolivia","Peru","Colombia","Mexico","Ecuador","Venezuela","Spain","United States","France","Germany","Italy","Portugal","Otro"];
const SEXOS=["Masculino","Femenino","Otro"];
const ESTADOS=["Soltero/a","Casado/a","Divorciado/a","Viudo/a","En pareja"];
const DISPS=["Inmediata","En 1 semana","En 2 semanas","A convenir"];
const TIPOS=["Permanente","Temporal","Por tarea","Medio horario"];
const LANGS=["Espanol","Portugues","Ingles","Frances","Italiano","Aleman","Otro"];
const SERVICIOS=["Ninera","Cuidador/a de ancianos","Cuidador/a de discapacitados","Limpieza del hogar","Limpieza comercial","Plomero/a","Gasista","Electricista","Pintor/a","Carpintero/a","Albanil","Peon de albanileria","Herrero/a","Soldador/a","Mecanico/a","Jardinero/a","Cortador/a de cesped","Fumigador/a","Cocinero/a","Repostero/a","Mozo/a","Barman","Reponedor/a","Chofer particular","Remisero/a","Camionero/a","Delivery","Portero/a","Mucama","Sereno/a","Guardia de seguridad","Custodia personal","Costurero/a","Sastre","Zapatero/a","Peluquero/a","Esteticista","Cuidado de animales","Paseador/a de perros","Tractorista","Peon rural","Alambrador","Domador","Tropero","Esquilador","Mandados","Mudanzas","Planchado","Otro"];
const PROFESIONES_BASE=["Medico/a","Enfermero/a","Farmaceutico/a","Odontologo/a","Nutricionista","Fisioterapeuta","Psicologo/a","Abogado/a","Escribano/a","Contador/a","Economista","Administrador/a","Auditor/a","Ingeniero/a","Arquitecto/a","Disenador/a","Programador/a","Desarrollador/a Web","Data Analyst","DevOps","Docente primaria","Docente secundaria","Profesor/a universitario","Educador/a especial","Periodista","Comunicador/a","Marketing Digital","Relacionista Publico","Veterinario/a","Agronomo/a","Biologo/a","Quimico/a","Geologo/a","Asistente Social","Sociologo/a","Artista plastico","Musico/a","Fotografo/a","Arbitro deportivo","Asesor/a financiero","Otro"];
const SUBCATS={"Medico/a":["Medicina General","Pediatria","Cardiologia","Neurologia","Cirugia","Ginecologia","Traumatologia","Dermatologia","Psiquiatria","Oncologia","Medicina Familiar","Otra especialidad"],"Abogado/a":["Derecho Penal","Derecho de Familia","Derecho Civil","Derecho Laboral","Derecho Comercial","Derecho Administrativo","Derecho Internacional","Mediacion y Arbitraje","Propiedad Intelectual","Otra especialidad"],"Psicologo/a":["Psicologia Clinica","Psicologia Infantil","Psicologia Organizacional","Psicologia Forense","Neuropsicologia","Psicoterapia","Otra especialidad"],"Ingeniero/a":["Ingenieria Civil","Ingenieria Electrica","Ingenieria Industrial","Ingenieria en Sistemas","Ingenieria Quimica","Ingenieria Agronomica","Ingenieria Mecanica","Ingenieria Ambiental","Otra ingenieria"],"Disenador/a":["Diseno Grafico","Diseno UX/UI","Diseno Industrial","Diseno de Moda","Diseno de Interiores","Diseno Web","Diseno Editorial","Otro diseno"],"Arquitecto/a":["Arquitectura Residencial","Arquitectura Comercial","Urbanismo","Paisajismo","Arquitectura Sustentable","Otra especialidad"],"Contador/a":["Contabilidad General","Auditoria","Impuestos y Tributos","Finanzas Corporativas","Asesoria Contable","Otra especialidad"],"Enfermero/a":["Enfermeria General","Enfermeria Pediatrica","Cuidados Intensivos","Enfermeria Geriatrica","Otra especialidad"],"Odontologo/a":["Odontologia General","Ortodoncia","Endodoncia","Cirugia Maxilofacial","Odontopediatria","Otra especialidad"],"Veterinario/a":["Animales de Compania","Animales de Granja","Cirugia Veterinaria","Nutricion Animal","Otra especialidad"],"Musico/a":["Musica Clasica","Jazz","Rock/Pop","Produccion Musical","Composicion","Canto","Otra especialidad"],"Periodista":["Periodismo Grafico","Periodismo Digital","Periodismo Televisivo","Periodismo Radial","Otra especialidad"],"Agronomo/a":["Produccion Vegetal","Produccion Animal","Agronegocios","Agricultura Organica","Otra especialidad"],"Fisioterapeuta":["Rehabilitacion Motora","Fisioterapia Deportiva","Fisioterapia Neurologica","Fisioterapia Pediatrica","Otra especialidad"]};
const PROF_CON_SUB=Object.keys(SUBCATS);
function Field({label,value,onChange,placeholder,multi,keyboard,optional}){
  return(
    <View style={ss.fw}>
      <View style={ss.flRow}>
        <Text style={ss.fl}>{label}</Text>
        {optional&&<Text style={ss.opt}>Opcional</Text>}
      </View>
      <TextInput style={[ss.fi,multi&&{height:90,textAlignVertical:"top"}]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#A898B8" multiline={multi} keyboardType={keyboard||"default"}/>
    </View>
  );
}
function SearchField({label,value,onChange,placeholder,suggestions,onSelect}){
  const[show,setShow]=useState(false);
  const filtered=suggestions.filter(s=>s.toLowerCase().includes(value.toLowerCase())&&value.length>0);
  return(
    <View style={ss.fw}>
      <Text style={ss.fl}>{label}</Text>
      <TextInput style={ss.fi} value={value} onChangeText={t=>{onChange(t);setShow(true);}} placeholder={placeholder} placeholderTextColor="#A898B8" onFocus={()=>setShow(true)}/>
      {show&&filtered.length>0&&(
        <View style={ss.sugg}>
          {filtered.slice(0,6).map(s=>(
            <TouchableOpacity key={s} style={ss.suggI} onPress={()=>{onSelect(s);setShow(false);}}>
              <Text style={ss.suggT}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
function Chips({label,opts,sel,onToggle}){
  return(
    <View style={ss.fw}>
      <Text style={ss.fl}>{label}</Text>
      <View style={ss.cw}>
        {opts.map(o=>{const s=sel.includes(o);return(<TouchableOpacity key={o} style={[ss.chip,s&&ss.chipA]} onPress={()=>onToggle(o)}><Text style={[ss.ct,s&&ss.ctA]}>{o}</Text></TouchableOpacity>);})}
      </View>
    </View>
  );
}
function Single({label,opts,sel,onSel,optional}){
  return(
    <View style={ss.fw}>
      <View style={ss.flRow}>
        <Text style={ss.fl}>{label}</Text>
        {optional&&<Text style={ss.opt}>Opcional</Text>}
      </View>
      <View style={ss.cw}>
        {opts.map(o=>(<TouchableOpacity key={o} style={[ss.chip,sel===o&&ss.chipA]} onPress={()=>onSel(sel===o?"":o)}><Text style={[ss.ct,sel===o&&ss.ctA]}>{o}</Text></TouchableOpacity>))}
      </View>
    </View>
  );
}
function FechaNac({value,onChange}){
  const mesRef=useRef(null);
  const anioRef=useRef(null);
  const[dia,setDia]=useState("");
  const[mes,setMes]=useState("");
  const[anio,setAnio]=useState("");
  useEffect(()=>{if(value){const p=value.split("/");setDia(p[0]||"");setMes(p[1]||"");setAnio(p[2]||"");}},[value]);
  function upd(d,m,a){onChange(d+"/"+m+"/"+a);}
  return(
    <View style={ss.fw}>
      <Text style={ss.fl}>Fecha de nacimiento</Text>
      <View style={{flexDirection:"row",gap:8}}>
        <View style={{flex:1}}><Text style={ss.opt}>Dia</Text><TextInput style={ss.fi} value={dia} onChangeText={v=>{setDia(v);upd(v,mes,anio);if(v.length===2)mesRef.current?.focus();}} placeholder="DD" placeholderTextColor="#A898B8" keyboardType="numeric" maxLength={2}/></View>
        <View style={{flex:1}}><Text style={ss.opt}>Mes</Text><TextInput ref={mesRef} style={ss.fi} value={mes} onChangeText={v=>{setMes(v);upd(dia,v,anio);if(v.length===2)anioRef.current?.focus();}} placeholder="MM" placeholderTextColor="#A898B8" keyboardType="numeric" maxLength={2}/></View>
        <View style={{flex:2}}><Text style={ss.opt}>Anno</Text><TextInput ref={anioRef} style={ss.fi} value={anio} onChangeText={v=>{setAnio(v);upd(dia,mes,v);}} placeholder="AAAA" placeholderTextColor="#A898B8" keyboardType="numeric" maxLength={4}/></View>
      </View>
    </View>
  );
}
export default function EditarPerfilScreen({navigation}){
  const[tab,setTab]=useState("servicios");
  const[nombre,setNombre]=useState("");
  const[nombre2,setNombre2]=useState("");
  const[apellido1,setApellido1]=useState("");
  const[apellido2,setApellido2]=useState("");
  const[fechaNac,setFechaNac]=useState("");
  const[sexo,setSexo]=useState("");
  const[estadoCivil,setEstadoCivil]=useState("");
  const[nacionalidad,setNacionalidad]=useState("");
  const[bio,setBio]=useState("");
  const[telefono,setTelefono]=useState("");
  const[pais,setPais]=useState("");
  const[ciudad,setCiudad]=useState("");
  const[barrio,setBarrio]=useState("");
  const[servicios,setServicios]=useState([]);
  const[profesiones,setProfesiones]=useState([]);
  const[subEsp,setSubEsp]=useState([]);
  const[profActiva,setProfActiva]=useState(null);
  const[disp,setDisp]=useState("Inmediata");
  const[tipos,setTipos]=useState([]);
  const[langs,setLangs]=useState(["Espanol"]);
  const[refs,setRefs]=useState(false);
  const[aniosExp,setAniosExp]=useState("");
  const[sueldoMin,setSueldoMin]=useState("");
  const[sueldoMax,setSueldoMax]=useState("");
  const[sueldoMoneda,setSueldoMoneda]=useState("USD");
  const[vis,setVis]=useState(false);
  const[saving,setSaving]=useState(false);
  const[avatar,setAvatar]=useState(null);
  const[avatarUploading,setAvatarUploading]=useState(false);

  useEffect(()=>{
    async function detectarPais(){
      try{
        if(!pais){
          const res=await fetch('https://ipapi.co/json/');
          const data=await res.json();
          if(data.country_name){
            const mapa={'Uruguay':'Uruguay','Argentina':'Argentina','Brazil':'Brasil','Chile':'Chile','Paraguay':'Paraguay','Bolivia':'Bolivia','Peru':'Peru','Colombia':'Colombia','Mexico':'Mexico','Ecuador':'Ecuador','Venezuela':'Venezuela'};
            const paisMapeado=mapa[data.country_name]||data.country_name;
            if(PAISES.includes(paisMapeado))setPais(paisMapeado);
          }
        }
      }catch(e){}
    }
    detectarPais();
  },[]);

  const ciudadesDisp=CIUDADES_POR_PAIS[pais]||[];
  const barriosDisp=BARRIOS_POR_CIUDAD[ciudad]||[];

  useEffect(()=>{
    async function cargarPerfil(){
      try{
        const{data:{user}}=await supabase.auth.getUser();
        if(!user)return;
        const{data,error}=await supabase.from("profiles").select("*").eq("id",user.id).single();
        if(error||!data)return;
        if(data.nombre)setNombre(data.nombre);
        if(data.nombre2)setNombre2(data.nombre2);
        if(data.apellido1)setApellido1(data.apellido1);
        if(data.apellido2)setApellido2(data.apellido2);
        if(data.fecha_nac)setFechaNac(data.fecha_nac);
        if(data.sexo)setSexo(data.sexo);
        if(data.estado_civil)setEstadoCivil(data.estado_civil);
        if(data.nacionalidad)setNacionalidad(data.nacionalidad);
        if(data.bio)setBio(data.bio);
        if(data.telefono)setTelefono(data.telefono);
        if(data.pais)setPais(data.pais);
        if(data.ciudad)setCiudad(data.ciudad);
        if(data.barrio)setBarrio(data.barrio);
        if(data.servicios)setServicios(data.servicios);
        if(data.profesiones)setProfesiones(data.profesiones);
        if(data.especialidades)setSubEsp(data.especialidades);
        if(data.disponibilidad)setDisp(data.disponibilidad);
        if(data.tipos_empleo)setTipos(data.tipos_empleo);
        if(data.idiomas)setLangs(data.idiomas);
        if(data.referencias!=null)setRefs(data.referencias);
        if(data.anios_experiencia)setAniosExp(String(data.anios_experiencia));
        if(data.sueldo_pretension_min)setSueldoMin(String(data.sueldo_pretension_min));
        if(data.sueldo_pretension_max)setSueldoMax(String(data.sueldo_pretension_max));
        if(data.sueldo_moneda)setSueldoMoneda(data.sueldo_moneda);
        if(data.perfil_visible!=null)setVis(data.perfil_visible);
        if(data.avatar_url)setAvatar(data.avatar_url);
      }catch(e){console.log(e);}
    }
    cargarPerfil();
  },[]);

  function toggleArr(arr,setArr,v){setArr(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);}

  function toggleProf(v){
    const tieneSubcat=PROF_CON_SUB.includes(v);
    if(tieneSubcat){
      if(profActiva===v){setProfActiva(null);setSubEsp([]);setProfesiones(p=>p.filter(x=>x!==v));}
      else{setProfActiva(v);setSubEsp([]);setProfesiones(p=>[...p.filter(x=>!PROF_CON_SUB.includes(x)),v]);}
    }else{
      setProfesiones(p=>p.includes(v)?p.filter(x=>x!==v):[...p.filter(x=>x!==profActiva),v]);
    }
  }

  async function cambiarFoto(){
    try{
      const perm=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!perm.granted){Alert.alert("Permiso necesario","Necesitamos acceso a tu galeria para subir una foto.");return;}
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,allowsEditing:true,aspect:[1,1],quality:0.7,base64:true});
      if(result.canceled)return;
      const asset=result.assets[0];
      setAvatarUploading(true);
      const visionRes=await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requests:[{image:{content:asset.base64},features:[{type:"SAFE_SEARCH_DETECTION"}]}]})});
      const visionData=await visionRes.json();
      const safe=visionData.responses?.[0]?.safeSearchAnnotation;
      const bloqueado=["LIKELY","VERY_LIKELY"];
      if(bloqueado.includes(safe?.adult)||bloqueado.includes(safe?.violence)||bloqueado.includes(safe?.racy)){
        Alert.alert("Foto no permitida","La imagen no cumple nuestras politicas. Por favor subi otra foto.");
        setAvatarUploading(false);
        return;
      }
      const{data:{user}}=await supabase.auth.getUser();
      const filePath=`${user.id}/avatar.jpg`;
      const byteArray=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));
      const{error:uploadError}=await supabase.storage.from("avatars").upload(filePath,byteArray,{contentType:"image/jpeg",upsert:true});
      if(uploadError)throw uploadError;
      const{data:urlData}=supabase.storage.from("avatars").getPublicUrl(filePath);
      const avatarUrl=urlData.publicUrl+"?t="+Date.now();
      await supabase.from("profiles").update({avatar_url:avatarUrl}).eq("id",user.id);
      setAvatar(avatarUrl);
      Alert.alert("Foto actualizada","Tu foto fue guardada correctamente.");
    }catch(e){
      Alert.alert("Error","No se pudo subir la foto. Intenta de nuevo.");
      console.log(e);
    }finally{setAvatarUploading(false);}
  }

  async function guardar(){
    if(nombre.trim().length<1){Alert.alert("Error","El nombre es obligatorio");return;}
    setSaving(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){navigation.navigate("Login");return;}
      const{error}=await supabase.from("profiles").upsert({id:user.id,nombre,nombre2,apellido1,apellido2,fecha_nac:fechaNac,sexo,estado_civil:estadoCivil,nacionalidad,bio,telefono,pais,ciudad,barrio,servicios,profesiones,especialidades:subEsp,disponibilidad:disp,tipos_empleo:tipos,idiomas:langs,referencias:refs,perfil_visible:vis,anios_experiencia:aniosExp?Number(aniosExp):null,sueldo_pretension_min:sueldoMin?Number(sueldoMin):null,sueldo_pretension_max:sueldoMax?Number(sueldoMax):null,sueldo_moneda:sueldoMoneda||"USD",updated_at:new Date().toISOString()});
      if(error)throw error;
      await AsyncStorage.setItem('activacion_pendiente','true');
      navigation.goBack();
    }catch(e){
      Alert.alert("Error",e.message||"No se pudo guardar");
    }finally{setSaving(false);}
  }
  return(
    <SafeAreaView style={ss.c} edges={["top"]}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={()=>navigation.goBack()}><Text style={ss.back}>Volver</Text></TouchableOpacity>
        <Text style={ss.htit}>Editar perfil</Text>
        <View style={{width:50}}/>
      </View>
      <ScrollView contentContainerStyle={{paddingBottom:48}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={ss.avSec}>
          <View style={ss.av}>
            {avatar?<Image source={{uri:avatar}} style={{width:88,height:88,borderRadius:44}}/>:<Text style={{fontSize:40}}>🧙</Text>}
          </View>
          <TouchableOpacity style={ss.photoBtn} onPress={cambiarFoto} disabled={avatarUploading}>
            <Text style={ss.photoTxt}>{avatarUploading?"Subiendo...":"Cambiar foto"}</Text>
          </TouchableOpacity>
          <Text style={ss.avatarNota}>🔒 Solo vos pods ver tu foto por ahora.</Text>
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>DATOS PERSONALES</Text>
          <View style={ss.privaNota}><Text style={ss.privaNotaTxt}>Estos datos son privados. Solo se revelan al empleador cuando ambos deciden contactarse.</Text></View>
          <View style={{flexDirection:"row",gap:10}}>
            <View style={{flex:1}}><Field label="Primer nombre" value={nombre} onChange={setNombre} placeholder="Nombre"/></View>
            <View style={{flex:1}}><Field label="Segundo nombre" value={nombre2} onChange={setNombre2} placeholder="Segundo nombre" optional/></View>
          </View>
          <View style={{flexDirection:"row",gap:10}}>
            <View style={{flex:1}}><Field label="Primer apellido" value={apellido1} onChange={setApellido1} placeholder="Apellido"/></View>
            <View style={{flex:1}}><Field label="Segundo apellido" value={apellido2} onChange={setApellido2} placeholder="Segundo apellido" optional/></View>
          </View>
          <FechaNac value={fechaNac} onChange={setFechaNac}/>
          <Single label="Sexo" opts={SEXOS} sel={sexo} onSel={setSexo}/>
          <Single label="Estado civil" opts={ESTADOS} sel={estadoCivil} onSel={setEstadoCivil} optional/>
          <Field label="Nacionalidad" value={nacionalidad} onChange={setNacionalidad} placeholder="Ej: Uruguayo/a"/>
          <Field label="Telefono" value={telefono} onChange={setTelefono} placeholder="Ej: 099 123 456" keyboard="phone-pad"/>
          <Field label="Descripcion personal" value={bio} onChange={setBio} placeholder="Contanos sobre vos..." multi/>
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>UBICACION</Text>
          <SearchField label="Pais" value={pais} onChange={setPais} placeholder="Escribi tu pais..." suggestions={PAISES} onSelect={v=>{setPais(v);setCiudad("");setBarrio("");}}/>
          <SearchField label="Ciudad" value={ciudad} onChange={v=>{setCiudad(v);setBarrio("");}} placeholder="Escribi tu ciudad..." suggestions={ciudadesDisp} onSelect={v=>{setCiudad(v);setBarrio("");}}/>
          <SearchField label="Barrio" value={barrio} onChange={setBarrio} placeholder="Escribi tu barrio..." suggestions={barriosDisp} onSelect={setBarrio}/>
          {barriosDisp.length===0&&ciudad.length>0&&(
            <View style={ss.ubicNota}><Text style={ss.ubicNotaTxt}>Tu ciudad aun no tiene barrios cargados. Podes escribirlo manualmente.</Text></View>
          )}
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>SERVICIOS Y PROFESIONES</Text>
          <View style={ss.tabRow}>
            <TouchableOpacity style={[ss.tabBtn,tab==="servicios"&&ss.tabBtnA]} onPress={()=>setTab("servicios")}><Text style={[ss.tabTxt,tab==="servicios"&&ss.tabTxtA]}>Servicios</Text></TouchableOpacity>
            <TouchableOpacity style={[ss.tabBtn,tab==="profesiones"&&ss.tabBtnA]} onPress={()=>setTab("profesiones")}><Text style={[ss.tabTxt,tab==="profesiones"&&ss.tabTxtA]}>Profesiones</Text></TouchableOpacity>
          </View>
          {tab==="servicios"&&(<Chips label="Selecciona los servicios que ofreces" opts={SERVICIOS} sel={servicios} onToggle={v=>toggleArr(servicios,setServicios,v)}/>)}
          {tab==="profesiones"&&(
            <View>
              {profActiva?(
                <View>
                  <TouchableOpacity style={ss.volverProf} onPress={()=>{setProfActiva(null);setSubEsp([]);setProfesiones(p=>p.filter(x=>x!==profActiva));}}><Text style={ss.volverProfTxt}>Profesiones</Text></TouchableOpacity>
                  <View style={[ss.chipA,{alignSelf:"flex-start",marginBottom:12,paddingHorizontal:14,paddingVertical:8,borderRadius:20}]}><Text style={ss.ctA}>{profActiva}</Text></View>
                  <Text style={ss.fl}>Selecciona tu especialidad</Text>
                  <View style={ss.cw}>
                    {(SUBCATS[profActiva]||[]).map(o=>{const s=subEsp.includes(o);return(<TouchableOpacity key={o} style={[ss.chip,s&&ss.chipA]} onPress={()=>toggleArr(subEsp,setSubEsp,o)}><Text style={[ss.ct,s&&ss.ctA]}>{o}</Text></TouchableOpacity>);})}
                  </View>
                </View>
              ):(
                <View>
                  <Text style={ss.fl}>Selecciona tus profesiones</Text>
                  <View style={ss.cw}>
                    {PROFESIONES_BASE.map(o=>{const s=profesiones.includes(o);return(<TouchableOpacity key={o} style={[ss.chip,s&&ss.chipA]} onPress={()=>toggleProf(o)}><Text style={[ss.ct,s&&ss.ctA]}>{o}</Text></TouchableOpacity>);})}
                  </View>
                </View>
              )}
              <View style={ss.avisoBox}><Text style={ss.avisoTxt}>Deberas presentar documentacion que certifique los titulos, oficios e idiomas declarados si el empleador lo requiere.</Text></View>
            </View>
          )}
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>DISPONIBILIDAD</Text>
          <Single label="Disponibilidad" opts={DISPS} sel={disp} onSel={setDisp}/>
          <Chips label="Tipo de empleo que buscas" opts={TIPOS} sel={tipos} onToggle={v=>toggleArr(tipos,setTipos,v)}/>
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>IDIOMAS</Text>
          <Chips label="Idiomas que hablas" opts={LANGS} sel={langs} onToggle={v=>toggleArr(langs,setLangs,v)}/>
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>EXTRAS</Text>
          <View style={ss.swRow}>
            <View style={{flex:1}}><Text style={ss.swLbl}>Tengo referencias laborales</Text><Text style={ss.swSub}>Podes presentar referencias de empleos anteriores</Text></View>
            <Switch value={refs} onValueChange={setRefs} trackColor={{false:"#EDE8E2",true:"#E8785A"}} thumbColor="#FFFFFF"/>
          </View>
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>EXPERIENCIA Y PRETENSION SALARIAL</Text>
          <Field label="Anos de experiencia en el oficio" value={aniosExp} onChange={setAniosExp} placeholder="Ej: 5" keyboard="numeric"/>
          <View style={{flexDirection:"row",gap:10}}>
            <View style={{flex:1}}><Field label="Sueldo minimo esperado" value={sueldoMin} onChange={setSueldoMin} placeholder="Ej: 500" keyboard="numeric"/></View>
            <View style={{flex:1}}><Field label="Sueldo maximo esperado" value={sueldoMax} onChange={setSueldoMax} placeholder="Ej: 800" keyboard="numeric"/></View>
          </View>
          <Single label="Moneda" opts={["USD","UYU","ARS","BRL","CLP","COP","MXN"]} sel={sueldoMoneda} onSel={setSueldoMoneda}/>
        </View>

        <View style={ss.sec}>
          <Text style={ss.stit}>VISIBILIDAD</Text>
          <View style={ss.swRow}>
            <View style={{flex:1}}><Text style={ss.swLbl}>Perfil siempre visible</Text><Text style={ss.swSub}>El empleador puede ver tu perfil sin tus datos personales, hasta que vos manifestes interes en el empleo.</Text></View>
            <Switch value={vis} onValueChange={setVis} trackColor={{false:"#EDE8E2",true:"#E8785A"}} thumbColor="#FFFFFF"/>
          </View>
        </View>
        <TouchableOpacity style={ss.btnW} onPress={guardar} disabled={saving}>
          <LinearGradient colors={["#E8785A","#D4614A"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            <Text style={ss.btnT}>{saving?"Guardando...":"Guardar cambios"}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:"#FBF8F4"},
  hdr:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingVertical:14,backgroundColor:"#FFFFFF",borderBottomWidth:1,borderBottomColor:"#EDE8E2"},
  back:{fontSize:14,fontWeight:"700",color:"#2DD4BF"},
  htit:{fontSize:16,fontWeight:"800",color:"#1A1020"},
  avSec:{alignItems:"center",paddingVertical:24,backgroundColor:"#FFFFFF",marginBottom:16},
  av:{width:88,height:88,borderRadius:44,backgroundColor:"#E8785A",alignItems:"center",justifyContent:"center",marginBottom:10},
  photoBtn:{paddingHorizontal:16,paddingVertical:6,backgroundColor:"#F0FDFA",borderRadius:20},
  photoTxt:{fontSize:13,fontWeight:"700",color:"#2DD4BF"},
  avatarNota:{fontSize:11,color:"#A898B8",marginTop:8,textAlign:"center"},
  sec:{marginHorizontal:16,marginBottom:16},
  stit:{fontSize:10,fontWeight:"700",color:"#A898B8",letterSpacing:1,marginBottom:10},
  privaNota:{backgroundColor:"#F0FDFA",borderRadius:8,padding:10,marginBottom:12,borderLeftWidth:3,borderLeftColor:"#2DD4BF"},
  privaNotaTxt:{fontSize:12,color:"#2DD4BF",lineHeight:18},
  fw:{marginBottom:14},
  flRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:6},
  fl:{fontSize:12,fontWeight:"700",color:"#5A4E6A",marginBottom:6},
  opt:{fontSize:10,color:"#A898B8",fontStyle:"italic"},
  fi:{backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:14,color:"#1A1020"},
  sugg:{backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#EDE8E2",borderRadius:10,marginTop:4,overflow:"hidden"},
  suggI:{paddingHorizontal:14,paddingVertical:12,borderBottomWidth:1,borderBottomColor:"#EDE8E2"},
  suggT:{fontSize:14,color:"#1A1020"},
  ubicNota:{backgroundColor:"#E6FBF5",borderRadius:8,padding:10,marginTop:4,borderLeftWidth:3,borderLeftColor:"#3DA882"},
  ubicNotaTxt:{fontSize:12,color:"#2E9472",lineHeight:18},
  cw:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:8},
  chip:{paddingHorizontal:12,paddingVertical:6,backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:20},
  chipA:{backgroundColor:"#2DD4BF",borderColor:"#2DD4BF"},
  ct:{fontSize:12,fontWeight:"600",color:"#5A4E6A"},
  ctA:{color:"#FFFFFF"},
  tabRow:{flexDirection:"row",gap:8,marginBottom:14},
  tabBtn:{flex:1,paddingVertical:10,borderRadius:10,backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#EDE8E2",alignItems:"center"},
  tabBtnA:{backgroundColor:"#2DD4BF",borderColor:"#2DD4BF"},
  tabTxt:{fontSize:13,fontWeight:"700",color:"#5A4E6A"},
  tabTxtA:{color:"#FFFFFF"},
  avisoBox:{backgroundColor:"#E6FBF5",borderRadius:10,padding:12,marginTop:8,borderLeftWidth:3,borderLeftColor:"#3DA882"},
  avisoTxt:{fontSize:12,color:"#2E9472",lineHeight:18},
  swRow:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFFFFF",borderRadius:12,padding:14,borderWidth:1,borderColor:"#EDE8E2",gap:12,marginBottom:10},
  swLbl:{fontSize:14,fontWeight:"600",color:"#1A1020",marginBottom:3},
  swSub:{fontSize:12,color:"#A898B8",lineHeight:17},
  volverProf:{marginBottom:12,paddingVertical:6},
  volverProfTxt:{fontSize:14,fontWeight:"700",color:"#2DD4BF",textDecorationLine:"underline"},
  btnW:{marginHorizontal:16,marginTop:8,borderRadius:14,overflow:"hidden"},
  btn:{paddingVertical:16,alignItems:"center"},
  btnT:{color:"#FFFFFF",fontSize:16,fontWeight:"800"},
});
