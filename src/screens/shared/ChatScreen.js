import React,{useState,useEffect,useRef} from "react";
import {logError} from '../../services/logError';
import{View,Text,StyleSheet,TouchableOpacity,TextInput,FlatList,KeyboardAvoidingView,Platform,Alert,Image}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{supabase}from "../../services/supabase";
import{useApp}from "../../services/AppContext";

const C={coral:"#E8785A",indigo:"#2DD4BF",blanco:"#FFFFFF",crema:"#FBF8F4",cremaDark:"#F2EDE6",borde:"#EDE8E2",texto1:"#1A1020",texto2:"#5A4E6A",texto3:"#A898B8"};

function formatHora(iso){
  if(!iso)return"";
  return new Date(iso).toLocaleTimeString("es-UY",{hour:"2-digit",minute:"2-digit"});
}

function formatSueldo(o){
  if(!o||o.sueldo_tipo==="A acordar")return"A acordar / a presupuestar";
  const rng=o.sueldo_min&&o.sueldo_max
    ?`USD ${o.sueldo_min} – ${o.sueldo_max}`
    :o.sueldo_min?`desde USD ${o.sueldo_min}`:"A acordar";
  return o.sueldo_tipo==="Monto fijo"?`USD ${o.sueldo_min||""}`:o.sueldo_tipo+": "+rng;
}

function InfoRow({icon,label,val}){
  if(!val)return null;
  return(
    <View style={ss.infoRow}>
      <Text style={ss.infoIcon}>{icon}</Text>
      <View style={{flex:1}}>
        <Text style={ss.infoLabel}>{label}</Text>
        <Text style={ss.infoVal}>{val}</Text>
      </View>
    </View>
  );
}

export default function ChatScreen({navigation,route}){
  const{recargarSinLeer}=useApp();
  const{contactoId,nombre,esNexu,avatarUrl}=route.params||{};
  const[msgs,setMsgs]=useState([]);
  const[txt,setTxt]=useState("");
  const[userId,setUserId]=useState(null);
  const[oferta,setOferta]=useState(null);
  const[empProfile,setEmpProfile]=useState(null);
  const flatRef=useRef(null);
  const channelRef=useRef(null);
  const montadoRef=useRef(true);

  useEffect(()=>{
    montadoRef.current=true;
    iniciar();
    return()=>{
      montadoRef.current=false;
      if(channelRef.current)supabase.removeChannel(channelRef.current);
    };
  },[]);

  async function iniciar(){
    const{data}=await supabase.auth.getUser().catch(()=>({data:{user:null}}));
    const user=data?.user;
    if(!user||!montadoRef.current)return;
    setUserId(user.id);
    await Promise.all([cargarMensajes(user.id),cargarOferta()]);
    if(!montadoRef.current)return;
    suscribir(user.id);
    marcarLeidos(user.id);
  }

  async function cargarMensajes(uid){
    try{
      const{data}=await supabase
        .from("mensajes")
        .select("id,sender_id,receiver_id,texto,created_at,leido")
        .or(`and(sender_id.eq.${uid},receiver_id.eq.${contactoId}),and(sender_id.eq.${contactoId},receiver_id.eq.${uid})`)
        .order("created_at",{ascending:true});
      setMsgs(data||[]);
      setTimeout(()=>flatRef.current?.scrollToEnd({animated:false}),200);
    }catch(e){logError('ChatEmpleador',e);}
  }

  async function cargarOferta(){
    try{
      const{data:p}=await supabase
        .from("perfiles_publicos")
        .select("id,nombre,apellido1,rol,ciudad,barrio,pais")
        .eq("id",contactoId)
        .single();
      if(!p)return;
      setEmpProfile(p);

      const empId=(p.rol==="employer"||p.rol==="company")?contactoId:null;
      if(!empId)return;

      const{data:ofertas}=await supabase
        .from("ofertas")
        .select("*")
        .eq("employer_id",empId)
        .order("created_at",{ascending:false})
        .limit(1);
      if(ofertas?.length)setOferta(ofertas[0]);
    }catch(e){}
  }

  function suscribir(uid){
    const ch=supabase
      .channel(`chat_${[uid,contactoId].sort().join("_")}`)
      .on("postgres_changes",{
        event:"INSERT",schema:"public",table:"mensajes",
        filter:`receiver_id=eq.${uid}`,
      },(payload)=>{
        if(payload.new.sender_id===contactoId){
          setMsgs(prev=>[...prev,payload.new]);
          setTimeout(()=>flatRef.current?.scrollToEnd({animated:true}),100);
          recargarSinLeer();
        }
      })
      .subscribe();
    channelRef.current=ch;
  }

  async function marcarLeidos(uid){
    try{
      await supabase.from("mensajes")
        .update({leido:true})
        .eq("receiver_id",uid)
        .eq("sender_id",contactoId)
        .eq("leido",false);
      recargarSinLeer();
    }catch(e){}
  }

  async function enviar(){
    const texto=txt.trim();
    if(!texto||!userId)return;
    setTxt("");
    const{data,error}=await supabase
      .from("mensajes")
      .insert({sender_id:userId,receiver_id:contactoId,texto,leido:false})
      .select("id,sender_id,receiver_id,texto,created_at,leido")
      .single();
    if(error){
      console.error("[Chat] error al enviar:",JSON.stringify(error));
      setTxt(texto);
      Alert.alert("No se pudo enviar","Verificá tu conexión e intentá de nuevo.\n\n"+error.message);
      return;
    }
    if(data){
      setMsgs(prev=>[...prev,data]);
      setTimeout(()=>flatRef.current?.scrollToEnd({animated:true}),100);
      // Notificar al destinatario por push (por si tiene la app cerrada)
      supabase.functions.invoke("notificar-propuesta",{
        body:{
          user_id:contactoId,
          titulo:"Nuevo mensaje en Konexu 💬",
          cuerpo:texto.length>60?texto.slice(0,57)+"...":texto,
          pantalla:"Mensajes",
        },
      }).catch(()=>{});
    }
  }

  function OfertaCard(){
    const lugar=oferta?.lugar||[empProfile?.barrio,empProfile?.ciudad].filter(Boolean).join(", ");
    const sueldo=oferta?formatSueldo(oferta):null;
    const hayDatos=oferta||lugar;
    if(!hayDatos)return null;

    return(
      <View style={ss.ofertaCard}>
        {/* Encabezado */}
        <View style={ss.ofertaHdr}>
          <View style={ss.ofertaBadge}><Text style={{fontSize:16}}>💼</Text></View>
          <View style={{flex:1}}>
            <Text style={ss.ofertaTit}>{oferta?.titulo||"Oferta de trabajo"}</Text>
            {oferta?.empleo&&<Text style={ss.ofertaOficio}>{oferta.empleo}</Text>}
          </View>
        </View>

        {/* Datos */}
        <View style={ss.ofertaBody}>
          <InfoRow icon="📍" label="Lugar donde se realiza" val={lugar}/>
          <InfoRow icon="🕐" label="Carga horaria" val={oferta?.carga_horaria}/>
          <InfoRow icon="💰" label="Remuneración" val={sueldo}/>
          <InfoRow icon="📝" label="Descripción del puesto" val={oferta?.descripcion}/>
          {oferta?.escolaridad&&oferta.escolaridad!=="Sin requisito"&&
            <InfoRow icon="🎓" label="Escolaridad requerida" val={oferta.escolaridad}/>}
          {oferta?.idiomas?.length>0&&
            <InfoRow icon="🗣️" label="Idiomas" val={oferta.idiomas.join(", ")}/>}
          {oferta?.habilidades?.length>0&&
            <InfoRow icon="⭐" label="Habilidades" val={oferta.habilidades.join(", ")}/>}
        </View>

        <View style={ss.ofertaFoot}>
          <Text style={ss.ofertaFootTxt}>🔒 El contacto directo se coordina en esta conversación</Text>
        </View>
      </View>
    );
  }

  function Burbuja({m}){
    const mio=m.sender_id===userId;

    function borrarMensaje(){
      Alert.alert("Borrar mensaje","¿Eliminar este mensaje?",[
        {text:"Cancelar",style:"cancel"},
        {text:"Eliminar",style:"destructive",onPress:async()=>{
          await supabase.from("mensajes").delete().eq("id",m.id);
          setMsgs(prev=>prev.filter(x=>x.id!==m.id));
        }},
      ]);
    }

    return(
      <TouchableOpacity style={[ss.bw,mio&&ss.bwm]} onLongPress={borrarMensaje} activeOpacity={0.85}>
        <View style={[ss.b,mio?ss.bm:ss.ba]}>
          <Text style={[ss.bt,mio&&ss.btm]}>{m.texto}</Text>
          <Text style={[ss.bh,mio&&ss.bhm]}>{formatHora(m.created_at)}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return(
    <SafeAreaView style={ss.c}>
      <View style={ss.header}>
        <TouchableOpacity style={ss.back} onPress={()=>navigation.goBack()}>
          <Text style={ss.backTxt}>←</Text>
        </TouchableOpacity>
        <View style={ss.hi}>
          <View style={[ss.av,esNexu&&{backgroundColor:"#1A1020",borderWidth:1.5,borderColor:"#E8785A"}]}>
            {esNexu
              ?<Text style={{fontSize:18,fontWeight:"900",color:"#E8785A"}}>N</Text>
              :avatarUrl
                ?<Image source={{uri:avatarUrl}} style={ss.avImg}/>
                :<Text style={{fontSize:20}}>💼</Text>
            }
          </View>
          <View>
            <Text style={ss.hn}>{nombre||"Contacto"}</Text>
            <Text style={[ss.he,esNexu&&{color:"#1A3A5C"}]}>
              {esNexu?"Comunicación oficial de Konexu":"Oferta de trabajo"}
            </Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":undefined}>
        <FlatList
          ref={flatRef}
          data={msgs}
          keyExtractor={i=>i.id?.toString()??i.created_at}
          renderItem={({item})=><Burbuja m={item}/>}
          ListHeaderComponent={esNexu?null:<OfertaCard/>}
          contentContainerStyle={ss.lista}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={()=>flatRef.current?.scrollToEnd({animated:false})}
        />
        {esNexu?(
          <View style={ss.nexuNota}>
            <Text style={ss.nexuNotaTxt}>🔒 Este es un canal oficial de Konexu. No es posible responder.</Text>
          </View>
        ):(
          <View style={ss.iw}>
            <TextInput
              style={ss.input}
              placeholder="Escribí un mensaje..."
              placeholderTextColor={C.texto3}
              value={txt}
              onChangeText={setTxt}
              multiline
              maxLength={500}
            />
            <TouchableOpacity style={[ss.sb,!txt.trim()&&ss.sbd]} onPress={enviar} disabled={!txt.trim()}>
              <Text style={ss.si}>→</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:C.crema},
  header:{flexDirection:"row",alignItems:"center",paddingHorizontal:16,paddingVertical:12,backgroundColor:C.blanco,borderBottomWidth:1,borderBottomColor:C.borde,gap:12},
  back:{padding:4},backTxt:{fontSize:22,color:C.indigo,fontWeight:"700"},
  hi:{flexDirection:"row",alignItems:"center",gap:10,flex:1},
  av:{width:38,height:38,borderRadius:19,backgroundColor:C.cremaDark,alignItems:"center",justifyContent:"center",overflow:"hidden"},
  avImg:{width:38,height:38,borderRadius:19},
  hn:{fontSize:15,fontWeight:"800",color:C.texto1},
  he:{fontSize:11,color:C.coral,fontWeight:"600"},
  lista:{padding:16,paddingBottom:8},

  // Oferta card
  ofertaCard:{backgroundColor:C.blanco,borderRadius:16,marginBottom:16,borderWidth:1,borderColor:C.borde,overflow:"hidden"},
  ofertaHdr:{flexDirection:"row",alignItems:"center",gap:10,padding:14,backgroundColor:"#F0FDFA",borderBottomWidth:1,borderBottomColor:C.borde},
  ofertaBadge:{width:36,height:36,borderRadius:10,backgroundColor:"#2DD4BF22",alignItems:"center",justifyContent:"center"},
  ofertaTit:{fontSize:14,fontWeight:"800",color:C.texto1},
  ofertaOficio:{fontSize:12,color:C.indigo,fontWeight:"600",marginTop:1},
  ofertaBody:{padding:14,gap:12},
  infoRow:{flexDirection:"row",alignItems:"flex-start",gap:10},
  infoIcon:{fontSize:16,width:22,marginTop:1},
  infoLabel:{fontSize:10,color:C.texto3,fontWeight:"700",marginBottom:2,textTransform:"uppercase",letterSpacing:0.5},
  infoVal:{fontSize:13,color:C.texto1,fontWeight:"500",lineHeight:18},
  ofertaFoot:{borderTopWidth:1,borderTopColor:C.borde,paddingVertical:10,paddingHorizontal:14},
  ofertaFootTxt:{fontSize:11,color:C.texto3,textAlign:"center"},

  // Mensajes
  bw:{flexDirection:"row",justifyContent:"flex-start",marginBottom:6},
  bwm:{justifyContent:"flex-end"},
  b:{maxWidth:"78%",borderRadius:18,paddingHorizontal:14,paddingVertical:10},
  ba:{backgroundColor:C.blanco,borderBottomLeftRadius:4,borderWidth:1,borderColor:C.borde},
  bm:{backgroundColor:C.indigo,borderBottomRightRadius:4},
  bt:{fontSize:14,color:C.texto1,lineHeight:20},
  btm:{color:C.blanco},
  bh:{fontSize:10,color:C.texto3,alignSelf:"flex-end",marginTop:4},
  bhm:{color:"rgba(255,255,255,0.5)"},

  // Input
  iw:{flexDirection:"row",alignItems:"flex-end",paddingHorizontal:16,paddingVertical:12,backgroundColor:C.blanco,borderTopWidth:1,borderTopColor:C.borde,gap:10},
  input:{flex:1,backgroundColor:C.cremaDark,borderRadius:22,paddingHorizontal:16,paddingVertical:10,fontSize:14,color:C.texto1,maxHeight:100},
  sb:{width:42,height:42,borderRadius:21,backgroundColor:C.coral,alignItems:"center",justifyContent:"center"},
  sbd:{backgroundColor:C.borde},
  si:{color:C.blanco,fontSize:18,fontWeight:"800"},
  nexuNota:{paddingHorizontal:16,paddingVertical:12,backgroundColor:C.blanco,borderTopWidth:1,borderTopColor:C.borde,alignItems:"center"},
  nexuNotaTxt:{fontSize:12,color:C.texto3,fontWeight:"600"},
});
