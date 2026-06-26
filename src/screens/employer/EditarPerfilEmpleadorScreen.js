import React,{useState,useEffect} from 'react';
import {logError} from '../../services/logError';
import{View,Text,StyleSheet,TouchableOpacity,TextInput,ScrollView,Alert,KeyboardAvoidingView,Platform}from 'react-native';
import{SafeAreaView}from 'react-native-safe-area-context';
import{LinearGradient}from 'expo-linear-gradient';
import{supabase}from '../../services/supabase';

const PAISES=["Uruguay","Argentina","Brasil","Chile","Paraguay","Bolivia","Peru","Colombia","Mexico","Ecuador","Venezuela","Cuba","Costa Rica","Panama","Guatemala","El Salvador","Honduras","Nicaragua","Republica Dominicana","Spain","Portugal","France","Italy","Germany","United Kingdom","United States","Canada","Australia","Sweden","Norway","Japan","India","Otro"];
const CIUDADES_POR_PAIS={"Uruguay":["Montevideo","Salto","Paysandu","Las Piedras","Rivera","Maldonado","Tacuarembo","Melo","Mercedes","Rocha","Colonia"],"Argentina":["Buenos Aires","Cordoba","Rosario","Mendoza","Tucuman","La Plata","Mar del Plata","Salta","Santa Fe"],"Brasil":["Sao Paulo","Rio de Janeiro","Brasilia","Salvador","Fortaleza","Belo Horizonte","Curitiba","Recife","Porto Alegre"],"Chile":["Santiago","Valparaiso","Concepcion","La Serena","Antofagasta","Temuco","Rancagua"],"Paraguay":["Asuncion","Ciudad del Este","San Lorenzo","Luque","Encarnacion"],"Bolivia":["La Paz","Santa Cruz","Cochabamba","Sucre","Oruro"],"Peru":["Lima","Arequipa","Trujillo","Chiclayo","Piura"],"Colombia":["Bogota","Medellin","Cali","Barranquilla","Cartagena"],"Mexico":["Ciudad de Mexico","Guadalajara","Monterrey","Puebla","Toluca"],"Ecuador":["Guayaquil","Quito","Cuenca","Santo Domingo"],"Venezuela":["Caracas","Maracaibo","Valencia","Barquisimeto","Maracay"],"Cuba":["La Habana","Santiago de Cuba","Camaguey","Holguin"],"Costa Rica":["San Jose","Alajuela","Cartago","Heredia"],"Panama":["Ciudad de Panama","Colon","David","Santiago"],"Guatemala":["Ciudad de Guatemala","Quetzaltenango","Antigua"],"El Salvador":["San Salvador","Santa Ana","San Miguel"],"Honduras":["Tegucigalpa","San Pedro Sula","La Ceiba"],"Nicaragua":["Managua","Leon","Masaya","Granada"],"Republica Dominicana":["Santo Domingo","Santiago","La Romana"],"Spain":["Madrid","Barcelona","Valencia","Sevilla","Zaragoza","Malaga","Bilbao"],"Portugal":["Lisbon","Porto","Braga","Coimbra"],"France":["Paris","Lyon","Marseille","Toulouse","Nice","Bordeaux"],"Italy":["Rome","Milan","Naples","Turin","Palermo","Bologna"],"Germany":["Berlin","Hamburg","Munich","Cologne","Frankfurt","Stuttgart"],"United Kingdom":["London","Birmingham","Manchester","Glasgow","Liverpool","Edinburgh"],"United States":["New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","Dallas","San Diego"],"Canada":["Toronto","Montreal","Vancouver","Calgary","Edmonton","Ottawa"],"Australia":["Sydney","Melbourne","Brisbane","Perth","Adelaide","Canberra"],"Sweden":["Stockholm","Gothenburg","Malmo","Uppsala","Vasteras"],"Norway":["Oslo","Bergen","Trondheim","Stavanger","Drammen"],"Japan":["Tokyo","Osaka","Kyoto","Nagoya","Sapporo","Fukuoka","Kobe"],"India":["Mumbai","Delhi","Bangalore","Hyderabad","Chennai","Kolkata","Pune","Ahmedabad"]};
const ESCOLARIDAD=["Sin requisito","Primaria completa","Secundaria completa","Terciario/Universidad","Posgrado"];
const IDIOMAS=["Espanol","Portugues","Ingles","Frances","Italiano","Aleman","Otro"];
const CARGAS=["Tiempo completo","Medio tiempo","Por horas","Por tarea","A convenir"];
const SUELDO_TIPO=["Monto fijo","A acordar","Por hora","Por tarea"];
const TODOS_OFICIOS=["Niñera","Limpieza","Plomero","Electricista","Jardinero","Cocinero","Albañil","Pintor","Cuidado de animales","Chofer","Mucama","Carpintero","Mecanico","Guardia","Sereno","Mozo","Repostero","Costurero","Peluquero","Esteticista","Mudanzas","Delivery","Recepcionista","Cajero/a","Operador/a de produccion","Auxiliar de deposito","Operador/a de empilhadeira","Teleoperador/a","Manicura/Pedicura","Panadero/a","Cerrajero","Techista","Tapicero","Promotor/a de ventas","Masajista","Lavador/a de autos","Medico","Abogado","Contador","Ingeniero","Arquitecto","Psicologo","Enfermero","Veterinario","Docente","Programador","Diseñador","Fotografo","Gasista","Herrero","Soldador","Otro"];

function Field({label,value,onChange,placeholder,multi,keyboard,optional}){
  return(
    <View style={ss.fw}>
      <View style={ss.flRow}>
        <Text style={ss.fl}>{label}</Text>
        {optional&&<Text style={ss.opt}>Opcional</Text>}
      </View>
      <TextInput style={[ss.fi,multi&&{height:80,textAlignVertical:"top"}]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#A898B8" multiline={multi} keyboardType={keyboard||"default"}/>
    </View>
  );
}

function SearchField({label,value,onChange,placeholder,suggestions,onSelect,optional}){
  const filtered=suggestions.filter(s=>s.toLowerCase().includes(value.toLowerCase())&&value.length>1);
  return(
    <View style={ss.fw}>
      <View style={ss.flRow}>
        <Text style={ss.fl}>{label}</Text>
        {optional&&<Text style={ss.opt}>Opcional</Text>}
      </View>
      <TextInput style={ss.fi} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#A898B8" autoCorrect={false}/>
      {filtered.length>0&&(
        <View style={ss.cw}>
          {filtered.slice(0,8).map(s=>(<TouchableOpacity key={s} style={ss.chip} onPress={()=>onSelect(s)}><Text style={ss.ct}>{s}</Text></TouchableOpacity>))}
        </View>
      )}
    </View>
  );
}

function Chips({label,opts,sel,onToggle,optional}){
  return(
    <View style={ss.fw}>
      <View style={ss.flRow}>
        <Text style={ss.fl}>{label}</Text>
        {optional&&<Text style={ss.opt}>Opcional</Text>}
      </View>
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

export default function EditarPerfilEmpleadorScreen({navigation}){
  const[nombre,setNombre]=useState("");
  const[pais,setPais]=useState("");
  const[ciudad,setCiudad]=useState("");
  const[direccion,setDireccion]=useState("");
  const[barrio,setBarrio]=useState("");
  const[telefono,setTelefono]=useState("");
  const[apellido1,setApellido1]=useState("");
  const[saving,setSaving]=useState(false);

  const[empleoBuscado,setEmpleoBuscado]=useState("");
  const[titulo,setTitulo]=useState("");
  const[descripcion,setDescripcion]=useState("");
  const[sueldoMin,setSueldoMin]=useState("");
  const[sueldoMax,setSueldoMax]=useState("");
  const[sueldoTipo,setSueldoTipo]=useState("A acordar");
  const[lugar,setLugar]=useState("");
  const[cargaHoraria,setCargaHoraria]=useState("");
  const[idiomas,setIdiomas]=useState([]);
  const[escolaridad,setEscolaridad]=useState("");
  const[habilidades,setHabilidades]=useState("");

  useEffect(()=>{
    async function detectarPais(){
      try{
        if(!pais){
          const res=await fetch('https://ipapi.co/json/');
          const data=await res.json();
          if(data.country_name){
            const mapa={'Uruguay':'Uruguay','Argentina':'Argentina','Brazil':'Brasil','Chile':'Chile','Paraguay':'Paraguay','Bolivia':'Bolivia','Peru':'Peru','Colombia':'Colombia','Mexico':'Mexico','Ecuador':'Ecuador','Venezuela':'Venezuela','Cuba':'Cuba','Costa Rica':'Costa Rica','Panama':'Panama','Guatemala':'Guatemala','El Salvador':'El Salvador','Honduras':'Honduras','Nicaragua':'Nicaragua','Dominican Republic':'Republica Dominicana','Spain':'Spain','Portugal':'Portugal','France':'France','Italy':'Italy','Germany':'Germany','United Kingdom':'United Kingdom','United States':'United States','Canada':'Canada','Australia':'Australia','Sweden':'Sweden','Norway':'Norway','Japan':'Japan','India':'India'};
            const paisMapeado=mapa[data.country_name]||data.country_name;
            if(PAISES.includes(paisMapeado))setPais(paisMapeado);
          }
        }
      }catch(e){}
    }
    detectarPais();
  },[]);

  const ciudadesDisp=CIUDADES_POR_PAIS[pais]||[];

  useEffect(()=>{
    async function cargar(){
      try{
        const{data:{user}}=await supabase.auth.getUser();
        if(!user)return;
        const{data}=await supabase.from("profiles").select("*").eq("id",user.id).single();
        if(data){
          if(data.nombre)setNombre(data.nombre);
          if(data.apellido1)setApellido1(data.apellido1);
          if(data.telefono)setTelefono(data.telefono);
          if(data.pais)setPais(data.pais);
          if(data.ciudad)setCiudad(data.ciudad);
          if(data.direccion)setDireccion(data.direccion);
          if(data.barrio)setBarrio(data.barrio);
          if(data.empleo_buscado)setEmpleoBuscado(data.empleo_buscado);
        }
      }catch(e){logError('EditarPerfilEmpleador',e);}
    }
    cargar();
  },[]);

  function toggleArr(arr,setArr,v){setArr(p=>p.includes(v)?p.filter(x=>x!==v):[...p,v]);}

  async function guardar(){
    if(nombre.trim().length<1){Alert.alert("Campos incompletos","El nombre es obligatorio");return;}
    if(apellido1.trim().length<1){Alert.alert("Campos incompletos","El apellido es obligatorio");return;}
    if(!pais){Alert.alert("Campos incompletos","El pais es obligatorio");return;}
    if(!ciudad){Alert.alert("Campos incompletos","La ciudad es obligatoria");return;}
    if(!direccion){Alert.alert("Campos incompletos","La direccion es obligatoria");return;}
    if(!empleoBuscado){Alert.alert("Campos incompletos","Debes indicar que tipo de trabajo ofreces");return;}
    if(!lugar){Alert.alert("Campos incompletos","Debes indicar donde se realizara el trabajo");return;}
    setSaving(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user){navigation.navigate("Login");return;}

      const{error:errPerfil}=await supabase.from("profiles").upsert({
        id:user.id,
        nombre,apellido1,pais,ciudad,direccion,barrio,telefono,
        empleo_buscado:empleoBuscado,
        rol:"employer",
        updated_at:new Date().toISOString(),
      });
      if(errPerfil)throw errPerfil;

      if(titulo.trim().length>0){
        const{error:errOferta}=await supabase.from("ofertas").insert({
          employer_id:user.id,
          titulo,descripcion,
          empleo:empleoBuscado,
          sueldo_min:sueldoMin?parseFloat(sueldoMin):null,
          sueldo_max:sueldoMax?parseFloat(sueldoMax):null,
          sueldo_tipo:sueldoTipo,
          lugar:lugar||ciudad,
          carga_horaria:cargaHoraria,
          idiomas,escolaridad,
          habilidades:habilidades?habilidades.split(",").map(h=>h.trim()):[],
          ciudad,pais,
        });
        if(errOferta)throw errOferta;
      }

      Alert.alert("Perfil actualizado","Tu busqueda fue publicada. Los trabajadores que coincidan con tu perfil seran notificados.",[{text:"OK",onPress:()=>navigation.goBack()}]);
    }catch(e){Alert.alert("Error",e.message||"No se pudo guardar");}
    finally{setSaving(false);}
  }

  return(
    <SafeAreaView style={ss.c} edges={["top"]}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={()=>navigation.goBack()}><Text style={ss.back}>Volver</Text></TouchableOpacity>
        <Text style={ss.htit}>Nueva busqueda de trabajador</Text>
        <View style={{width:50}}/>
      </View>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":"height"}>
      <ScrollView contentContainerStyle={{paddingBottom:48}} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={ss.sec}>
          <Text style={ss.stit}>DATOS PERSONALES</Text>
          <View style={ss.privaNota}><Text style={ss.privaNotaTxt}>Tu identidad es anonima para el trabajador hasta que ambos decidan contactarse.</Text></View>
          <View style={{flexDirection:"row",gap:10}}>
            <View style={{flex:1}}><Field label="Nombre" value={nombre} onChange={setNombre} placeholder="Nombre"/></View>
            <View style={{flex:1}}><Field label="Apellido" value={apellido1} onChange={setApellido1} placeholder="Apellido"/></View>
          </View>
          <Field label="Telefono" value={telefono} onChange={setTelefono} placeholder="Ej: 099 123 456" keyboard="phone-pad"/>
          <SearchField label="Pais" value={pais} onChange={setPais} placeholder="Tu pais..." suggestions={PAISES} onSelect={v=>{setPais(v);setCiudad("");}}/>
          <SearchField label="Ciudad" value={ciudad} onChange={setCiudad} placeholder="Tu ciudad..." suggestions={ciudadesDisp} onSelect={setCiudad}/>
          <Field label="Barrio" value={barrio} onChange={setBarrio} placeholder="Ej: Pocitos, Palermo" optional/>
          <Field label="Direccion" value={direccion} onChange={setDireccion} placeholder="Ej: Av. Italia 1234" optional/>
        </View>

        <View style={[ss.sec,{zIndex:200,elevation:200}]}>
          <Text style={ss.stit}>QUE BUSCO</Text>
          <View style={ss.fw}>
            <Text style={ss.fl}>Oficio o profesion que buscas</Text>
            <TouchableOpacity style={[ss.fi,{justifyContent:"center"}]} onPress={()=>navigation.navigate("SelectorOficio",{onSelect:setEmpleoBuscado})}>
              <Text style={{fontSize:14,color:empleoBuscado?"#1A1020":"#A898B8"}}>{empleoBuscado||"Ej: Electricista, Niñera, Contador..."}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={ss.sec}>
          <Text style={ss.stit}>OFERTA DE TRABAJO</Text>
          <View style={ss.infoBanner}><Text style={ss.infoBannerTxt}>Completa los detalles del puesto. Podes publicar varias ofertas desde tu perfil.</Text></View>
          <Field label="Titulo del puesto" value={titulo} onChange={setTitulo} placeholder="Ej: Niñera para 2 ninos" optional/>
          <Field label="Descripcion del puesto" value={descripcion} onChange={setDescripcion} placeholder="Describe el puesto con detalle..." multi optional/>
          <Field label="Lugar donde se realizara la tarea" value={lugar} onChange={setLugar} placeholder="Ej: En mi domicilio, Remoto, A convenir" optional/>
          <Single label="Carga horaria" opts={CARGAS} sel={cargaHoraria} onSel={setCargaHoraria} optional/>
        </View>

        <View style={ss.sec}>
          <Text style={ss.stit}>REMUNERACION</Text>
          <Single label="Tipo de pago" opts={SUELDO_TIPO} sel={sueldoTipo} onSel={setSueldoTipo} optional/>
          {sueldoTipo==="Monto fijo"&&(
            <Field label="Monto" value={sueldoMin} onChange={setSueldoMin} placeholder="Ej: 500" keyboard="numeric" optional/>
          )}
          {(sueldoTipo==="Por hora"||sueldoTipo==="Por tarea")&&(
            <View style={{flexDirection:"row",gap:10}}>
              <View style={{flex:1}}><Field label="Minimo" value={sueldoMin} onChange={setSueldoMin} placeholder="Ej: 10" keyboard="numeric" optional/></View>
              <View style={{flex:1}}><Field label="Maximo" value={sueldoMax} onChange={setSueldoMax} placeholder="Ej: 20" keyboard="numeric" optional/></View>
            </View>
          )}
        </View>

        <View style={ss.sec}>
          <Text style={ss.stit}>REQUISITOS</Text>
          <Single label="Escolaridad minima" opts={ESCOLARIDAD} sel={escolaridad} onSel={setEscolaridad} optional/>
          <Chips label="Idiomas requeridos" opts={IDIOMAS} sel={idiomas} onToggle={v=>toggleArr(idiomas,setIdiomas,v)} optional/>
          <Field label="Habilidades especiales" value={habilidades} onChange={setHabilidades} placeholder="Ej: Manejo de auto, Primeros auxilios (separar con coma)" optional/>
        </View>

        <TouchableOpacity style={ss.btnW} onPress={guardar} disabled={saving}>
          <LinearGradient colors={["#E8785A","#D4614A"]} start={{x:0,y:0}} end={{x:1,y:0}} style={ss.btn}>
            <Text style={ss.btnT}>{saving?"Publicando...":"Confirmar busqueda"}</Text>
          </LinearGradient>
        </TouchableOpacity>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:"#FBF8F4"},
  hdr:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingVertical:14,backgroundColor:"#FFFFFF",borderBottomWidth:1,borderBottomColor:"#EDE8E2"},
  back:{fontSize:14,fontWeight:"700",color:"#2DD4BF"},htit:{fontSize:16,fontWeight:"800",color:"#1A1020",marginLeft:8},
  sec:{marginHorizontal:16,marginBottom:16,marginTop:8},
  stit:{fontSize:10,fontWeight:"700",color:"#A898B8",letterSpacing:1,marginBottom:10},
  privaNota:{backgroundColor:"#F0FDFA",borderRadius:8,padding:10,marginBottom:12,borderLeftWidth:3,borderLeftColor:"#2DD4BF"},
  privaNotaTxt:{fontSize:12,color:"#2DD4BF",lineHeight:18},
  infoBanner:{backgroundColor:"#E6FBF5",borderRadius:8,padding:10,marginBottom:12,borderLeftWidth:3,borderLeftColor:"#3DA882"},
  infoBannerTxt:{fontSize:12,color:"#2E9472",lineHeight:18},
  fw:{marginBottom:14},flRow:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:6},
  fl:{fontSize:12,fontWeight:"700",color:"#5A4E6A",marginBottom:6},
  opt:{fontSize:10,color:"#A898B8",fontStyle:"italic"},
  fi:{backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:10,paddingHorizontal:14,paddingVertical:12,fontSize:14,color:"#1A1020"},
  sugg:{backgroundColor:"#FFFFFF",borderWidth:1,borderColor:"#EDE8E2",borderRadius:10,marginTop:4,overflow:"hidden"},
  suggI:{paddingHorizontal:14,paddingVertical:12,borderBottomWidth:1,borderBottomColor:"#EDE8E2"},
  suggT:{fontSize:14,color:"#1A1020"},
  cw:{flexDirection:"row",flexWrap:"wrap",gap:8,marginBottom:8},
  chip:{paddingHorizontal:12,paddingVertical:6,backgroundColor:"#FFFFFF",borderWidth:1.5,borderColor:"#EDE8E2",borderRadius:20},
  chipA:{backgroundColor:"#2DD4BF",borderColor:"#2DD4BF"},ct:{fontSize:12,fontWeight:"600",color:"#5A4E6A"},ctA:{color:"#FFFFFF"},
  btnW:{marginHorizontal:16,marginTop:8,borderRadius:14,overflow:"hidden"},
  btn:{paddingVertical:16,alignItems:"center"},btnT:{color:"#FFFFFF",fontSize:16,fontWeight:"800"},
});
