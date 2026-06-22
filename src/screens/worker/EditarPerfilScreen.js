import React,{useState,useEffect,useRef,useCallback} from "react";
import*as Localization from "expo-localization";
import{View,Text,StyleSheet,TouchableOpacity,TextInput,ScrollView,Alert,Switch,Image,KeyboardAvoidingView,Platform}from "react-native";
import*as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import{supabase}from "../../services/supabase";
import{useI18n}from "../../services/I18nContext";
import{useApp}from "../../services/AppContext";
import{trItem,trArray,SERVICIOS_TR,PROFESIONES_TR,SUBCATS_TR,SEXOS_TR,ESTADOS_TR,DISPS_TR,TIPOS_TR,LANGS_TR,TECNICATURAS_POR_PAIS,LICENCIATURAS_POR_PAIS}from "../../data/oficios";
// VISION_KEY removida — la moderación de imágenes se hace en la edge function verificar-imagen
const MONEDA_LOCAL_POR_PAIS={"Uruguay":"UYU","Argentina":"ARS","Brasil":"BRL","Chile":"CLP","Paraguay":"PYG","Bolivia":"BOB","Perú":"PEN","Peru":"PEN","Colombia":"COP","México":"MXN","Mexico":"MXN","Ecuador":"USD","Venezuela":"VES","Cuba":"CUP","Costa Rica":"CRC","Guatemala":"GTQ","El Salvador":"USD","Honduras":"HNL","Nicaragua":"NIO","Panamá":"PAB","República Dominicana":"DOP","España":"EUR","Spain":"EUR","Portugal":"EUR","Francia":"EUR","France":"EUR","Italia":"EUR","Italy":"EUR","Alemania":"EUR","Germany":"EUR","Reino Unido":"GBP","United Kingdom":"GBP","Estados Unidos":"USD","United States":"USD","Canadá":"CAD","Canada":"CAD","Australia":"AUD","Suecia":"SEK","Sweden":"SEK","Noruega":"NOK","Norway":"NOK","Japón":"JPY","Japan":"JPY","India":"INR"};
const SIMBOLOS_MONEDA={"UYU":"$U","USD":"US$","ARS":"$","BRL":"R$","CLP":"$","PEN":"S/","COP":"$","MXN":"$","PYG":"₲","BOB":"Bs.","VES":"Bs.S","CUP":"$MN","CRC":"₡","GTQ":"Q","HNL":"L","NIO":"C$","PAB":"B/.","DOP":"RD$","EUR":"€","GBP":"£","CAD":"CA$","AUD":"AU$","JPY":"¥","SEK":"kr","NOK":"kr","INR":"₹"};
const BARRIOS_POR_CIUDAD={"Montevideo":["Ciudad Vieja","Centro","Cordon","Palermo","Pocitos","Buceo","Malvin","Punta Carretas","Parque Rodo","Tres Cruces","Aguada","Goes","La Blanqueada","Union","Colon","Sayago","Paso de la Arena","Carrasco","Prado","Bella Vista","Cerro","La Teja","Nuevo Paris","Penarol","Piedras Blancas","Manga","Casabo","Lezica","Maronas"],"Buenos Aires":["Palermo","Recoleta","San Telmo","La Boca","Belgrano","Caballito","Villa Crespo","Almagro","Boedo","Flores","Floresta","Villa del Parque","Coghlan","Saavedra","Nunez","Colegiales","Chacarita","Paternal","Villa Urquiza","Devoto","Monte Castro","Mataderos","Liniers","Lugano","Soldati","Pompeya","Barracas","Constitucion","Monserrat","San Nicolas","Retiro","Puerto Madero"],"Santiago":["Las Condes","Providencia","Vitacura","Lo Barnechea","La Reina","Nunoa","Santiago Centro","Independencia","Recoleta","Conchalí","Huechuraba","Quilicura","Pudahuel","Cerro Navia","Lo Prado","Quinta Normal","Estacion Central","Maipu","Cerrillos","San Miguel","La Cisterna","La Florida","Penalolen","Macul"],"Lima":["Miraflores","San Isidro","Barranco","Surco","La Molina","San Borja","Pueblo Libre","Jesus Maria","Lince","Magdalena","San Miguel","Callao","Rimac","La Victoria","Ate","Santa Anita","San Juan de Lurigancho","Comas","Los Olivos","San Martin de Porres"],"Bogota":["Chapinero","Usaquen","Suba","Engativa","Fontibon","Kennedy","Bosa","Ciudad Bolivar","San Cristobal","Usme","Tunjuelito","Teusaquillo","Barrios Unidos","Santa Fe"],"Ciudad de Mexico":["Condesa","Roma","Polanco","Coyoacan","San Angel","Tlalpan","Iztapalapa","Gustavo A Madero","Azcapotzalco","Miguel Hidalgo","Cuauhtemoc","Benito Juarez","Alvaro Obregon","Iztacalco","Venustiano Carranza"],"Sao Paulo":["Jardins","Moema","Vila Madalena","Pinheiros","Itaim Bibi","Morumbi","Lapa","Barra Funda","Consolacao","Liberdade","Bela Vista","Republica","Santa Cecilia","Higienopolis","Perdizes","Butanta"]};
const CIUDADES_POR_PAIS={"Uruguay":["Montevideo","Salto","Paysandu","Las Piedras","Rivera","Maldonado","Tacuarembo","Melo","Mercedes","Artigas","Minas","San Jose","Durazno","Florida","Rocha","Colonia"],"Argentina":["Buenos Aires","Cordoba","Rosario","Mendoza","Tucuman","La Plata","Mar del Plata","Salta","Santa Fe","San Juan","Neuquen","Corrientes","Posadas","Bahia Blanca"],"Brasil":["Sao Paulo","Rio de Janeiro","Brasilia","Salvador","Fortaleza","Belo Horizonte","Manaus","Curitiba","Recife","Porto Alegre"],"Chile":["Santiago","Valparaiso","Concepcion","La Serena","Antofagasta","Temuco","Rancagua","Talca","Arica","Iquique"],"Paraguay":["Asuncion","Ciudad del Este","San Lorenzo","Luque","Encarnacion"],"Colombia":["Bogota","Medellin","Cali","Barranquilla","Cartagena"],"México":["Ciudad de Mexico","Guadalajara","Monterrey","Puebla","Toluca"],"Perú":["Lima","Arequipa","Trujillo","Chiclayo","Piura"],"Bolivia":["La Paz","Santa Cruz","Cochabamba","Sucre","Oruro"],"Ecuador":["Guayaquil","Quito","Cuenca","Santo Domingo"],"Venezuela":["Caracas","Maracaibo","Valencia","Barquisimeto","Maracay"],"Cuba":["La Habana","Santiago de Cuba","Camaguey","Holguin","Santa Clara"],"Costa Rica":["San Jose","Alajuela","Cartago","Heredia","Liberia"],"Panamá":["Ciudad de Panama","Colon","David","Santiago","Chitre"],"Guatemala":["Ciudad de Guatemala","Quetzaltenango","Escuintla","Antigua","Coban"],"El Salvador":["San Salvador","Santa Ana","San Miguel","Soyapango","Nueva San Salvador"],"Honduras":["Tegucigalpa","San Pedro Sula","Choloma","La Ceiba","El Progreso"],"Nicaragua":["Managua","Leon","Masaya","Granada","Chinandega"],"República Dominicana":["Santo Domingo","Santiago","La Romana","San Pedro de Macoris","San Francisco de Macoris"],"España":["Madrid","Barcelona","Valencia","Sevilla","Zaragoza","Malaga","Murcia","Palma","Las Palmas","Bilbao"],"Portugal":["Lisboa","Porto","Amadora","Braga","Setubal","Coimbra"],"Francia":["Paris","Lyon","Marseille","Toulouse","Nice","Nantes","Strasbourg","Bordeaux"],"Italia":["Roma","Milano","Napoli","Torino","Palermo","Genova","Bologna","Firenze"],"Alemania":["Berlin","Hamburg","Munich","Cologne","Frankfurt","Stuttgart","Dusseldorf","Leipzig"],"Reino Unido":["London","Birmingham","Manchester","Glasgow","Liverpool","Leeds","Sheffield","Edinburgh"],"Estados Unidos":["New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego","Dallas","San Jose"],"Canadá":["Toronto","Montreal","Vancouver","Calgary","Edmonton","Ottawa","Winnipeg","Quebec City"],"Australia":["Sydney","Melbourne","Brisbane","Perth","Adelaide","Canberra","Darwin","Hobart"],"Suecia":["Estocolmo","Gotemburgo","Malmö","Uppsala","Västerås","Örebro"],"Noruega":["Oslo","Bergen","Trondheim","Stavanger","Drammen","Kristiansand"],"Japón":["Tokio","Osaka","Kioto","Nagoya","Sapporo","Fukuoka","Kobe","Hiroshima"],"India":["Mumbai","Delhi","Bangalore","Hyderabad","Chennai","Kolkata","Pune","Ahmedabad","Surat","Jaipur"]};
const PAISES=["Uruguay","Argentina","Brasil","Chile","Paraguay","Bolivia","Perú","Colombia","México","Ecuador","Venezuela","Cuba","Costa Rica","Panamá","Guatemala","El Salvador","Honduras","Nicaragua","República Dominicana","España","Portugal","Francia","Italia","Alemania","Reino Unido","Estados Unidos","Canadá","Australia","Suecia","Noruega","Japón","India","Otro"];
const SEXOS=["Masculino","Femenino","Otros"];
const ESTADOS=["Soltero/a","Casado/a","Divorciado/a","Viudo/a","En pareja"];
const DISPS=["Inmediata","En 1 semana","En 2 semanas","A convenir"];
const TIPOS=["Permanente","Temporal","Por tarea","Medio horario"];
const LANGS=["Espanol","Portugues","Ingles","Frances","Italiano","Aleman","Otro"];
const SERVICIOS=["Alambrador","Albanil","Auxiliar de limpieza","Auxiliar de limpieza empresarial","Barman","Camionero/a","Carpintero/a","Chofer particular","Cocinero/a","Cortador/a de cesped","Costurero/a","Cuidado de animales","Cuidador/a de ancianos","Cuidador/a de discapacitados","Custodia personal","Delivery","Domador","Electricista","Esquilador","Esteticista","Fumigador/a","Gasista","Guardia de seguridad","Herrero/a","Jardinero/a","Mandados","Mecanico/a","Mozo/a","Mucama","Mudanzas","Ninera","Paseador/a de perros","Peluquero/a","Peon de albanileria","Peon rural","Pintor/a","Planchado","Plomero/a","Portero/a","Remisero/a","Reponedor/a","Repostero/a","Sastre","Sereno/a","Soldador/a","Tractorista","Tropero","Zapatero/a","Otro"];
const PROFESIONES_BASE=["Abogado/a","Administrador/a","Agronomo/a","Arbitro deportivo","Arquitecto/a","Artista plastico","Asesor/a financiero","Asistente Social","Auditor/a","Auxiliar administrativo","Auxiliar de enfermeria","Biologo/a","Comunicador/a","Contador/a","Data Analyst","Desarrollador/a Web","DevOps","Disenador/a","Docente primaria","Docente secundaria","Economista","Educador/a especial","Enfermero/a","Escribano/a","Farmaceutico/a","Fisioterapeuta","Fotografo/a","Geologo/a","Ingeniero/a","Laboratorista","Marketing Digital","Medico/a","Musico/a","Nutricionista","Odontologo/a","Periodista","Profesor/a universitario","Programador/a","Psicologo/a","Quimico/a","Relacionista Publico","Sociologo/a","Veterinario/a","Otro"];
const SUBCATS={"Medico/a":["Medicina General","Pediatria","Cardiologia","Neurologia","Cirugia","Ginecologia","Traumatologia","Dermatologia","Psiquiatria","Oncologia","Medicina Familiar","Otra especialidad"],"Abogado/a":["Derecho Penal","Derecho de Familia","Derecho Civil","Derecho Laboral","Derecho Comercial","Derecho Administrativo","Derecho Internacional","Mediacion y Arbitraje","Propiedad Intelectual","Otra especialidad"],"Psicologo/a":["Psicologia Clinica","Psicologia Infantil","Psicologia Organizacional","Psicologia Forense","Neuropsicologia","Psicoterapia","Otra especialidad"],"Ingeniero/a":["Ingenieria Civil","Ingenieria Electrica","Ingenieria Industrial","Ingenieria en Sistemas","Ingenieria Quimica","Ingenieria Agronomica","Ingenieria Mecanica","Ingenieria Ambiental","Otra ingenieria"],"Disenador/a":["Diseno Grafico","Diseno UX/UI","Diseno Industrial","Diseno de Moda","Diseno de Interiores","Diseno Web","Diseno Editorial","Otro diseno"],"Arquitecto/a":["Arquitectura Residencial","Arquitectura Comercial","Urbanismo","Paisajismo","Arquitectura Sustentable","Otra especialidad"],"Contador/a":["Contabilidad General","Auditoria","Impuestos y Tributos","Finanzas Corporativas","Asesoria Contable","Otra especialidad"],"Enfermero/a":["Enfermeria General","Enfermeria Pediatrica","Cuidados Intensivos","Enfermeria Geriatrica","Otra especialidad"],"Odontologo/a":["Odontologia General","Ortodoncia","Endodoncia","Cirugia Maxilofacial","Odontopediatria","Otra especialidad"],"Veterinario/a":["Animales de Compania","Animales de Granja","Cirugia Veterinaria","Nutricion Animal","Otra especialidad"],"Musico/a":["Musica Clasica","Jazz","Rock/Pop","Produccion Musical","Composicion","Canto","Otra especialidad"],"Periodista":["Periodismo Grafico","Periodismo Digital","Periodismo Televisivo","Periodismo Radial","Otra especialidad"],"Agronomo/a":["Produccion Vegetal","Produccion Animal","Agronegocios","Agricultura Organica","Otra especialidad"],"Fisioterapeuta":["Rehabilitacion Motora","Fisioterapia Deportiva","Fisioterapia Neurologica","Fisioterapia Pediatrica","Otra especialidad"]};
const PROF_CON_SUB=Object.keys(SUBCATS);
const MONEDA_POR_REGION={UY:"UYU",AR:"ARS",BR:"BRL",CL:"CLP",ES:"EUR",PT:"EUR",FR:"EUR",DE:"EUR",IT:"EUR",GB:"GBP",US:"USD",CA:"CAD",AU:"AUD",SE:"SEK",NO:"NOK",JP:"JPY",IN:"INR"};
function monedaDefecto(){const r=Localization.getLocales?.()?.[0]?.regionCode||Localization.region||"";return MONEDA_POR_REGION[r]||"USD";}

function Field({label,value,onChange,placeholder,multi,keyboard,optional,optLbl}){
  return(
    <View style={ss.fw}>
      <View style={ss.flRow}>
        <Text style={ss.fl}>{label}</Text>
        {optional&&<Text style={ss.opt}>{optLbl}</Text>}
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
      <TextInput style={ss.fi} value={value} onChangeText={v=>{onChange(v);setShow(true);}} placeholder={placeholder} placeholderTextColor="#A898B8" onFocus={()=>setShow(true)}/>
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
// ── Normalizador simple para matching de sugerencias ──────────────────────────
function norm(s=''){
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9\s]/g,' ').trim();
}

// Diccionario de variantes fonéticas → término canónico (espejo del backend)
const CORR={
  "limpesa":"limpieza","limpiesa":"limpieza","limpiar":"limpieza","limpiadora":"limpieza",
  "ninia":"niñera","ninhera":"niñera","niniera":"niñera","canguro":"niñera","babicitter":"niñera",
  "ansiano":"anciano","anciano":"adulto mayor","viejo":"adulto mayor","vejito":"adulto mayor",
  "plomeria":"plomería","plumeria":"plomería","gasfiter":"plomería","cañeria":"plomería",
  "electricita":"electricista","electrisista":"electricista","electrisidad":"electricista",
  "albanil":"albañil","albanileria":"albañilería","albanilería":"albañilería",
  "jardineria":"jardinería","cesped":"jardinería","yarda":"jardinería","jardin":"jardinería","podar":"jardinería",
  "cociñar":"cocina","cozinar":"cocina","cosinero":"cocinero","guisar":"cocina",
  "manejar":"conductor","maneho":"conductor","choffer":"conductor",
  "cuidar":"cuidador","enfermeria":"enfermería",
  "mandao":"mandados","mandaos":"mandados","mensajero":"mandados","recado":"mandados",
  "carpintero":"carpintería","carpin":"carpintería","madera":"carpintería",
  "pintor":"pintura","pintar":"pintura",
  "mecanico":"mecánico","mecanica":"mecánico",
  "guardia":"seguridad","vigilante":"seguridad","sereno":"seguridad",
  "peluquero":"peluquería","esteticista":"estética","manicura":"estética",
  "chacra":"trabajo rural","campo":"trabajo rural","tractorista":"tractorista",
  "mudanza":"mudanzas","flete":"mudanzas","fletes":"mudanzas",
  "perro":"cuidado de animales","paseador":"paseador de perros","pasear perros":"paseador de perros",
  "coser":"costura","costurera":"costura","modista":"costura",
  "tortas":"repostería","pasteleria":"repostería","panadero":"panadería",
};

// Lista de oficios conocidos para sugerencias
const OFICIOS_SUGERENCIAS=[
  "Limpieza","Niñera","Cuidador/a de ancianos","Plomero/a","Electricista",
  "Jardinero/a","Cocinero/a","Conductor","Mandados","Carpintero/a",
  "Pintor/a","Mecánico/a","Seguridad","Peluquero/a","Costura",
  "Repostería","Panadería","Mudanzas","Paseador de perros","Albañil",
  "Trabajo rural","Tractorista","Estética","Enfermería","Mensajería",
];

function CampoConSugerencias({value,onChange}){
  const[sugs,setSugs]=React.useState([]);

  function calcularSugs(texto){
    if(!texto||texto.trim().length<3){setSugs([]);return;}
    // Obtener la última palabra o frase que el usuario está escribiendo
    const palabras=texto.split(/[\s,]+/);
    const ultima=norm(palabras[palabras.length-1]||'');
    if(ultima.length<3){setSugs([]);return;}
    // Aplicar correcciones y buscar en OFICIOS_SUGERENCIAS
    const textoCorrecto=Object.entries(CORR).reduce((t,[k,v])=>t.replace(new RegExp('\\b'+k+'\\b','g'),v),ultima);
    const matches=OFICIOS_SUGERENCIAS.filter(o=>{
      const on=norm(o);
      return on.includes(textoCorrecto)||textoCorrecto.includes(on.split(' ')[0])||on.split(' ').some(p=>p.startsWith(textoCorrecto));
    }).slice(0,5);
    setSugs(matches);
  }

  function aplicarSugerencia(sug){
    // Reemplazar la última palabra con la sugerencia
    const partes=value.split(/([,\s]+)/);
    // Agregar sugerencia al final
    const nuevo=(value.trimEnd()+(value.endsWith(',')?' ':value.length?', ':'')+sug).slice(0,500);
    onChange(nuevo);
    setSugs([]);
  }

  return(
    <View style={ss.fw}>
      <View style={{flexDirection:"row",justifyContent:"space-between"}}>
        <Text style={ss.fl}>¿Qué podés ofrecer?</Text>
        <Text style={ss.opt}>opcional</Text>
      </View>
      <TextInput
        style={[ss.fi,{height:90,textAlignVertical:"top"}]}
        value={value}
        onChangeText={v=>{onChange(v.slice(0,500));calcularSugs(v);}}
        placeholder="Ej: cuido personas mayores, cocino, hago mandados y limpieza"
        placeholderTextColor="#A898B8"
        multiline
        maxLength={500}
      />
      {sugs.length>0&&(
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:6,marginTop:6}}>
          <Text style={{fontSize:11,color:"#A898B8",width:"100%"}}>¿Quisiste decir?</Text>
          {sugs.map(s=>(
            <TouchableOpacity key={s} onPress={()=>aplicarSugerencia(s)}
              style={{backgroundColor:"#F3E8FF",borderRadius:20,paddingHorizontal:12,paddingVertical:5,borderWidth:1,borderColor:"#7C3AED"}}>
              <Text style={{fontSize:12,color:"#7C3AED",fontWeight:"700"}}>+ {s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={{fontSize:11,color:"#C4BACC",marginTop:4,textAlign:"right"}}>{value.length}/500</Text>
    </View>
  );
}

function Chips({label,opts,displayOpts,sel,onToggle}){
  return(
    <View style={ss.fw}>
      <Text style={ss.fl}>{label}</Text>
      <View style={ss.cw}>
        {opts.map((o,i)=>{const s=sel.includes(o);const lbl=displayOpts?.[i]??o;return(<TouchableOpacity key={o} style={[ss.chip,s&&ss.chipA]} onPress={()=>onToggle(o)}><Text style={[ss.ct,s&&ss.ctA]}>{lbl}</Text></TouchableOpacity>);})}
      </View>
    </View>
  );
}
function Single({label,opts,displayOpts,sel,onSel,optional,optLbl}){
  return(
    <View style={ss.fw}>
      <View style={ss.flRow}>
        <Text style={ss.fl}>{label}</Text>
        {optional&&<Text style={ss.opt}>{optLbl}</Text>}
      </View>
      <View style={ss.cw}>
        {opts.map((o,i)=>{const lbl=displayOpts?.[i]??o;return(<TouchableOpacity key={o} style={[ss.chip,sel===o&&ss.chipA]} onPress={()=>onSel(sel===o?"":o)}><Text style={[ss.ct,sel===o&&ss.ctA]}>{lbl}</Text></TouchableOpacity>);})}
      </View>
    </View>
  );
}
function FechaNac({value,onChange}){
  const{t}=useI18n();
  const mesRef=useRef(null);
  const anioRef=useRef(null);
  const[dia,setDia]=useState("");
  const[mes,setMes]=useState("");
  const[anio,setAnio]=useState("");
  useEffect(()=>{if(value){const p=value.split("/");setDia(p[0]||"");setMes(p[1]||"");setAnio(p[2]||"");}},[value]);
  function upd(d,m,a){onChange(d+"/"+m+"/"+a);}
  return(
    <View style={ss.fw}>
      <Text style={ss.fl}>{t('fecha_nacimiento')}</Text>
      <View style={{flexDirection:"row",gap:8}}>
        <View style={{flex:1}}><Text style={ss.opt}>{t('dia')}</Text><TextInput style={ss.fi} value={dia} onChangeText={v=>{setDia(v);upd(v,mes,anio);if(v.length===2)mesRef.current?.focus();}} placeholder="DD" placeholderTextColor="#A898B8" keyboardType="numeric" maxLength={2}/></View>
        <View style={{flex:1}}><Text style={ss.opt}>{t('mes')}</Text><TextInput ref={mesRef} style={ss.fi} value={mes} onChangeText={v=>{setMes(v);upd(dia,v,anio);if(v.length===2)anioRef.current?.focus();}} placeholder="MM" placeholderTextColor="#A898B8" keyboardType="numeric" maxLength={2}/></View>
        <View style={{flex:2}}><Text style={ss.opt}>{t('anno')}</Text><TextInput ref={anioRef} style={ss.fi} value={anio} onChangeText={v=>{setAnio(v);upd(dia,mes,v);}} placeholder="AAAA" placeholderTextColor="#A898B8" keyboardType="numeric" maxLength={4}/></View>
      </View>
    </View>
  );
}
export default function EditarPerfilScreen({navigation,route}){
  const{t,idioma}=useI18n();
  const{marcarPerfilCompleto}=useApp();
  const[tabAbierto,setTabAbierto]=useState(null);
  const[otroServActivo,setOtroServActivo]=useState(false);
  const[otroProActivo,setOtroProActivo]=useState(false);
  const[otroTecActivo,setOtroTecActivo]=useState(false);
  const[otroLicActivo,setOtroLicActivo]=useState(false);
  const[otroServTxt,setOtroServTxt]=useState("");
  const[otroProTxt,setOtroProTxt]=useState("");
  const[otroTecTxt,setOtroTecTxt]=useState("");
  const[otroLicTxt,setOtroLicTxt]=useState("");
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
  const[telefonoVerificado,setTelefonoVerificado]=useState(false);
  const telefonoGuardado=useRef("");
  const[pais,setPais]=useState("");
  const[ciudad,setCiudad]=useState("");
  const[barrio,setBarrio]=useState("");
  const[servicios,setServicios]=useState([]);
  const[profesiones,setProfesiones]=useState([]);
  const[tecnicaturas,setTecnicaturas]=useState([]);
  const[licenciaturas,setLicenciaturas]=useState([]);
  const[subEsp,setSubEsp]=useState([]);
  const[profActiva,setProfActiva]=useState(null);
  const[disp,setDisp]=useState("Inmediata");
  const[tipos,setTipos]=useState([]);
  const[langs,setLangs]=useState(["Espanol"]);
  const[refs,setRefs]=useState(false);
  const[aniosExp,setAniosExp]=useState("");
  const[sueldoMin,setSueldoMin]=useState("");
  const[sueldoMax,setSueldoMax]=useState("");
  const[sueldoMoneda,setSueldoMoneda]=useState(monedaDefecto());
  const[vis,setVis]=useState(false);
  const[descripcionLibre,setDescripcionLibre]=useState("");
  const[busquedaDiariaOn,setBusquedaDiariaOn]=useState(false);
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
            const mapa={'Uruguay':'Uruguay','Argentina':'Argentina','Brazil':'Brasil','Chile':'Chile','Paraguay':'Paraguay','Bolivia':'Bolivia','Peru':'Perú','Colombia':'Colombia','Mexico':'México','Ecuador':'Ecuador','Venezuela':'Venezuela','Cuba':'Cuba','Costa Rica':'Costa Rica','Panama':'Panamá','Guatemala':'Guatemala','El Salvador':'El Salvador','Honduras':'Honduras','Nicaragua':'Nicaragua','Dominican Republic':'República Dominicana','Spain':'España','Portugal':'Portugal','France':'Francia','Italy':'Italia','Germany':'Alemania','United Kingdom':'Reino Unido','United States':'Estados Unidos','Canada':'Canadá','Australia':'Australia','Sweden':'Suecia','Norway':'Noruega','Japan':'Japón','India':'India'};
            const paisMapeado=mapa[data.country_name]||data.country_name;
            if(PAISES.includes(paisMapeado)){setPais(paisMapeado);setSueldoMoneda(m=>m||MONEDA_LOCAL_POR_PAIS[paisMapeado]||"USD");}
          }
        }
      }catch(e){}
    }
    detectarPais();
  },[]);

  const ciudadesDisp=CIUDADES_POR_PAIS[pais]||[];
  const barriosDisp=BARRIOS_POR_CIUDAD[ciudad]||[];
  const monedasDisp=({"Uruguay":["UYU","USD"],"Argentina":["ARS","USD"],"Brasil":["BRL","USD"],"Chile":["CLP","USD"],"Paraguay":["PYG","USD"],"Bolivia":["BOB","USD"],"Perú":["PEN","USD"],"Peru":["PEN","USD"],"Colombia":["COP","USD"],"México":["MXN","USD"],"Mexico":["MXN","USD"],"Ecuador":["USD"],"Venezuela":["VES","USD"],"Cuba":["CUP","USD"],"Costa Rica":["CRC","USD"],"Guatemala":["GTQ","USD"],"El Salvador":["USD"],"Honduras":["HNL","USD"],"Nicaragua":["NIO","USD"],"Panamá":["PAB","USD"],"República Dominicana":["DOP","USD"],"España":["EUR","USD"],"Spain":["EUR","USD"],"Portugal":["EUR","USD"],"Francia":["EUR","USD"],"France":["EUR","USD"],"Italia":["EUR","USD"],"Italy":["EUR","USD"],"Alemania":["EUR","USD"],"Germany":["EUR","USD"],"Reino Unido":["GBP","USD"],"United Kingdom":["GBP","USD"],"Estados Unidos":["USD"],"United States":["USD"],"Canadá":["CAD","USD"],"Canada":["CAD","USD"],"Australia":["AUD","USD"],"Suecia":["SEK","USD"],"Sweden":["SEK","USD"],"Noruega":["NOK","USD"],"Norway":["NOK","USD"],"Japón":["JPY","USD"],"Japan":["JPY","USD"],"India":["INR","USD"]})[pais]||["USD"];

  const cargarPerfil=useCallback(async()=>{
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
        if(data.telefono){setTelefono(data.telefono);telefonoGuardado.current=data.telefono;}
        setTelefonoVerificado(data.telefono_verificado||false);
        if(data.pais)setPais(data.pais);
        if(data.ciudad)setCiudad(data.ciudad);
        if(data.barrio)setBarrio(data.barrio);
        if(data.servicios){const reg=data.servicios.filter(v=>v!=="Otro"&&SERVICIOS.includes(v));const cust=data.servicios.find(v=>v!=="Otro"&&!SERVICIOS.includes(v));setServicios(reg);if(cust){setOtroServTxt(cust);setOtroServActivo(true);}}
        if(data.profesiones){const reg=data.profesiones.filter(v=>v!=="Otro"&&PROFESIONES_BASE.includes(v));const cust=data.profesiones.find(v=>v!=="Otro"&&!PROFESIONES_BASE.includes(v));setProfesiones(reg);if(cust){setOtroProTxt(cust);setOtroProActivo(true);}}
        if(data.tecnicaturas){
          const allTec=Object.values(TECNICATURAS_POR_PAIS).flat();
          const allLic=Object.values(LICENCIATURAS_POR_PAIS).flat();
          const lics=data.tecnicaturas.filter(v=>v.startsWith('Licenciatura en')||allLic.includes(v));
          const tecs=data.tecnicaturas.filter(v=>!lics.includes(v));
          const regTec=tecs.filter(v=>allTec.includes(v));
          const custTec=tecs.find(v=>!allTec.includes(v));
          setTecnicaturas(regTec);
          if(custTec){setOtroTecTxt(custTec);setOtroTecActivo(true);}
          const regLic=lics.filter(v=>allLic.includes(v));
          const custLic=lics.find(v=>!allLic.includes(v));
          setLicenciaturas(regLic);
          if(custLic){setOtroLicTxt(custLic);setOtroLicActivo(true);}
        }
        if(data.especialidades)setSubEsp(data.especialidades);
        if(data.disponibilidad)setDisp(data.disponibilidad);
        if(data.tipos_empleo)setTipos(data.tipos_empleo);
        if(data.idiomas)setLangs(data.idiomas);
        if(data.referencias!=null)setRefs(data.referencias);
        if(data.anios_experiencia)setAniosExp(String(data.anios_experiencia));
        if(data.sueldo_pretension_min)setSueldoMin(String(data.sueldo_pretension_min));
        if(data.sueldo_pretension_max)setSueldoMax(String(data.sueldo_pretension_max));
        setSueldoMoneda(data.sueldo_moneda||MONEDA_LOCAL_POR_PAIS[data.pais]||monedaDefecto());
        if(data.perfil_visible!=null)setVis(data.perfil_visible);
        if(data.avatar_url)setAvatar(data.avatar_url);
        if(data.descripcion_libre)setDescripcionLibre(data.descripcion_libre);
        if(data.busqueda_diaria_on!=null)setBusquedaDiariaOn(data.busqueda_diaria_on||false);

      }catch(e){if(__DEV__)console.warn('[EditarPerfil]',e?.message);}
  },[]);
  useEffect(()=>{cargarPerfil();},[cargarPerfil]);

  useEffect(()=>{
    const unsub=navigation.addListener("focus",async()=>{
      try{
        const{data:{user}}=await supabase.auth.getUser();
        if(!user)return;
        const{data}=await supabase.from("profiles").select("telefono,telefono_verificado").eq("id",user.id).single();
        if(data){
          if(data.telefono){setTelefono(data.telefono);telefonoGuardado.current=data.telefono;}
          setTelefonoVerificado(data.telefono_verificado||false);
        }
      }catch(e){}
    });
    return unsub;
  },[navigation]);

  function totalCombinado(){
    const vs=servicios.filter(x=>x!=="Otro"&&SERVICIOS.includes(x)).length;
    const vp=profesiones.filter(x=>x!=="Otro"&&PROFESIONES_BASE.includes(x)).length;
    return vs+vp+tecnicaturas.length+(otroServActivo?1:0)+(otroProActivo?1:0)+(otroTecActivo?1:0);
  }
  function toggleArr(arr,setArr,v){
    setArr(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);
  }
  function toggleServicio(v){
    if(servicios.includes(v)){setServicios(p=>p.filter(x=>x!==v));return;}
    if(totalCombinado()>=3){Alert.alert(t('error'),'Podés seleccionar hasta 3 en total entre oficios, profesiones y tecnicaturas');return;}
    setServicios(p=>[...p,v]);
  }
  function toggleTec(v){
    if(tecnicaturas.includes(v)){setTecnicaturas(p=>p.filter(x=>x!==v));return;}
    if(totalCombinado()>=3){Alert.alert(t('error'),'Podés seleccionar hasta 3 en total entre oficios, profesiones y tecnicaturas');return;}
    setTecnicaturas(p=>[...p,v]);
  }
  function toggleProf(v){
    const tieneSubcat=PROF_CON_SUB.includes(v);
    if(tieneSubcat){
      if(profActiva===v){setProfActiva(null);setSubEsp([]);setProfesiones(p=>p.filter(x=>x!==v));}
      else{
        if(!profesiones.includes(v)&&totalCombinado()>=3){Alert.alert(t('error'),'Podés seleccionar hasta 3 en total entre oficios, profesiones y tecnicaturas');return;}
        setProfActiva(v);setSubEsp([]);setProfesiones(p=>[...p.filter(x=>!PROF_CON_SUB.includes(x)),v]);
      }
    }else{
      if(!profesiones.includes(v)&&totalCombinado()>=3){Alert.alert(t('error'),'Podés seleccionar hasta 3 en total entre oficios, profesiones y tecnicaturas');return;}
      setProfesiones(p=>p.includes(v)?p.filter(x=>x!==v):[...p.filter(x=>x!==profActiva),v]);
    }
  }
  function toggleOtroServ(){if(otroServActivo){setOtroServActivo(false);setOtroServTxt("");return;}if(totalCombinado()>=3){Alert.alert(t('error'),'Podés seleccionar hasta 3 en total entre oficios, profesiones y tecnicaturas');return;}setOtroServActivo(true);}
  function toggleOtroPro(){if(otroProActivo){setOtroProActivo(false);setOtroProTxt("");return;}if(totalCombinado()>=3){Alert.alert(t('error'),'Podés seleccionar hasta 3 en total entre oficios, profesiones y tecnicaturas');return;}setOtroProActivo(true);}
  function toggleOtroTec(){if(otroTecActivo){setOtroTecActivo(false);setOtroTecTxt("");return;}if(totalCombinado()>=3){Alert.alert(t('error'),'Podés seleccionar hasta 3 en total entre oficios, profesiones y tecnicaturas');return;}setOtroTecActivo(true);}
  function toggleLic(v){setLicenciaturas(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);}
  function toggleOtroLic(){if(otroLicActivo){setOtroLicActivo(false);setOtroLicTxt("");return;}setOtroLicActivo(true);}

  async function cambiarFoto(){
    try{
      const perm=await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(!perm.granted){Alert.alert(t('permiso_galeria_tit'),t('permiso_galeria_msg'));return;}
      const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,allowsEditing:true,aspect:[1,1],quality:0.7,base64:true});
      if(result.canceled)return;
      const asset=result.assets[0];
      setAvatarUploading(true);
      const{data:visionData,error:visionErr}=await supabase.functions.invoke("verificar-imagen",{body:{base64:asset.base64}});
      if(!visionErr&&visionData?.segura===false){
        Alert.alert(t('foto_no_permitida_tit'),t('foto_no_permitida_msg'));
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
      Alert.alert(t('foto_actualizada_tit'),t('foto_actualizada_msg'));
    }catch(e){
      Alert.alert(t('error'),t('error_foto_msg'));
      console.log(e);
    }finally{setAvatarUploading(false);}
  }

  async function guardar(){
    if(nombre.trim().length<1){Alert.alert(t('error'),t('nombre_obligatorio'));return;}
    if(!apellido1.trim()){Alert.alert(t('error'),'Ingresá tu primer apellido');return;}
    if(!apellido2.trim()){Alert.alert(t('error'),'Ingresá tu segundo apellido');return;}
    if(!fechaNac){Alert.alert(t('error'),'Ingresá tu fecha de nacimiento');return;}
    if(!pais){Alert.alert(t('error'),'Seleccioná tu país');return;}
    if(!ciudad){Alert.alert(t('error'),'Seleccioná tu ciudad');return;}
    if(!sexo){Alert.alert(t('error'),'Seleccioná tu sexo');return;}
    if(!telefono.trim()){Alert.alert(t('error'),'Ingresá tu teléfono');return;}
    const serviciosFinales=[...servicios.filter(v=>v!=="Otro"&&SERVICIOS.includes(v)),...(otroServActivo&&otroServTxt.trim()?[otroServTxt.trim()]:[])];
    const profesionesFinales=[...profesiones.filter(v=>v!=="Otro"&&PROFESIONES_BASE.includes(v)),...(otroProActivo&&otroProTxt.trim()?[otroProTxt.trim()]:[])];
    const tecnicaturasFinales=[
      ...tecnicaturas,...(otroTecActivo&&otroTecTxt.trim()?[otroTecTxt.trim()]:[]),
      ...licenciaturas,...(otroLicActivo&&otroLicTxt.trim()?[otroLicTxt.trim()]:[]),
    ];
    const tieneCategoria=serviciosFinales.length+profesionesFinales.length+tecnicaturasFinales.length>0;
    const tieneDescripcionLibre=descripcionLibre.trim().length>10;
    if(busquedaDiariaOn&&!tieneDescripcionLibre&&!tieneCategoria){Alert.alert(t('error'),'Para activar la búsqueda diaria describí qué podés ofrecer (mínimo 10 caracteres)');return;}
    if(!tieneCategoria&&!tieneDescripcionLibre){Alert.alert(t('error'),'Seleccioná al menos un servicio o profesión, o describí lo que podés ofrecer');return;}
    setSaving(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){navigation.navigate("Login");return;}
      const telefVerif=telefono===telefonoGuardado.current?telefonoVerificado:false;
      const{error}=await supabase.from("profiles").upsert({id:user.id,nombre,nombre2,apellido1,apellido2,fecha_nac:fechaNac,sexo,estado_civil:estadoCivil,nacionalidad,bio,telefono,telefono_verificado:telefVerif,pais,ciudad,barrio,servicios:serviciosFinales,profesiones:profesionesFinales,tecnicaturas:tecnicaturasFinales,especialidades:subEsp,disponibilidad:disp,tipos_empleo:tipos,idiomas:langs,referencias:refs,perfil_visible:vis,anios_experiencia:aniosExp?Number(aniosExp):null,sueldo_pretension_min:sueldoMin?Number(sueldoMin):null,sueldo_pretension_max:sueldoMax?Number(sueldoMax):null,sueldo_moneda:sueldoMoneda||"USD",descripcion_libre:descripcionLibre.trim()||null,busqueda_diaria_on:busquedaDiariaOn,updated_at:new Date().toISOString()});
      if(error)throw error;
      marcarPerfilCompleto();
      await AsyncStorage.setItem('activacion_pendiente','true');
      if(route?.params?.desdeRegistro){
        navigation.reset({index:0,routes:[{name:'PerfilMain'}]});
      }else{
        navigation.goBack();
      }
    }catch(e){
      Alert.alert(t('error'),e.message||t('error_guardar_msg'));
    }finally{setSaving(false);}
  }
  return(
    <SafeAreaView style={ss.c} edges={["top"]}>
      <View style={ss.hdr}>
        {route?.params?.desdeRegistro?<View style={{width:50}}/>:<TouchableOpacity onPress={()=>navigation.goBack()}><Text style={ss.back}>{t('volver')}</Text></TouchableOpacity>}
        <Text style={ss.htit}>{t('editar_perfil')}</Text>
        <View style={{width:50}}/>
      </View>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":"height"}>
      <ScrollView contentContainerStyle={{paddingBottom:48}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {route?.params?.desdeRegistro&&(
          <View style={ss.bannerRegistro}>
            <Text style={ss.bannerEmoji}>🚀</Text>
            <View style={{flex:1}}>
              <Text style={ss.bannerTit}>¡Completá tu perfil!</Text>
              <Text style={ss.bannerSub}>Cuanto más completo esté, mayor será el rango de oportunidades a las que podrás aplicar y más ofertas recibirás.</Text>
            </View>
          </View>
        )}
        <View style={ss.avSec}>
          <View style={ss.av}>
            {avatar?<Image source={{uri:avatar}} style={{width:88,height:88,borderRadius:44}}/>:<View style={{width:88,height:88,borderRadius:44,backgroundColor:"#EDE8E2",alignItems:"center",justifyContent:"center"}}><Text style={{fontSize:38,color:"#A898B8"}}>👤</Text></View>}
          </View>
          <TouchableOpacity style={ss.photoBtn} onPress={cambiarFoto} disabled={avatarUploading}>
            <Text style={ss.photoTxt}>{avatarUploading?t('subiendo'):t('cambiar_foto')}</Text>
          </TouchableOpacity>
          <Text style={ss.avatarNota}>Tu foto será privada hasta que decidas aceptar responder a una propuesta laboral</Text>
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>{t('datos_personales').toUpperCase()}</Text>
          <View style={ss.privaNota}><Text style={ss.privaNotaTxt}>{t('aviso_datos_privados')}</Text></View>
          <View style={{flexDirection:"row",gap:10}}>
            <View style={{flex:1}}><Field label={t('primer_nombre')} value={nombre} onChange={setNombre} placeholder={t('nombre')}/></View>
            <View style={{flex:1}}><Field label={t('segundo_nombre')} value={nombre2} onChange={setNombre2} placeholder={t('segundo_nombre')} optional optLbl={t('opcional')}/></View>
          </View>
          <View style={{flexDirection:"row",gap:10}}>
            <View style={{flex:1}}><Field label={t('primer_apellido')} value={apellido1} onChange={setApellido1} placeholder={t('primer_apellido')}/></View>
            <View style={{flex:1}}><Field label={t('segundo_apellido')} value={apellido2} onChange={setApellido2} placeholder={t('segundo_apellido')}/></View>
          </View>
          <FechaNac value={fechaNac} onChange={setFechaNac}/>
          <Single label={t('sexo')} opts={SEXOS} displayOpts={trArray(SEXOS_TR,SEXOS,idioma)} sel={sexo} onSel={setSexo}/>
          <Single label={t('estado_civil')} opts={ESTADOS} displayOpts={trArray(ESTADOS_TR,ESTADOS,idioma)} sel={estadoCivil} onSel={setEstadoCivil} optional optLbl={t('opcional')}/>
          <Field label={t('nacionalidad')} value={nacionalidad} onChange={setNacionalidad} placeholder="Ej: Uruguayo/a"/>
          <View style={ss.fw}>
            <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <Text style={ss.fl}>{t('telefono_lbl')}</Text>
              {telefonoVerificado?(
                <View style={ss.verificadoBadge}><Text style={ss.verificadoTxt}>✓ Verificado</Text></View>
              ):(
                telefono.trim().length>=6&&(
                  <TouchableOpacity style={ss.verificarBtn} onPress={()=>navigation.navigate("VerificarTelefono",{telefono})}>
                    <Text style={ss.verificarTxt}>Verificar</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
            <View style={ss.ib}><TextInput style={ss.fi} value={telefono} onChangeText={v=>{setTelefono(v);if(telefonoVerificado&&v!==telefonoGuardado.current)setTelefonoVerificado(false);}} placeholder="Ej: 099 123 456" placeholderTextColor="#A898B8" keyboardType="phone-pad"/></View>
          </View>
          <Field label={t('descripcion_personal')} value={bio} onChange={setBio} placeholder={t('descripcion_placeholder')} multi/>
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>{t('ubicacion').toUpperCase()}</Text>
          <SearchField label={t('pais')} value={pais} onChange={setPais} placeholder={t('escribe_pais')} suggestions={PAISES} onSelect={v=>{setPais(v);setCiudad("");setBarrio("");}}/>
          <SearchField label={t('ciudad')} value={ciudad} onChange={v=>{setCiudad(v);setBarrio("");}} placeholder={t('escribe_ciudad')} suggestions={ciudadesDisp} onSelect={v=>{setCiudad(v);setBarrio("");}}/>
          <SearchField label={t('barrio_lbl')} value={barrio} onChange={setBarrio} placeholder={t('escribe_barrio')} suggestions={barriosDisp} onSelect={setBarrio}/>
          {barriosDisp.length===0&&ciudad.length>0&&(
            <View style={ss.ubicNota}><Text style={ss.ubicNotaTxt}>{t('ciudad_sin_barrios')}</Text></View>
          )}
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>{t('servicios_profesiones').toUpperCase()}</Text>
          <View style={ss.tabRow}>
            <TouchableOpacity style={[ss.tabBtn,tabAbierto==="serv"&&ss.tabBtnA]} onPress={()=>setTabAbierto(p=>p==="serv"?null:"serv")} activeOpacity={0.8}>
              <Text style={[ss.tabTxt,tabAbierto==="serv"&&ss.tabTxtA]}>{t('tab_servicios')}</Text>
              {(servicios.length>0||otroServActivo)&&<View style={ss.tabBadge}><Text style={ss.tabBadgeTxt}>{servicios.filter(x=>SERVICIOS.includes(x)).length+(otroServActivo?1:0)}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={[ss.tabBtn,tabAbierto==="pro"&&ss.tabBtnA]} onPress={()=>setTabAbierto(p=>p==="pro"?null:"pro")} activeOpacity={0.8}>
              <Text style={[ss.tabTxt,tabAbierto==="pro"&&ss.tabTxtA]}>{t('tab_profesiones_tab')}</Text>
              {(profesiones.length>0||otroProActivo)&&<View style={ss.tabBadge}><Text style={ss.tabBadgeTxt}>{profesiones.filter(x=>PROFESIONES_BASE.includes(x)).length+(otroProActivo?1:0)}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={[ss.tabBtn,tabAbierto==="tec"&&ss.tabBtnA]} onPress={()=>setTabAbierto(p=>p==="tec"?null:"tec")} activeOpacity={0.8}>
              <Text style={[ss.tabTxt,tabAbierto==="tec"&&ss.tabTxtA]}>Tecnicaturas</Text>
              {(tecnicaturas.length>0||otroTecActivo)&&<View style={ss.tabBadge}><Text style={ss.tabBadgeTxt}>{tecnicaturas.length+(otroTecActivo?1:0)}</Text></View>}
            </TouchableOpacity>
            <TouchableOpacity style={[ss.tabBtn,tabAbierto==="lic"&&ss.tabBtnA]} onPress={()=>setTabAbierto(p=>p==="lic"?null:"lic")} activeOpacity={0.8}>
              <Text style={[ss.tabTxt,tabAbierto==="lic"&&ss.tabTxtA]}>Licenciaturas</Text>
              {(licenciaturas.length>0||otroLicActivo)&&<View style={ss.tabBadge}><Text style={ss.tabBadgeTxt}>{licenciaturas.length+(otroLicActivo?1:0)}</Text></View>}
            </TouchableOpacity>
          </View>
          {tabAbierto==="serv"&&(
            <View style={ss.tabContent}>
              <Text style={ss.fl}>{t('selecciona_servicios_lbl')}</Text>
              <View style={ss.cw}>
                {SERVICIOS.filter(s=>s!=="Otro").map(o=>{const s=servicios.includes(o);const lbl=trItem(SERVICIOS_TR,o,idioma)||o;return(<TouchableOpacity key={o} style={[ss.chip,s&&ss.chipA]} onPress={()=>toggleServicio(o)}><Text style={[ss.ct,s&&ss.ctA]}>{lbl}</Text></TouchableOpacity>);})}
                <TouchableOpacity style={[ss.chip,otroServActivo&&ss.chipA]} onPress={toggleOtroServ}><Text style={[ss.ct,otroServActivo&&ss.ctA]}>+ Otro</Text></TouchableOpacity>
              </View>
              {otroServActivo&&<TextInput style={ss.otroInput} value={otroServTxt} onChangeText={setOtroServTxt} placeholder="Escribí tu oficio..." placeholderTextColor="#A898B8" maxLength={50}/>}
            </View>
          )}
          {tabAbierto==="pro"&&(
            <View style={ss.tabContent}>
              {profActiva?(
                <View>
                  <TouchableOpacity style={ss.volverProf} onPress={()=>{setProfActiva(null);setSubEsp([]);setProfesiones(p=>p.filter(x=>x!==profActiva));}}><Text style={ss.volverProfTxt}>{t('tab_profesiones_tab')}</Text></TouchableOpacity>
                  <View style={[ss.chipA,{alignSelf:"flex-start",marginBottom:12,paddingHorizontal:14,paddingVertical:8,borderRadius:20}]}><Text style={ss.ctA}>{trItem(PROFESIONES_TR,profActiva,idioma)}</Text></View>
                  <Text style={ss.fl}>{t('selecciona_especialidad')}</Text>
                  <View style={ss.cw}>
                    {(SUBCATS[profActiva]||[]).map(o=>{const s=subEsp.includes(o);const lbl=trItem(SUBCATS_TR,o,idioma);return(<TouchableOpacity key={o} style={[ss.chip,s&&ss.chipA]} onPress={()=>toggleArr(subEsp,setSubEsp,o)}><Text style={[ss.ct,s&&ss.ctA]}>{lbl}</Text></TouchableOpacity>);})}
                  </View>
                </View>
              ):(
                <View>
                  <Text style={ss.fl}>{t('selecciona_profesiones')}</Text>
                  <View style={ss.cw}>
                    {PROFESIONES_BASE.filter(p=>p!=="Otro").map(o=>{const s=profesiones.includes(o);const lbl=trItem(PROFESIONES_TR,o,idioma);return(<TouchableOpacity key={o} style={[ss.chip,s&&ss.chipA]} onPress={()=>toggleProf(o)}><Text style={[ss.ct,s&&ss.ctA]}>{lbl}</Text></TouchableOpacity>);})}
                    <TouchableOpacity style={[ss.chip,otroProActivo&&ss.chipA]} onPress={toggleOtroPro}><Text style={[ss.ct,otroProActivo&&ss.ctA]}>+ Otro</Text></TouchableOpacity>
                  </View>
                  {otroProActivo&&<TextInput style={ss.otroInput} value={otroProTxt} onChangeText={setOtroProTxt} placeholder="Escribí tu profesión..." placeholderTextColor="#A898B8" maxLength={50}/>}
                </View>
              )}
              <View style={ss.avisoBox}><Text style={ss.avisoTxt}>{t('aviso_documentacion')}</Text></View>
            </View>
          )}
          {tabAbierto==="tec"&&(
            <View style={ss.tabContent}>
              <Text style={ss.fl}>Seleccioná hasta 3 tecnicaturas cursadas o en curso</Text>
              <View style={ss.cw}>
                {(TECNICATURAS_POR_PAIS[pais]||TECNICATURAS_POR_PAIS["Comunes"]).map(o=>{const s=tecnicaturas.includes(o);return(<TouchableOpacity key={o} style={[ss.chip,s&&ss.chipA]} onPress={()=>toggleTec(o)}><Text style={[ss.ct,s&&ss.ctA]}>{o}</Text></TouchableOpacity>);})}
                <TouchableOpacity style={[ss.chip,otroTecActivo&&ss.chipA]} onPress={toggleOtroTec}><Text style={[ss.ct,otroTecActivo&&ss.ctA]}>+ Otro</Text></TouchableOpacity>
              </View>
              {otroTecActivo&&<TextInput style={ss.otroInput} value={otroTecTxt} onChangeText={setOtroTecTxt} placeholder="Escribí tu tecnicatura..." placeholderTextColor="#A898B8" maxLength={50}/>}
            </View>
          )}
          {tabAbierto==="lic"&&(
            <View style={ss.tabContent}>
              <Text style={ss.fl}>Seleccioná tus licenciaturas universitarias cursadas o en curso</Text>
              <View style={ss.cw}>
                {(LICENCIATURAS_POR_PAIS[pais]||LICENCIATURAS_POR_PAIS["Comunes"]).map(o=>{const s=licenciaturas.includes(o);return(<TouchableOpacity key={o} style={[ss.chip,s&&ss.chipA]} onPress={()=>toggleLic(o)}><Text style={[ss.ct,s&&ss.ctA]}>{o}</Text></TouchableOpacity>);})}
                <TouchableOpacity style={[ss.chip,otroLicActivo&&ss.chipA]} onPress={toggleOtroLic}><Text style={[ss.ct,otroLicActivo&&ss.ctA]}>+ Otra</Text></TouchableOpacity>
              </View>
              {otroLicActivo&&<TextInput style={ss.otroInput} value={otroLicTxt} onChangeText={setOtroLicTxt} placeholder="Escribí tu licenciatura..." placeholderTextColor="#A898B8" maxLength={60}/>}
            </View>
          )}
        </View>
        {/* Búsqueda inteligente — para usuarios sin categorías formales */}
        <View style={ss.sec}>
          <Text style={[ss.stit,{fontWeight:"900",color:"#1A1020"}]}>BÚSQUEDA DIARIA DE LLAMADOS</Text>
          <Text style={{fontSize:13,color:"#A898B8",marginBottom:12,lineHeight:19}}>
            Si no encontrás tu oficio en la lista de arriba, describí con tus palabras qué podés hacer. Konexu va a buscar oportunidades que coincidan en diarios y portales de tu zona.
          </Text>
          <CampoConSugerencias
            value={descripcionLibre}
            onChange={v=>setDescripcionLibre(v.slice(0,500))}
          />
          <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:12,paddingVertical:12,paddingHorizontal:4,borderTopWidth:1,borderTopColor:"#EDE8E2"}}>
            <View style={{flex:1,marginRight:16}}>
              <Text style={{fontSize:14,fontWeight:"700",color:"#1A1020",marginBottom:3}}>Buscar llamados para mí cada día</Text>
              <Text style={{fontSize:12,color:"#A898B8",lineHeight:17}}>Recibís una notificación cada mañana con oportunidades nuevas que coincidan con lo que ofrecés</Text>
            </View>
            <Switch
              value={busquedaDiariaOn}
              onValueChange={setBusquedaDiariaOn}
              trackColor={{false:"#EDE8E2",true:"#2DD4BF"}}
              thumbColor={busquedaDiariaOn?"#0D9488":"#f4f3f4"}
            />
          </View>
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>{t('disponibilidad_lbl').toUpperCase()}</Text>
          <Single label={t('disponibilidad_lbl')} opts={DISPS} displayOpts={trArray(DISPS_TR,DISPS,idioma)} sel={disp} onSel={setDisp}/>
          <Chips label={t('tipo_empleo_buscas')} opts={TIPOS} displayOpts={trArray(TIPOS_TR,TIPOS,idioma)} sel={tipos} onToggle={v=>toggleArr(tipos,setTipos,v)}/>
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>{t('sec_idiomas_hdr')}</Text>
          <Chips label={t('idiomas_hablas')} opts={LANGS} displayOpts={trArray(LANGS_TR,LANGS,idioma)} sel={langs} onToggle={v=>toggleArr(langs,setLangs,v)}/>
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>{t('sec_extras_hdr')}</Text>
          <View style={ss.swRow}>
            <View style={{flex:1}}><Text style={ss.swLbl}>{t('tengo_referencias')}</Text><Text style={ss.swSub}>{t('referencias_sub')}</Text></View>
            <Switch value={refs} onValueChange={setRefs} trackColor={{false:"#EDE8E2",true:"#E8785A"}} thumbColor="#FFFFFF"/>
          </View>
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>{t('sec_exp_salarial')}</Text>
          <Field label={t('anios_exp_lbl')} value={aniosExp} onChange={setAniosExp} placeholder="Ej: 5" keyboard="numeric"/>
          <Single label={t('moneda_lbl')} opts={monedasDisp} sel={sueldoMoneda||monedasDisp[0]} onSel={setSueldoMoneda}/>
          <View style={ss.fw}>
            <Text style={ss.fl}>Rango de salario al que aspirás</Text>
            <View style={{flexDirection:"row",gap:10}}>
              <View style={{flex:1}}>
                <Text style={ss.fl}>Mínimo</Text>
                <View style={[ss.fi,{flexDirection:"row",alignItems:"center",paddingVertical:0,height:52}]}>
                  <Text style={{fontSize:13,fontWeight:"700",color:"#5A4E6A",marginRight:4}}>{SIMBOLOS_MONEDA[sueldoMoneda||monedasDisp[0]]||sueldoMoneda}</Text>
                  <TextInput style={{flex:1,fontSize:14,color:"#1A1020"}} value={sueldoMin} onChangeText={setSueldoMin} placeholder="500" placeholderTextColor="#A898B8" keyboardType="numeric"/>
                </View>
              </View>
              <View style={{flex:1}}>
                <Text style={ss.fl}>Máximo</Text>
                <View style={[ss.fi,{flexDirection:"row",alignItems:"center",paddingVertical:0,height:52}]}>
                  <Text style={{fontSize:13,fontWeight:"700",color:"#5A4E6A",marginRight:4}}>{SIMBOLOS_MONEDA[sueldoMoneda||monedasDisp[0]]||sueldoMoneda}</Text>
                  <TextInput style={{flex:1,fontSize:14,color:"#1A1020"}} value={sueldoMax} onChangeText={setSueldoMax} placeholder="800" placeholderTextColor="#A898B8" keyboardType="numeric"/>
                </View>
              </View>
            </View>
          </View>
        </View>
        <View style={ss.sec}>
          <Text style={ss.stit}>{t('sec_visibilidad')}</Text>
          <View style={ss.swRow}>
            <View style={{flex:1}}><Text style={ss.swLbl}>{t('perfil_siempre_visible')}</Text><Text style={ss.swSub}>{vis?'Ahora todos tus datos serán visibles para los empleadores o empresas registradas, cuando tu perfil coincida con los requerimientos de su búsqueda.':t('visible_sub')}</Text></View>
            <Switch value={vis} onValueChange={setVis} trackColor={{false:"#EDE8E2",true:"#E8785A"}} thumbColor="#FFFFFF"/>
          </View>
        </View>
        <TouchableOpacity style={ss.btnW} onPress={guardar} disabled={saving}>
          <LinearGradient colors={["#E8785A","#D4614A"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            <Text style={ss.btnT}>{saving?t('guardando'):t('guardar_cambios')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:"#F4EFE9"},
  bannerRegistro:{flexDirection:"row",alignItems:"flex-start",gap:12,margin:16,marginBottom:0,backgroundColor:"#0F172A",borderRadius:14,padding:16},
  bannerEmoji:{fontSize:28,marginTop:2},
  bannerTit:{fontSize:15,fontWeight:"900",color:"#FFFFFF",marginBottom:4},
  bannerSub:{fontSize:13,color:"rgba(255,255,255,0.75)",lineHeight:19},
  hdr:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingVertical:14,backgroundColor:"#FFFFFF",borderBottomWidth:1,borderBottomColor:"#EDE8E2"},
  back:{fontSize:14,fontWeight:"700",color:"#E8785A"},
  htit:{fontSize:16,fontWeight:"800",color:"#1A1020"},
  avSec:{alignItems:"center",paddingVertical:24,backgroundColor:"#E8DDD3",marginBottom:16,borderRadius:16},
  av:{width:88,height:88,borderRadius:44,backgroundColor:"#E8785A",alignItems:"center",justifyContent:"center",marginBottom:10},
  photoBtn:{paddingHorizontal:16,paddingVertical:6,backgroundColor:"#FEF3F0",borderRadius:20},
  photoTxt:{fontSize:13,fontWeight:"700",color:"#E8785A"},
  avatarNota:{fontSize:11,color:"#A898B8",marginTop:8,textAlign:"center"},
  sec:{marginHorizontal:16,marginBottom:16},
  stit:{fontSize:10,fontWeight:"700",color:"#A898B8",letterSpacing:1,marginBottom:10},
  privaNota:{backgroundColor:"#FEF3F0",borderRadius:8,padding:10,marginBottom:12,borderLeftWidth:3,borderLeftColor:"#E8785A"},
  privaNotaTxt:{fontSize:12,color:"#C4614A",lineHeight:18},
  fw:{marginBottom:14},
  flRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:6},
  fl:{fontSize:12,fontWeight:"700",color:"#5A4E6A",marginBottom:6},
  opt:{fontSize:10,color:"#A898B8",fontStyle:"italic"},
  fi:{backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:14,color:"#1A1020"},
  sugg:{backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#EDE8E2",borderRadius:10,marginTop:4,overflow:"hidden"},
  suggI:{paddingHorizontal:14,paddingVertical:12,borderBottomWidth:1,borderBottomColor:"#EDE8E2"},
  suggT:{fontSize:14,color:"#1A1020"},
  ubicNota:{backgroundColor:"#FEF3F0",borderRadius:8,padding:10,marginTop:4,borderLeftWidth:3,borderLeftColor:"#E8785A"},
  ubicNotaTxt:{fontSize:12,color:"#C4614A",lineHeight:18},
  cw:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:8},
  chip:{paddingHorizontal:12,paddingVertical:6,backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:20},
  chipA:{backgroundColor:"#E8785A",borderColor:"#E8785A"},
  ct:{fontSize:12,fontWeight:"600",color:"#5A4E6A"},
  ctA:{color:"#FFFFFF"},
  tabRow:{flexDirection:"row",flexWrap:"wrap",gap:10,marginBottom:8},
  tabBtn:{width:"48%",paddingVertical:18,paddingHorizontal:8,backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#E0D8EE",borderBottomWidth:4,borderBottomColor:"#BEB0D0",borderRadius:14,alignItems:"center",flexDirection:"row",justifyContent:"center",gap:6,shadowColor:"#4A3E6A",shadowOffset:{width:0,height:3},shadowOpacity:0.13,shadowRadius:6,elevation:4},
  tabBtnA:{backgroundColor:"#FEF3F0",borderColor:"#E8785A",borderBottomColor:"#B85A3A",shadowOpacity:0.06,elevation:1,transform:[{translateY:2}]},
  tabTxt:{fontSize:13,fontWeight:"700",color:"#5A4E6A",textAlign:"center"},
  tabTxtA:{color:"#E8785A"},
  tabBadge:{backgroundColor:"#E8785A",borderRadius:10,paddingHorizontal:6,paddingVertical:1},
  tabBadgeTxt:{fontSize:10,fontWeight:"800",color:"#FFFFFF"},
  tabContent:{paddingTop:4,paddingBottom:8},
  otroInput:{backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#E8785A",borderRadius:10,paddingHorizontal:14,paddingVertical:10,fontSize:14,color:"#1A1020",marginTop:8},
  avisoBox:{backgroundColor:"#FEF3F0",borderRadius:10,padding:12,marginTop:8,borderLeftWidth:3,borderLeftColor:"#E8785A"},
  avisoTxt:{fontSize:12,color:"#C4614A",lineHeight:18},
  swRow:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFFFFF",borderRadius:12,padding:14,borderWidth:1,borderColor:"#EDE8E2",gap:12,marginBottom:10},
  swLbl:{fontSize:14,fontWeight:"600",color:"#1A1020",marginBottom:3},
  swSub:{fontSize:12,color:"#A898B8",lineHeight:17},
  volverProf:{marginBottom:12,paddingVertical:6},
  volverProfTxt:{fontSize:14,fontWeight:"700",color:"#E8785A",textDecorationLine:"underline"},
  btnW:{marginHorizontal:16,marginTop:8,borderRadius:14,overflow:"hidden"},
  btn:{paddingVertical:16,alignItems:"center"},
  btnT:{color:"#FFFFFF",fontSize:16,fontWeight:"800"},
  ib:{flexDirection:"row",alignItems:"center",backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:10,paddingHorizontal:14,height:52},
  verificadoBadge:{backgroundColor:"#FEF3F0",paddingHorizontal:10,paddingVertical:3,borderRadius:20,borderWidth:1,borderColor:"#E8785A"},
  verificadoTxt:{fontSize:11,fontWeight:"700",color:"#E8785A"},
  verificarBtn:{backgroundColor:"#FEF3F0",paddingHorizontal:10,paddingVertical:3,borderRadius:20,borderWidth:1,borderColor:"#E8785A"},
  verificarTxt:{fontSize:11,fontWeight:"700",color:"#E8785A"},
});
