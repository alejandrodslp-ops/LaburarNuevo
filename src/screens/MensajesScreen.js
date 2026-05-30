import React,{useState,useEffect} from "react";
import NexuWatermark from '../components/NexuWatermark';
import{View,Text,StyleSheet,FlatList,TouchableOpacity,ActivityIndicator,Image,Alert}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{supabase}from "../services/supabase";
import{useApp}from "../services/AppContext";
import{useI18n}from "../services/I18nContext";

const C={coral:"#E8785A",indigo:"#2DD4BF",blanco:"#FFFFFF",crema:"#FBF8F4",cremaDark:"#F2EDE6",borde:"#EDE8E2",texto1:"#1A1020",texto2:"#5A4E6A",texto3:"#A898B8"};
const ListSeparator=()=><View style={{height:1,backgroundColor:C.borde,marginLeft:72}}/>;

function formatHora(iso){
  if(!iso)return"";
  const d=new Date(iso),now=new Date(),diff=now-d;
  if(diff<3600000)return Math.max(1,Math.round(diff/60000))+"m";
  if(diff<86400000)return Math.round(diff/3600000)+"h";
  if(diff<172800000)return"Ayer";
  if(diff<604800000)return["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][d.getDay()];
  return d.toLocaleDateString("es-UY",{day:"2-digit",month:"2-digit"});
}

function Row({item,onPress,onLongPress}){
  return(
    <TouchableOpacity style={ss.row} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.75}>
      <View style={[ss.av,item.esNexu&&ss.avNexu]}>
        {item.esNexu
          ?<Text style={ss.avNexuTxt}>N</Text>
          :item.avatarUrl
            ?<Image source={{uri:item.avatarUrl}} style={ss.avImg}/>
            :<Text style={{fontSize:22}}>{item.emoji}</Text>
        }
        {item.noLeidos>0&&<View style={ss.dot}/>}
      </View>
      <View style={ss.cnt}>
        <View style={ss.top}>
          <Text style={[ss.nom,item.noLeidos>0&&ss.nomU]}>{item.nombre}</Text>
          <Text style={ss.hora}>{item.hora}</Text>
        </View>
        <Text style={[ss.ult,item.noLeidos>0&&ss.ultU]} numberOfLines={1}>{item.ultimo}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MensajesScreen({navigation}){
  const{recargarSinLeer}=useApp();
  const{t}=useI18n();
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    let canal=null;
    let montado=true;
    (async()=>{
      await cargar();
      if(!montado)return;
      const{data}=await supabase.auth.getUser().catch(()=>({data:{user:null}}));
      const user=data?.user;
      if(!user||!montado)return;
      canal=supabase.channel("mensajes_screen_"+user.id)
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"propuestas",filter:`worker_id=eq.${user.id}`},()=>{ if(montado) cargar(); })
        .on("postgres_changes",{event:"INSERT",schema:"public",table:"mensajes",filter:`receiver_id=eq.${user.id}`},()=>{ if(montado) cargar(); })
        .on("postgres_changes",{event:"DELETE",schema:"public",table:"mensajes",filter:`sender_id=eq.${user.id}`},()=>{ if(montado) cargar(); })
        .on("postgres_changes",{event:"DELETE",schema:"public",table:"mensajes",filter:`receiver_id=eq.${user.id}`},()=>{ if(montado) cargar(); })
        .subscribe();
    })();
    return()=>{ montado=false; if(canal) supabase.removeChannel(canal); };
  },[]);
  useEffect(()=>{const u=navigation.addListener("focus",cargar);return u;},[navigation]);

  async function cargar(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;

      const lista=[];

      // ── Propuestas pendientes para el trabajador ──────────
      const{data:propuestas}=await supabase
        .from("propuestas")
        .select("id,employer_id,worker_id,employer_nombre,oferta,estado,created_at")
        .eq("worker_id",user.id)
        .eq("estado","pendiente")
        .order("created_at",{ascending:false});

      for(const p of propuestas||[]){
        lista.push({
          tipo:"propuesta",
          id:"prop_"+p.id,
          propuesta:p,
          nombre:"Nexu",
          emoji:"🔔",
          ultimo:t('hay_oferta'),
          hora:formatHora(p.created_at),
          noLeidos:1,
        });
      }

      // ── Conversaciones de mensajes ────────────────────────
      const{data:msgs}=await supabase
        .from("mensajes")
        .select("id,sender_id,receiver_id,texto,created_at,leido")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order("created_at",{ascending:false});

      if(msgs?.length){
        const map={};
        for(const m of msgs){
          const pid=m.sender_id===user.id?m.receiver_id:m.sender_id;
          if(!map[pid]){map[pid]={pid,ultimo:m,noLeidos:0};}
          if(!m.leido&&m.receiver_id===user.id)map[pid].noLeidos++;
        }
        const pids=Object.keys(map);
        const{data:perfiles}=await supabase
          .from("profiles").select("id,nombre,apellido1,rol,avatar_url").in("id",pids);
        const pm={};
        (perfiles||[]).forEach(p=>{pm[p.id]=p;});
        const NEXU_ID="43a7baf9-f88e-463b-8e4c-385bd3fb8151";
        for(const pid of pids){
          const p=pm[pid]||{};
          const c=map[pid];
          const esNexu=pid===NEXU_ID;
          const nombre=esNexu?"Nexu":(p.nombre
            ?(p.apellido1?`${p.nombre} ${p.apellido1[0]}.`:p.nombre):"Contacto");
          const emoji=esNexu?"🔔":(p.rol==="employer"?"💼":p.rol==="company"?"🏢":"👤");
          const avatarUrl=p.avatar_url||null;
          lista.push({
            tipo:"chat",id:pid,nombre,emoji,avatarUrl,esNexu,
            ultimo:c.ultimo.texto,
            hora:formatHora(c.ultimo.created_at),
            noLeidos:c.noLeidos,
          });
        }
      }

      // Ordenar: primero propuestas, luego por hora
      lista.sort((a,b)=>{
        if(a.tipo==="propuesta"&&b.tipo!=="propuesta")return -1;
        if(b.tipo==="propuesta"&&a.tipo!=="propuesta")return 1;
        return 0;
      });

      setItems(lista);
      recargarSinLeer();
    }catch(e){console.log(e);}
    finally{setLoading(false);}
  }

  function onPresItem(item){
    if(item.tipo==="propuesta"){
      navigation.navigate("Propuesta",{propuesta:item.propuesta});
    }else{
      navigation.navigate("Chat",{contactoId:item.id,nombre:item.nombre,esNexu:item.esNexu||false,avatarUrl:item.avatarUrl||null});
    }
  }

  function onLongPressItem(item){
    if(item.tipo==="propuesta")return;
    Alert.alert(
      "Eliminar conversación",
      `¿Eliminar todos los mensajes con ${item.nombre}?`,
      [
        {text:"Cancelar",style:"cancel"},
        {text:"Eliminar",style:"destructive",onPress:async()=>{
          try{
            const{data:{user}}=await supabase.auth.getUser();
            if(!user)return;
            await supabase.from("mensajes")
              .delete()
              .or(`and(sender_id.eq.${user.id},receiver_id.eq.${item.id}),and(sender_id.eq.${item.id},receiver_id.eq.${user.id})`);
            cargar();
          }catch(e){}
        }},
      ]
    );
  }

  return(
    <SafeAreaView style={ss.c} edges={["top"]}>
      <NexuWatermark/>
      <View style={ss.hdr}><Text style={ss.tit}>{t('mensajes_titulo')}</Text></View>
      {loading?(
        <ActivityIndicator size="large" color={C.indigo} style={{marginTop:40}}/>
      ):items.length===0?(
        <View style={ss.empty}>
          <Text style={{fontSize:48,marginBottom:12}}>💬</Text>
          <Text style={ss.emptyTit}>{t('sin_mensajes_tit')}</Text>
          <Text style={ss.emptySub}>{t('sin_mensajes_sub')}</Text>
        </View>
      ):(
        <FlatList
          data={items}
          keyExtractor={i=>i.id}
          renderItem={({item})=><Row item={item} onPress={()=>onPresItem(item)} onLongPress={()=>onLongPressItem(item)}/>}
          ItemSeparatorComponent={ListSeparator}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:C.crema},
  hdr:{paddingHorizontal:16,paddingVertical:16,borderBottomWidth:1,borderBottomColor:C.borde,backgroundColor:C.blanco},
  tit:{fontSize:24,fontWeight:"800",color:C.texto1,letterSpacing:-0.5},
  row:{flexDirection:"row",alignItems:"center",gap:12,paddingHorizontal:16,paddingVertical:14,backgroundColor:C.blanco},
  av:{width:48,height:48,borderRadius:24,backgroundColor:C.cremaDark,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:C.borde,position:"relative",flexShrink:0,overflow:"hidden"},
  avImg:{width:48,height:48,borderRadius:24},
  avNexu:{backgroundColor:"#1A1020",borderColor:"#E8785A"},
  avNexuTxt:{fontSize:22,fontWeight:"900",color:"#E8785A"},
  dot:{position:"absolute",top:0,right:0,width:10,height:10,borderRadius:5,backgroundColor:C.coral,borderWidth:1.5,borderColor:C.blanco},
  cnt:{flex:1},
  top:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:3},
  nom:{fontSize:14,fontWeight:"600",color:C.texto2},
  nomU:{fontWeight:"800",color:C.texto1},
  hora:{fontSize:10,color:C.texto3},
  ult:{fontSize:12,color:C.texto3},
  ultU:{color:C.texto2,fontWeight:"600"},
  sep:{height:1,backgroundColor:C.borde,marginLeft:76},
  empty:{flex:1,alignItems:"center",justifyContent:"center",padding:40},
  emptyTit:{fontSize:18,fontWeight:"800",color:C.texto1,marginBottom:8},
  emptySub:{fontSize:14,color:C.texto3,textAlign:"center",lineHeight:20},
});
