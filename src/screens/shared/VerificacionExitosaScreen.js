import React from "react";
import{View,Text,StyleSheet,TouchableOpacity}from "react-native";
import{SafeAreaView}from "react-native-safe-area-context";
import{LinearGradient}from "expo-linear-gradient";

export default function VerificacionExitosaScreen({navigation}){
  return(
    <SafeAreaView style={ss.c} edges={["top","bottom"]}>
      <View style={ss.body}>
        <View style={ss.iconoWrap}>
          <Text style={ss.icono}>✅</Text>
        </View>

        <Text style={ss.titulo}>¡Email verificado!</Text>
        <Text style={ss.sub}>Tu cuenta quedó confirmada. Ya podés usar Nexu.</Text>

        <TouchableOpacity
          style={ss.btnW}
          onPress={()=>navigation.popToTop()}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#E8785A","#D4614A"]}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={ss.btn}
          >
            <Text style={ss.btnTxt}>Continuar</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const ss=StyleSheet.create({
  c:{flex:1,backgroundColor:"#FBF8F4"},
  body:{flex:1,paddingHorizontal:32,justifyContent:"center",alignItems:"center"},
  iconoWrap:{width:100,height:100,borderRadius:50,backgroundColor:"#F0FDF4",alignItems:"center",justifyContent:"center",marginBottom:32,borderWidth:2,borderColor:"#86EFAC"},
  icono:{fontSize:48},
  titulo:{fontSize:28,fontWeight:"900",color:"#1A1020",textAlign:"center",marginBottom:14,letterSpacing:-0.5},
  sub:{fontSize:15,color:"#5A4E6A",textAlign:"center",lineHeight:22,marginBottom:44,paddingHorizontal:8},
  btnW:{width:"100%",borderRadius:14,overflow:"hidden"},
  btn:{paddingVertical:17,alignItems:"center"},
  btnTxt:{color:"#FFF",fontSize:16,fontWeight:"800"},
});
