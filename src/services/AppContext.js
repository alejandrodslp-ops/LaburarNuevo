import React,{createContext,useContext,useState,useEffect,useMemo,useCallback} from "react";
import Constants from "expo-constants";
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
  perfilCompleto:null,
  marcarPerfilCompleto:()=>{},
  emailVerificado:null,
  marcarEmailVerificado:()=>{},
  empleadorDatosCompletos:null,
  marcarEmpleadorDatosCompletos:()=>{},
  emailPendiente:false,
  clearEmailPendiente:()=>{},
  calificacionPendiente:null,
  completarCalificacion:()=>{},
});

export function AppProvider({children}){
  const[session,setSession]=useState(undefined);
  const[modoActivo,setModoActivo]=useState("worker");
  const[suscripcionActiva,setSuscripcionActiva]=useState(false);
  const[coachPendiente,setCoachPendiente]=useState(false);
  const[coachEditarPendiente,setCoachEditarPendiente]=useState(false);
  const[emailPendiente,setEmailPendiente]=useState(false);
  const[mensajesSinLeer,setMensajesSinLeer]=useState(0);
  const[perfilCompleto,setPerfilCompleto]=useState(null);
  const[emailVerificado,setEmailVerificado]=useState(null);
  const[empleadorDatosCompletos,setEmpleadorDatosCompletos]=useState(null);
  const[calificacionPendiente,setCalificacionPendiente]=useState(null);

  useEffect(()=>{
    requestNotificationPermission().then(async(granted)=>{
      if(!granted)return;
      try{
        const tokenResult=await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        }).catch(e=>{ if(__DEV__) console.warn("[Konexu] push token error:",e?.message); return null; });
        const token=tokenResult?.data;
        const{data}=await supabase.auth.getUser();
        const user=data?.user;
        if(user&&token) await supabase.from("profiles").update({push_token:token}).eq("id",user.id);
      }catch(e){ if(__DEV__) console.warn("[Konexu] push setup error:",e?.message); }
    });
    supabase.auth.getSession().then(({data:{session}})=>{setSession(session);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{setSession(session);});
    return()=>subscription.unsubscribe();
  },[]);

  async function recargarSinLeer(){
    try{
      const{data}=await supabase.auth.getUser();
      const user=data?.user;
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

    // Real-time: actualiza badge en INSERT y DELETE de mensajes
    const canal=supabase.channel("badge_mensajes_"+session.user.id)
      .on("postgres_changes",{
        event:"INSERT",schema:"public",table:"mensajes",
        filter:`receiver_id=eq.${session.user.id}`,
      },()=>recargarSinLeer())
      .on("postgres_changes",{
        event:"DELETE",schema:"public",table:"mensajes",
        filter:`receiver_id=eq.${session.user.id}`,
      },()=>recargarSinLeer())
      .subscribe();

    return()=>{ supabase.removeChannel(canal); };
  },[session?.user?.id]);

  // Al iniciar sesion, leer el modo guardado y verificar coach mark
  useEffect(()=>{
    if(session?.user?.id){
      supabase.from("profiles").select("rol,suscripcion_activa").eq("id",session.user.id).single().then(({data})=>{
        if(!data){
          // Perfil no existe (ej: usuario borrado desde admin) — cerrar sesión y resetear onboarding
          AsyncStorage.removeItem('welcome_visto');
          supabase.auth.signOut();
          return;
        }
        setSuscripcionActiva(data.suscripcion_activa||false);
        if(data.rol==="company"){
          setModoActivo("company");
        }else{
          // Leer rol pendiente del login, o el último usado por este usuario
          AsyncStorage.getItem("nexu_rol_pending").then(async pending=>{
            if(pending==="worker"||pending==="employer"){
              setModoActivo(pending);
              await AsyncStorage.setItem("nexu_rol_"+session.user.id,pending);
              await AsyncStorage.removeItem("nexu_rol_pending");
            }else{
              const guardado=await AsyncStorage.getItem("nexu_rol_"+session.user.id);
              setModoActivo(guardado==="worker"||guardado==="employer"?guardado:(data.rol||"worker"));
            }
          });
        }
      });
      verificarPerfilCompleto(session.user.id);
      verificarEmailVerificado(session.user.id);
      verificarEmpleadorDatos(session.user.id);
      verificarCalificacionesPendientes(session.user.id);
      // Verificar si hay coach mark pendiente (nuevo usuario)
      AsyncStorage.getItem("coach_perfil_pendiente").then(val=>{
        if(val==="true"){
          setCoachPendiente(true);
          AsyncStorage.removeItem("coach_perfil_pendiente");
        }
      });
      AsyncStorage.getItem("verificar_email_pendiente").then(val=>{
        if(val==="true"){
          setEmailPendiente(true);
          AsyncStorage.removeItem("verificar_email_pendiente");
        }
      });
    }
  },[session?.user?.id]);

  async function verificarCalificacionesPendientes(userId){
    try{
      const DIAS=7;
      const cutoff=new Date(Date.now()-DIAS*86400000).toISOString();
      const{data:propuestas}=await supabase
        .from("propuestas")
        .select("id,worker_id,employer_id,employer_nombre,respondida_at")
        .eq("estado","aceptada")
        .not("respondida_at","is",null)
        .lt("respondida_at",cutoff)
        .or(`worker_id.eq.${userId},employer_id.eq.${userId}`);
      if(!propuestas?.length)return;
      const ids=propuestas.map(p=>p.id);
      const{data:yaCal}=await supabase
        .from("calificaciones")
        .select("propuesta_id")
        .eq("calificador_id",userId)
        .in("propuesta_id",ids);
      const calIds=new Set((yaCal||[]).map(c=>c.propuesta_id));
      const pendientes=propuestas.filter(p=>!calIds.has(p.id));
      if(!pendientes.length)return;
      const p=pendientes[0];
      const rolCalificador=p.worker_id===userId?"worker":"employer";
      const calificadoId=rolCalificador==="worker"?p.employer_id:p.worker_id;
      const{data:cal}=await supabase
        .from("profiles")
        .select("nombre,apellido1")
        .eq("id",calificadoId)
        .single();
      const calificadoNombre=cal
        ?(cal.apellido1?`${cal.nombre} ${cal.apellido1[0]}.`:cal.nombre)
        :(rolCalificador==="worker"?(p.employer_nombre||"el empleador"):"el trabajador");
      setCalificacionPendiente({propuestaId:p.id,calificadoId,calificadoNombre,rolCalificador});
    }catch(e){}
  }

  async function verificarPerfilCompleto(userId){
    try{
      const{data}=await supabase.from("profiles")
        .select("nombre,apellido1,apellido2,fecha_nac,pais,ciudad,sexo,telefono,servicios,profesiones,tecnicaturas")
        .eq("id",userId).single();
      const ok=!!(
        data?.nombre?.trim()&&
        data?.apellido1?.trim()&&
        data?.apellido2?.trim()&&
        data?.fecha_nac&&
        data?.pais&&
        data?.ciudad&&
        data?.sexo&&
        data?.telefono?.trim()&&
        ((data?.servicios?.length??0)+(data?.profesiones?.length??0)+(data?.tecnicaturas?.length??0))>=1
      );
      setPerfilCompleto(ok);
    }catch{setPerfilCompleto(false);}
  }

  async function verificarEmailVerificado(userId){
    try{
      const{data}=await supabase.from("profiles").select("email_verificado").eq("id",userId).single();
      setEmailVerificado(!!data?.email_verificado);
    }catch{setEmailVerificado(false);}
  }

  async function verificarEmpleadorDatos(userId){
    try{
      const{data}=await supabase.from("profiles")
        .select("nombre,apellido1,pais,ciudad,direccion")
        .eq("id",userId).single();
      const ok=!!(
        data?.nombre?.trim()&&
        data?.apellido1?.trim()&&
        data?.pais&&
        data?.ciudad&&
        data?.direccion?.trim()
      );
      setEmpleadorDatosCompletos(ok);
    }catch{setEmpleadorDatosCompletos(false);}
  }

  const marcarPerfilCompleto=useCallback(()=>setPerfilCompleto(true),[]);
  const marcarEmailVerificado=useCallback(()=>setEmailVerificado(true),[]);
  const marcarEmpleadorDatosCompletos=useCallback(()=>setEmpleadorDatosCompletos(true),[]);
  const dismissCoach=useCallback(()=>setCoachPendiente(false),[]);
  const activarCoachEditar=useCallback(()=>setCoachEditarPendiente(true),[]);
  const dismissCoachEditar=useCallback(()=>setCoachEditarPendiente(false),[]);
  const clearEmailPendiente=useCallback(()=>setEmailPendiente(false),[]);
  const completarCalificacion=useCallback(()=>setCalificacionPendiente(null),[]);

  async function cambiarModo(nuevoModo){
    setModoActivo(nuevoModo);
    if(session?.user?.id){
      await AsyncStorage.setItem("nexu_rol_"+session.user.id, nuevoModo);
    }
  }

  const value=useMemo(()=>({
    session,modoActivo,cambiarModo,suscripcionActiva,setSuscripcionActiva,
    coachPendiente,dismissCoach,coachEditarPendiente,activarCoachEditar,dismissCoachEditar,
    mensajesSinLeer,recargarSinLeer,perfilCompleto,marcarPerfilCompleto,
    emailVerificado,marcarEmailVerificado,
    empleadorDatosCompletos,marcarEmpleadorDatosCompletos,
    emailPendiente,clearEmailPendiente,calificacionPendiente,completarCalificacion,
  }),[
    session,modoActivo,suscripcionActiva,coachPendiente,coachEditarPendiente,
    mensajesSinLeer,perfilCompleto,emailVerificado,empleadorDatosCompletos,emailPendiente,calificacionPendiente,
  ]);

  return(
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(){return useContext(AppContext);}
