import React,{useState} from "react";
import{View,Text,StyleSheet,TouchableOpacity,ScrollView,Alert,ActivityIndicator}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{supabase}from "../../services/supabase";

const C={coral:"#E8785A",teal:"#2DD4BF",blanco:"#FFFFFF",crema:"#FBF8F4",cremaDark:"#F2EDE6",borde:"#EDE8E2",texto1:"#1A1020",texto2:"#5A4E6A",texto3:"#A898B8",verde:"#3DA882"};

function InfoFila({icon,label,valor}){
  if(!valor)return null;
  return(
    <View style={ss.infoRow}>
      <Text style={ss.infoIcon}>{icon}</Text>
      <View style={{flex:1}}>
        <Text style={ss.infoLabel}>{label}</Text>
        <Text style={ss.infoVal}>{valor}</Text>
      </View>
    </View>
  );
}

function formatSueldo(o){
  if(!o)return null;
  if(o.sueldo_tipo==="A acordar")return"A acordar / a presupuestar";
  if(o.sueldo_tipo==="Monto fijo"&&o.sueldo_min)return`USD ${o.sueldo_min}`;
  if(o.sueldo_min&&o.sueldo_max)return`USD ${o.sueldo_min} – ${o.sueldo_max}`;
  if(o.sueldo_min)return`Desde USD ${o.sueldo_min}`;
  return"A acordar";
}

export default function PropuestaScreen({navigation,route}){
  const{propuesta}=route.params||{};
  const[cargando,setCargando]=useState(false);
  const oferta=propuesta?.oferta||{};

  async function aceptar(){
    setCargando(true);
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;

      // Marcar propuesta como aceptada
      await supabase.from("propuestas")
        .update({estado:"aceptada",respondida_at:new Date().toISOString()})
        .eq("id",propuesta.id);

      // Enviar mensaje al empleador notificando el interés
      await supabase.from("mensajes").insert({
        sender_id:user.id,
        receiver_id:propuesta.employer_id,
        texto:"Hola, vi tu propuesta laboral en Nexu y me interesa. ¿Cuándo podemos hablar para saber más detalles?",
        leido:false,
      });

      // Notificar al empleador por push
      supabase.functions.invoke("notificar-propuesta",{
        body:{
          user_id:propuesta.employer_id,
          titulo:"¡Un trabajador aceptó tu propuesta! 🎉",
          cuerpo:"Respondió que le interesa. Podés chatear con él ahora desde Mensajes.",
          pantalla:"Mensajes",
        },
      }).catch(()=>{});

      Alert.alert(
        "¡Perfecto!",
        "Le avisamos al empleador que te interesa. Podés chatear con él desde Mensajes.",
        [{text:"Ir al chat",onPress:()=>{
          navigation.replace("Chat",{
            contactoId:propuesta.employer_id,
            nombre:propuesta.employer_nombre||"Empleador",
          });
        }}]
      );
    }catch(e){
      Alert.alert("Error","No se pudo procesar. Intentá de nuevo.");
    }finally{setCargando(false);}
  }

  function noMeInteresa(){
    navigation.navigate("EncuestaRechazo",{propuesta});
  }

  return(
    <SafeAreaView style={ss.c} edges={["top"]}>
      <View style={ss.hdr}>
        <TouchableOpacity onPress={()=>navigation.goBack()} style={ss.backBtn}>
          <Text style={ss.backTxt}>←</Text>
        </TouchableOpacity>
        <Text style={ss.hdrTit}>Propuesta de trabajo</Text>
        <View style={{width:40}}/>
      </View>

      <ScrollView contentContainerStyle={ss.scroll} showsVerticalScrollIndicator={false}>

        {/* Encabezado Nexu */}
        <View style={ss.nexuCard}>
          <View style={ss.nexuBadge}><Text style={ss.nexuBadgeTxt}>Nexu</Text></View>
          <Text style={ss.nexuTit}>Hay una oferta que puede interesarte</Text>
          <Text style={ss.nexuSub}>
            <Text style={{fontWeight:"800"}}>{propuesta?.employer_nombre||"Un empleador"}</Text>
            {" "}vio tu perfil profesional y mostró interés en contratarte.
          </Text>
        </View>

        {/* Datos de la oferta */}
        <View style={ss.ofertaCard}>
          <Text style={ss.secTit}>DETALLES DE LA OFERTA</Text>

          {oferta.titulo&&(
            <View style={ss.tituloRow}>
              <Text style={ss.ofertaTit}>{oferta.titulo}</Text>
              {oferta.empleo&&<Text style={ss.ofertaEmpleo}>{oferta.empleo}</Text>}
            </View>
          )}

          <View style={ss.infoList}>
            <InfoFila icon="📍" label="Lugar de trabajo" valor={oferta.lugar}/>
            <InfoFila icon="🕐" label="Carga horaria" valor={oferta.carga_horaria}/>
            <InfoFila icon="💰" label="Remuneración" valor={formatSueldo(oferta)}/>
            <InfoFila icon="📝" label="Descripción del puesto" valor={oferta.descripcion}/>
          </View>

          {!oferta.titulo&&!oferta.lugar&&!oferta.descripcion&&(
            <Text style={ss.sinDatos}>El empleador no subió los detalles de la oferta aún. Podés escribirle directamente para consultarle.</Text>
          )}
        </View>

        <View style={ss.privaNota}>
          <Text style={ss.privaNotaTxt}>🔒 Tu contacto directo solo se comparte si aceptás la propuesta.</Text>
        </View>

        {/* Botones */}
        <View style={ss.btns}>
          <TouchableOpacity style={ss.btnSi} onPress={aceptar} disabled={cargando}>
            {cargando
              ?<ActivityIndicator color={C.blanco} size="small"/>
              :<Text style={ss.btnSiTxt}>Me interesa</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={ss.btnNo} onPress={noMeInteresa} disabled={cargando}>
            <Text style={ss.btnNoTxt}>No me interesa, gracias</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:C.crema},
  hdr:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:16,paddingVertical:14,backgroundColor:C.blanco,borderBottomWidth:1,borderBottomColor:C.borde},
  backBtn:{padding:4},
  backTxt:{fontSize:22,color:C.teal,fontWeight:"700"},
  hdrTit:{fontSize:16,fontWeight:"800",color:C.texto1},
  scroll:{padding:16,paddingBottom:48},

  nexuCard:{backgroundColor:C.blanco,borderRadius:16,padding:20,marginBottom:16,borderWidth:1,borderColor:C.borde,alignItems:"center"},
  nexuBadge:{backgroundColor:"#E8F4FD",borderRadius:20,paddingHorizontal:14,paddingVertical:5,marginBottom:12},
  nexuBadgeTxt:{color:"#2563EB",fontSize:12,fontWeight:"800",letterSpacing:0.5},
  nexuTit:{fontSize:18,fontWeight:"900",color:C.texto1,textAlign:"center",marginBottom:8},
  nexuSub:{fontSize:14,color:C.texto2,textAlign:"center",lineHeight:20},

  ofertaCard:{backgroundColor:C.blanco,borderRadius:16,padding:16,marginBottom:16,borderWidth:1,borderColor:C.borde},
  secTit:{fontSize:10,fontWeight:"700",color:C.texto3,letterSpacing:1,marginBottom:12},
  tituloRow:{marginBottom:14,paddingBottom:14,borderBottomWidth:1,borderBottomColor:C.borde},
  ofertaTit:{fontSize:18,fontWeight:"900",color:C.texto1,marginBottom:4},
  ofertaEmpleo:{fontSize:13,color:C.teal,fontWeight:"700"},
  infoList:{gap:14},
  infoRow:{flexDirection:"row",alignItems:"flex-start",gap:12},
  infoIcon:{fontSize:18,width:24,marginTop:1},
  infoLabel:{fontSize:10,color:C.texto3,fontWeight:"700",marginBottom:3,textTransform:"uppercase",letterSpacing:0.5},
  infoVal:{fontSize:14,color:C.texto1,fontWeight:"500",lineHeight:20},
  sinDatos:{fontSize:13,color:C.texto3,lineHeight:18,textAlign:"center",paddingVertical:8},

  privaNota:{backgroundColor:"#F0FDFA",borderRadius:10,padding:12,borderLeftWidth:3,borderLeftColor:C.teal,marginBottom:20},
  privaNotaTxt:{fontSize:12,color:C.teal,lineHeight:18},

  btns:{gap:10},
  btnSi:{backgroundColor:C.verde,borderRadius:14,paddingVertical:16,alignItems:"center"},
  btnSiTxt:{color:C.blanco,fontSize:16,fontWeight:"800"},
  btnNo:{borderRadius:14,paddingVertical:14,alignItems:"center",borderWidth:1.5,borderColor:C.borde},
  btnNoTxt:{color:C.texto3,fontSize:14,fontWeight:"700"},
});
