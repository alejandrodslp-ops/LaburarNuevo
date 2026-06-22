import React,{useState} from "react";
import{View,Text,StyleSheet,TouchableOpacity,ActivityIndicator}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{supabase}from "../../services/supabase";

const C={coral:"#E8785A",teal:"#2DD4BF",blanco:"#FFFFFF",crema:"#FBF8F4",borde:"#EDE8E2",texto1:"#1A1020",texto2:"#5A4E6A",texto3:"#A898B8"};

const MOTIVOS=[
  {id:"ubicacion",    emoji:"📍", label:"La ubicación no me conviene"},
  {id:"carga_horaria",emoji:"🕐", label:"La carga horaria no me viene bien"},
  {id:"remuneracion", emoji:"💰", label:"La remuneración no es suficiente"},
  {id:"otro",         emoji:"💬", label:"Otro motivo"},
];

export default function EncuestaRechazoScreen({navigation,route}){
  const{propuesta}=route.params||{};
  const[seleccion,setSeleccion]=useState(null);
  const[cargando,setCargando]=useState(false);

  async function enviar(){
    if(!seleccion)return;
    setCargando(true);
    try{
      await supabase.from("propuestas")
        .update({
          estado:"rechazada",
          motivo_rechazo:seleccion,
          respondida_at:new Date().toISOString(),
        })
        .eq("id",propuesta.id);

      // Notificar brevemente al empleador (sin revelar el motivo)
      await supabase.from("mensajes").insert({
        sender_id:propuesta.worker_id,
        receiver_id:propuesta.employer_id,
        texto:"Gracias por considerar mi perfil. En este momento no estoy disponible para esta propuesta.",
        leido:false,
      }).catch(()=>{});

      // Push al empleador
      supabase.functions.invoke("notificar-propuesta",{
        body:{
          user_id:propuesta.employer_id,
          titulo:"El trabajador no está disponible",
          cuerpo:"Respondió que por ahora no puede tomar la propuesta. Podés seguir buscando en Konexu.",
          pantalla:"Mensajes",
        },
      }).catch(()=>{});

    }catch(e){}finally{setCargando(false);}

    // Volver a la lista de mensajes
    navigation.navigate("MensajesList");
  }

  return(
    <SafeAreaView style={ss.c} edges={["top"]}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={()=>navigation.goBack()} style={ss.backBtn}>
          <Text style={ss.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={ss.hdrTit}>Una pregunta rápida</Text>
        <View style={{width:40}}/>
      </View>

      <View style={ss.body}>
        <Text style={ss.pregunta}>¿Por qué no te interesó esta propuesta?</Text>
        <Text style={ss.sub}>Tu respuesta nos ayuda a mostrarte ofertas más relevantes.</Text>

        <View style={ss.opciones}>
          {MOTIVOS.map(m=>(
            <TouchableOpacity
              key={m.id}
              style={[ss.opcion,seleccion===m.id&&ss.opcionA]}
              onPress={()=>setSeleccion(m.id)}
            >
              <Text style={ss.opcionEmoji}>{m.emoji}</Text>
              <Text style={[ss.opcionTxt,seleccion===m.id&&ss.opcionTxtA]}>{m.label}</Text>
              {seleccion===m.id&&<Text style={ss.check}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[ss.btnEnviar,!seleccion&&ss.btnEnviarOff]}
          onPress={enviar}
          disabled={!seleccion||cargando}
        >
          {cargando
            ?<ActivityIndicator color={C.blanco} size="small"/>
            :<Text style={ss.btnEnviarTxt}>Enviar y cerrar</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={ss.btnSaltar} onPress={()=>navigation.navigate("MensajesList")}>
          <Text style={ss.btnSaltarTxt}>Saltar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:C.crema},
  hdr:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingVertical:14,backgroundColor:C.blanco,borderBottomWidth:1,borderBottomColor:C.borde},
  backBtn:{padding:4},
  backTxt:{fontSize:22,color:C.teal,fontWeight:"700"},
  hdrTit:{fontSize:16,fontWeight:"800",color:C.texto1},
  body:{flex:1,padding:24},
  pregunta:{fontSize:22,fontWeight:"900",color:C.texto1,marginBottom:8,lineHeight:28},
  sub:{fontSize:14,color:C.texto3,marginBottom:28,lineHeight:20},
  opciones:{gap:10,marginBottom:32},
  opcion:{flexDirection:"row",alignItems:"center",gap:14,backgroundColor:C.blanco,borderRadius:14,padding:16,borderWidth:1.5,borderColor:C.borde},
  opcionA:{borderColor:C.coral,backgroundColor:"#FFF5F2"},
  opcionEmoji:{fontSize:22},
  opcionTxt:{fontSize:15,fontWeight:"600",color:C.texto2,flex:1},
  opcionTxtA:{color:C.coral},
  check:{fontSize:16,color:C.coral,fontWeight:"800"},
  btnEnviar:{backgroundColor:C.coral,borderRadius:14,paddingVertical:16,alignItems:"center"},
  btnEnviarOff:{backgroundColor:C.borde},
  btnEnviarTxt:{color:C.blanco,fontSize:16,fontWeight:"800"},
  btnSaltar:{paddingVertical:14,alignItems:"center"},
  btnSaltarTxt:{fontSize:14,color:C.texto3,fontWeight:"600"},
});
