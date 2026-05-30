import React,{useState} from "react";
import{View,Text,StyleSheet,TouchableOpacity,ScrollView,StatusBar}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";

const ROLES=[
  {
    id:"worker",
    emoji:"💼",
    titulo:"TRABAJADOR",
    desc:"Quiero recibir ofertas laborales y postularme a concursos",
    items:["Activá tu perfil en 45 segundos","Recibí ofertas cerca de tu zona","Postulate a concursos públicos"],
    color:"#E8785A",
    grad:["#E8785A","#D4614A"],
  },
  {
    id:"employer",
    emoji:"🏠",
    titulo:"Busco un servicio",
    desc:"Necesito contratar a alguien para una tarea o trabajo",
    items:["Buscá por zona y categoría","Contacto directo y simple","Valorá al trabajador"],
    color:"#2DD4BF",
    grad:["#2DD4BF","#1BBFAA"],
  },
  {
    id:"company",
    emoji:"🏢",
    titulo:"EMPRESAS",
    desc:"Busco empleados calificados para mi empresa",
    items:["Filtros avanzados de búsqueda","Acceso a miles de perfiles calificados","Contacto directo con candidatos"],
    color:"#3DA882",
    grad:["#3DA882","#2D9870"],
  },
];

export default function RoleSelectScreen({navigation}){
  const[sel,setSel]=useState(null);

  function continuar(){
    if(!sel)return;
    if(sel==="company"){navigation.navigate("RegisterEmpresa");return;}
    navigation.navigate("Onboarding",{role:sel});
  }

  const rolSel=ROLES.find(r=>r.id===sel);

  return(
    <View style={ss.c}>
      <StatusBar barStyle="light-content"/>

      {/* Header oscuro con marca */}
      <LinearGradient colors={["#0D1117","#1C2333"]} style={ss.header}>
        <SafeAreaView edges={["top"]}>
          <View style={ss.headerInner}>
            <Text style={ss.logo}>Nexu</Text>
            <Text style={ss.slogan}>Deja de buscar,{"\n"}comienza a encontrar.</Text>
            <Text style={ss.pregunta}>¿Cómo te podemos ayudar?</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Cards de roles */}
      <ScrollView style={ss.body} contentContainerStyle={ss.bodyContent} showsVerticalScrollIndicator={false}>
        {ROLES.map(rol=>{
          const activo=sel===rol.id;
          return(
            <TouchableOpacity
              key={rol.id}
              style={[ss.card,activo&&{borderColor:rol.color,borderWidth:2}]}
              onPress={()=>setSel(rol.id)}
              activeOpacity={0.82}
            >
              {/* Acento de color izquierdo */}
              <View style={[ss.acento,{backgroundColor:rol.color}]}/>

              <View style={ss.cardBody}>
                <View style={ss.cardTop}>
                  <View style={[ss.iconBox,{backgroundColor:rol.color+"18"}]}>
                    <Text style={{fontSize:26}}>{rol.emoji}</Text>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={ss.cardTit}>{rol.titulo}</Text>
                    <Text style={ss.cardDesc}>{rol.desc}</Text>
                  </View>
                  {activo&&(
                    <View style={[ss.check,{backgroundColor:rol.color}]}>
                      <Text style={{color:"#FFF",fontSize:11,fontWeight:"900"}}>✓</Text>
                    </View>
                  )}
                </View>

                {activo&&(
                  <View style={ss.items}>
                    {rol.items.map((item,i)=>(
                      <View key={i} style={ss.item}>
                        <View style={[ss.dot,{backgroundColor:rol.color}]}/>
                        <Text style={ss.itemTxt}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Botón continuar */}
        <TouchableOpacity
          style={[ss.btnWrap,!sel&&{opacity:0.45}]}
          onPress={continuar}
          disabled={!sel}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={rolSel?rolSel.grad:["#1C2333","#0D1117"]}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={ss.btn}
          >
            <Text style={ss.btnTxt}>{sel?"Continuar →":"Seleccioná un perfil"}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={ss.login} onPress={()=>navigation.navigate("Login")}>
          <Text style={ss.loginTxt}>¿Ya tenés cuenta? <Text style={ss.loginBold}>Iniciar sesión</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:"#F6F8FA"},

  // Header
  header:{},
  headerInner:{paddingHorizontal:24,paddingTop:16,paddingBottom:28},
  logo:{fontSize:26,fontWeight:"900",color:"#E8785A",letterSpacing:-0.5,marginBottom:14},
  slogan:{fontSize:22,fontWeight:"700",color:"#FFFFFF",lineHeight:28,letterSpacing:-0.3,fontStyle:"italic",marginBottom:10},
  pregunta:{fontSize:13,fontWeight:"700",color:"rgba(255,255,255,0.5)",letterSpacing:1,textTransform:"uppercase"},

  // Body
  body:{flex:1},
  bodyContent:{padding:16,paddingBottom:36},

  // Card
  card:{backgroundColor:"#FFFFFF",borderRadius:16,marginBottom:12,borderWidth:1.5,borderColor:"#E2E8F0",overflow:"hidden",flexDirection:"row"},
  acento:{width:4,backgroundColor:"#E2E8F0"},
  cardBody:{flex:1,padding:16},
  cardTop:{flexDirection:"row",alignItems:"flex-start",gap:12},
  iconBox:{width:48,height:48,borderRadius:12,alignItems:"center",justifyContent:"center",flexShrink:0},
  cardTit:{fontSize:15,fontWeight:"900",color:"#0F172A",marginBottom:3},
  cardDesc:{fontSize:12,color:"#64748B",lineHeight:17},
  check:{width:22,height:22,borderRadius:11,alignItems:"center",justifyContent:"center",flexShrink:0},

  // Items expandidos
  items:{marginTop:14,gap:8},
  item:{flexDirection:"row",alignItems:"center",gap:8},
  dot:{width:6,height:6,borderRadius:3},
  itemTxt:{fontSize:12,color:"#0F172A",fontWeight:"600"},

  // Botón
  btnWrap:{borderRadius:12,overflow:"hidden",marginTop:8},
  btn:{paddingVertical:17,alignItems:"center"},
  btnTxt:{color:"#FFF",fontSize:16,fontWeight:"800",letterSpacing:-0.2},

  // Login
  login:{alignItems:"center",paddingTop:20},
  loginTxt:{fontSize:14,color:"#94A3B8"},
  loginBold:{fontWeight:"700",color:"#2DD4BF"},
});
