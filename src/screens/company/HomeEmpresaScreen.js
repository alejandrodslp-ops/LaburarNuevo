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
          <Text style={ss.titulo}>🏢 Nexu Empresas</Text>
          {!suscripcionActiva&&(
            <TouchableOpacity style={ss.activarBtn} onPress={()=>navigation.navigate("BienvenidaEmpresa")}>
              <Text style={ss.activarTxt}>⚡ Activar suscripcion</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
        {!suscripcionActiva&&(
          <View style={ss.sinSub}>
            <Text style={ss.sinSubTit}>Tu cuenta no esta activa</Text>
            <Text style={ss.sinSubDesc}>Activa tu suscripcion para empezar a buscar trabajadores y acceder a todos los beneficios de Nexu.</Text>
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
  activarBtn:{marginTop:16,backgroundColor:"#E8785A",borderRadius:10,paddingVertical:10,paddingHorizontal:16,alignSelf:"flex-start"},
  activarTxt:{color:"#FFFFFF",fontSize:13,fontWeight:"700"},
  sinSub:{margin:16,backgroundColor:"#FFFFFF",borderRadius:16,padding:20,borderWidth:1,borderColor:"#EDE8E2",alignItems:"center",gap:10},
  sinSubTit:{fontSize:16,fontWeight:"800",color:"#1A1020"},
  sinSubDesc:{fontSize:13,color:"#A898B8",textAlign:"center",lineHeight:20},
  sinSubBtn:{backgroundColor:"#3DA882",borderRadius:10,paddingVertical:12,paddingHorizontal:24},
  sinSubBtnTxt:{color:"#FFFFFF",fontSize:14,fontWeight:"700"},
  activo:{margin:16,backgroundColor:"#E6FBF5",borderRadius:12,padding:16,borderWidth:1,borderColor:"#3DA882"},
  activoTxt:{fontSize:14,fontWeight:"700",color:"#2E9472",textAlign:"center"},
});
