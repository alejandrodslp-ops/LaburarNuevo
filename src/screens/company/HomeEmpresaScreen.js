import React from "react";
import{View,Text,StyleSheet,TouchableOpacity,ScrollView}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";
import{useApp}from "../../services/AppContext";

export default function HomeEmpresaScreen({navigation}){
  const{suscripcionActiva}=useApp();
  return(
    <SafeAreaView style={ss.c} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#1A1F3A","#2D3561"]} style={ss.header}>
          <Text style={ss.saludo}>Panel de empresa</Text>
          <Text style={ss.titulo}>🏢 Konexu Empresas</Text>
        </LinearGradient>
        <View style={ss.principalWrap}>
          <TouchableOpacity style={ss.principalBtn} onPress={()=>navigation.navigate("CrearOferta")} activeOpacity={0.9}>
            <Text style={ss.principalEmoji}>📣</Text>
            <Text style={ss.principalTit}>Publicar una vacante</Text>
            <Text style={ss.principalDesc}>Publicá tu búsqueda y te avisamos cuando aparezcan candidatos que encajen.</Text>
          </TouchableOpacity>

          <TouchableOpacity style={ss.secundarioBtn} onPress={()=>navigation.navigate("Explorar")} activeOpacity={0.8}>
            <Text style={ss.secundarioTxt}>🔍 O buscá trabajadores vos mismo</Text>
          </TouchableOpacity>
        </View>

        {!suscripcionActiva&&(
          <View style={ss.sinSub}>
            <Text style={ss.sinSubTit}>Estás en el plan gratuito</Text>
            <Text style={ss.sinSubDesc}>Con tu cuenta ya podés publicar y ver hasta 3 perfiles nuevos por día. Si necesitás más volumen, activá tu suscripción.</Text>
            <TouchableOpacity style={ss.sinSubBtn} onPress={()=>navigation.navigate("BienvenidaEmpresa")}>
              <Text style={ss.sinSubBtnTxt}>Ver planes y suscribirme</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:"#F2EDE6"},
  header:{paddingHorizontal:20,paddingTop:24,paddingBottom:32},
  saludo:{fontSize:13,color:"rgba(255,255,255,0.6)",marginBottom:4},
  titulo:{fontSize:24,fontWeight:"900",color:"#FFFFFF"},
  principalWrap:{padding:16,gap:10},
  principalBtn:{backgroundColor:"#3DA882",borderRadius:16,padding:22,alignItems:"center"},
  principalEmoji:{fontSize:32,marginBottom:8},
  principalTit:{fontSize:18,fontWeight:"900",color:"#FFFFFF",marginBottom:6},
  principalDesc:{fontSize:13,color:"rgba(255,255,255,0.85)",textAlign:"center",lineHeight:19},
  secundarioBtn:{alignItems:"center",paddingVertical:10},
  secundarioTxt:{fontSize:14,fontWeight:"700",color:"#5A4E6A"},
  sinSub:{margin:16,marginTop:0,backgroundColor:"#FFFFFF",borderRadius:16,padding:20,borderWidth:1,borderColor:"#EDE8E2",alignItems:"center",gap:10},
  sinSubTit:{fontSize:16,fontWeight:"800",color:"#1A1020"},
  sinSubDesc:{fontSize:13,color:"#A898B8",textAlign:"center",lineHeight:20},
  sinSubBtn:{backgroundColor:"#3DA882",borderRadius:10,paddingVertical:12,paddingHorizontal:24},
  sinSubBtnTxt:{color:"#FFFFFF",fontSize:14,fontWeight:"700"},
});
