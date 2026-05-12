import React,{createContext,useContext,useState,useEffect} from "react";
import{supabase}from "./supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import{requestNotificationPermission}from "./notifications";
import * as Notifications from "expo-notifications";

const AppContext=createContext({
  session:null,
  modoActivo:"worker",
  cambiarModo:()=>{},
  coachPendiente:false,
  dismissCoach:()=>{},
  coachEditarPendiente:false,
  activarCoachEditar:()=>{},
  dismissCoachEditar:()=>{},
  mensajesSinLeer:0,
  recargarSinLeer:()=>{},
});

export function AppProvider({children}){
  const[session,setSession]=useState(undefined);
  const[modoActivo,setModoActivo]=useState("worker");
  const[suscripcionActiva,setSuscripcionActiva]=useState(false);
  const[coachPendiente,setCoachPendiente]=useState(false);
  const[coachEditarPendiente,setCoachEditarPendiente]=useState(false);
  const[mensajesSinLeer,setMensajesSinLeer]=useState(0);

  useEffect(()=>{
    requestNotificationPermission().then(async(granted)=>{
      if(!granted)return;
      try{
        const{data:token}=await Notifications.getExpoPushTokenAsync();
        const{data:{user}}=await supabase.auth.getUser();
        if(user&&token) await supabase.from("profiles").update({push_token:token}).eq("id",user.id);
      }catch(e){}
    });
    supabase.auth.getSession().then(({data:{session}})=>{setSession(session);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{setSession(session);});
    return()=>subscription.unsubscribe();
  },[]);

  async function recargarSinLeer(){
    try{
      const{data:{user}}=await supabase.auth.getUser();
      if(!user)return;
      const{count}=await supabase
        .from("mensajes")
        .select("*",{count:"exact",head:true})
        .eq("receiver_id",user.id)
        .eq("leido",false);
      setMensajesSinLeer(count||0);
    }catch(e){setMensajesSinLeer(0);}
  }

  useEffect(()=>{
    if(!session?.user?.id)return;
    recargarSinLeer();

    // Real-time: incrementa badge cuando llega mensaje nuevo
    const canal=supabase.channel("badge_mensajes_"+session.user.id)
      .on("postgres_changes",{
        event:"INSERT",schema:"public",table:"mensajes",
        filter:`receiver_id=eq.${session.user.id}`,
      },()=>recargarSinLeer())
      .subscribe();

    return()=>{ supabase.removeChannel(canal); };
  },[session?.user?.id]);

  // Al iniciar sesion, leer el modo guardado y verificar coach mark
  useEffect(()=>{
    if(session?.user?.id){
      supabase.from("profiles").select("rol,suscripcion_activa").eq("id",session.user.id).single().then(({data})=>{
        if(data){
          setSuscripcionActiva(data.suscripcion_activa||false);
          if(data.rol==="company"){
            setModoActivo("company");
            AsyncStorage.setItem("modo_"+session.user.id,"company");
          }else{
            AsyncStorage.getItem("modo_"+session.user.id).then(modo=>{
              if(modo&&(modo==="worker"||modo==="employer")){
                setModoActivo(modo);
              }else{
                setModoActivo("worker");
              }
            });
          }
        }
      });
      // Verificar si hay coach mark pendiente (nuevo usuario)
      AsyncStorage.getItem("coach_perfil_pendiente").then(val=>{
        if(val==="true"){
          setCoachPendiente(true);
          AsyncStorage.removeItem("coach_perfil_pendiente");
        }
      });
    }
  },[session?.user?.id]);

  function dismissCoach(){setCoachPendiente(false);}
  function activarCoachEditar(){setCoachEditarPendiente(true);}
  function dismissCoachEditar(){setCoachEditarPendiente(false);}

  async function cambiarModo(nuevoModo){
    setModoActivo(nuevoModo);
    if(session?.user?.id){
      await AsyncStorage.setItem("modo_"+session.user.id, nuevoModo);
    }
  }

  return(
    <AppContext.Provider value={{session,modoActivo,cambiarModo,suscripcionActiva,setSuscripcionActiva,coachPendiente,dismissCoach,coachEditarPendiente,activarCoachEditar,dismissCoachEditar,mensajesSinLeer,recargarSinLeer}}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(){return useContext(AppContext);}
