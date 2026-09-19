import React from "react";
import { Text } from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";

const GRADIENTE = ["#F7B896", "#F97A4B", "#F95804", "#C23A00"];

export default function LogoKonexu({ style, texto = "konexu" }) {
  return (
    <MaskedView maskElement={<Text style={style}>{texto}</Text>}>
      <LinearGradient colors={GRADIENTE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={[style, { opacity: 0 }]}>{texto}</Text>
      </LinearGradient>
    </MaskedView>
  );
}
